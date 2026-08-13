// Server-only. Backend build order §14 item 3 — global prompt scaffold + structured-
// output client wrapper, built once and reused by every AI-driven step (§4-§13).
// Never import this from a Client Component (same convention as ../supabase/server.ts).
import "server-only";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { AIGenerationFailedError, ResearchModeNotAllowedError } from "./errors";

export { AIGenerationFailedError, ResearchModeNotAllowedError };

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const MODEL = "claude-opus-4-8";

// SCHWARTZ_METHODOLOGY_SKILL.md's "Where research mode (live web/news) is allowed vs.
// forbidden" section is the source of truth this enforces — live web/news access may only
// ever touch step 2 (Key forces), step 3 (Driving forces), and step 8 (Indicators/monitoring).
// Every other step reasons closed-book. This is a binding constraint, not documentation: the
// guard in runStructured below throws for any `step` outside this list that tries to attach
// `webSearch`, so a future caller can't silently reintroduce research access to a step that
// isn't allowed to have it.
export const RESEARCH_MODE_ALLOWED_STEPS: readonly string[] = [
  "signals.local_force_scan", // Step 2 — Key forces exploratory scan (ai-research-suggestions.ts)
  "signals.macro_trend_sweep", // Step 3 — Driving forces exploratory scan (ai-research-suggestions.ts)
  "news_feed.pull", // Step 8 — daily ingestion job (ai-news-feed.ts's searchNewsItems), also
  // reused by Knowledge Base's manual "Pull recent news" button and the Dashboard's News Feed
  // pull (both pre-existing, same underlying call)
  "grounding.generate", // Signpost (ai-grounding.ts) — a deliberate carve-out: live-web-cited
  // early-warning indicators, treated as step-8-adjacent rather than narrative/storyline
  // generation proper, which stays closed-book everywhere else
];

// §3 — reused verbatim by every AI call in every step below. Sent as a cached system
// block since it's byte-identical on every request.
export const SYSTEM_PREAMBLE = `You are Scenaric's scenario-planning analyst. You work strictly from the
project data provided in this request — the knowledge base, signals, axes,
and prior steps. You are implementing Peter Schwartz's scenario-planning
method from "The Art of the Long View." Follow the definition of the
current step exactly; do not substitute a generic brainstorming approach.

Rules (violating any of these is a failure):
1. Never invent a fact, statistic, date, or named entity that is not present
   in the supplied context. If you need a plausible illustrative detail,
   you may generalize from a cited signal but must not state it as if it
   were sourced when it is inferred — mark inferred content in the
   \`inference\` field of your output, never inline in prose.
2. Every claim you output must be traceable to one or more input ids
   (signal_id / source_id / node_id). Populate \`grounded_in: [...]\` with
   those ids. If a claim has no grounding, do not include it.
3. If the input evidence is insufficient to complete the step
   confidently, return \`sufficient_evidence: false\` and a \`gap\`
   description instead of guessing. Do not pad with generic
   filler to look complete.
4. Output ONLY the JSON matching the provided schema. No prose outside
   the schema, no markdown, no preamble.
5. Never break the 2-axis / 4-quadrant structure, the 5-phase storyline
   structure, or the STEEP taxonomy (Social, Technological, Economic,
   Ecological, Political) — these are fixed by the method, not creative
   choices.`;

interface RunStructuredOptions<T extends z.ZodTypeAny> {
  step: string;
  /** Null for calls that happen before a project exists (e.g. onboarding's focal-question
   *  refine) — the ai_runs row is still written, with project_id: null. */
  projectId: string | null;
  taskPrompt: string;
  input: unknown;
  schema: T;
  promptVersion?: string;
  /** Adaptive thinking on/off. Off (omitted) by default — matches "deterministic" calls
   *  (scoring, classification). Turn on for generative calls (narrative prose, storyline). */
  thinking?: boolean;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
  /** Grants the model Anthropic's server-executed web_search tool for calls that need to
   *  ground against live, current information (Signpost, Plausibility score) rather than
   *  only the project's own stored data — off by default; every existing caller omits this
   *  and is unaffected. The final answer still comes back as schema-validated structured
   *  output via output_config below; web_search is an additional tool available in the same
   *  turn, not a replacement for it. Since runStructured only ever surfaces `parsed_output`,
   *  any call that turns this on should ask the model to report the real URLs/titles it
   *  found directly inside its own JSON output (e.g. a `citations` field) rather than relying
   *  on the caller to parse intermediate web_search_tool_result content blocks. */
  webSearch?: { maxUses?: number };
  /** Tags this call's ai_runs row so every call made during one batch (e.g. one cron
   *  invocation, across every project it touched) can be queried as a single unit later.
   *  Omitted by default — every existing caller is unaffected, the column just stays null. */
  batchId?: string;
  /** Tags this call's ai_runs row with the page/flow it came from (e.g. "onboarding") —
   *  useful for calls like onboarding's, which happen before a project exists and so can't
   *  be grouped by project_id the way every other step already can. Omitted by default —
   *  every existing caller is unaffected, the column just stays null. */
  page?: string;
}

function inputHashFor(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function confidenceFrom(output: unknown): string | null {
  if (output && typeof output === "object" && "confidence" in output) {
    const c = (output as Record<string, unknown>).confidence;
    return typeof c === "string" ? c : null;
  }
  return null;
}

async function logRun(args: {
  projectId: string | null;
  step: string;
  promptVersion: string;
  inputHash: string;
  outputJson: unknown | null;
  confidence: string | null;
  batchId: string | null;
  usedWebSearch: boolean;
  page: string | null;
}) {
  // Service-role client: audit-log writes shouldn't depend on the acting user's own row
  // permissions, and this is the only way to log a pre-project call (project_id: null),
  // which RLS could never admit for a request-scoped client anyway.
  const supabase = createAdminClient();
  const { error } = await supabase.from("ai_runs").insert({
    project_id: args.projectId,
    step: args.step,
    prompt_version: args.promptVersion,
    input_hash: args.inputHash,
    output_json: args.outputJson,
    model: MODEL,
    confidence: args.confidence,
    batch_id: args.batchId,
    used_web_search: args.usedWebSearch,
    page: args.page,
  });
  if (error) console.error("[ai/client] failed to log ai_runs", error);
}

/**
 * Runs one structured-output call against Claude, validated against `schema` via the
 * SDK's built-in structured-output support. Retries once on a schema-validation failure
 * or safety refusal; throws AIGenerationFailedError on a second failure. Every attempt
 * (success or final failure) is logged to ai_runs.
 */
export async function runStructured<T extends z.ZodTypeAny>(opts: RunStructuredOptions<T>): Promise<z.infer<T>> {
  const { step, projectId, taskPrompt, input, schema, effort = "medium", thinking = false, maxTokens = 4096, webSearch, batchId = null, page = null } = opts;
  const promptVersion = opts.promptVersion || "v1";
  const inputHash = inputHashFor(input);

  // Loud, request-time enforcement of SCHWARTZ_METHODOLOGY_SKILL.md's research-mode policy —
  // fires before any Anthropic call is made, so a disallowed step can never silently get
  // research access even opportunistically. See RESEARCH_MODE_ALLOWED_STEPS above.
  if (webSearch && !RESEARCH_MODE_ALLOWED_STEPS.includes(step)) {
    throw new ResearchModeNotAllowedError(step);
  }

  const attempt = async (correction?: string) => {
    return anthropic.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      ...(thinking ? { thinking: { type: "adaptive" } as const } : {}),
      ...(webSearch
        ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const, max_uses: webSearch.maxUses ?? 5 }] }
        : {}),
      system: [
        { type: "text", text: SYSTEM_PREAMBLE, cache_control: { type: "ephemeral" } },
        { type: "text", text: taskPrompt },
      ],
      messages: [
        {
          role: "user",
          content: correction ? `${JSON.stringify(input)}\n\n${correction}` : JSON.stringify(input),
        },
      ],
      output_config: {
        format: zodOutputFormat(schema),
        effort,
      },
    });
  };

  let lastReason: "refusal" | "schema_validation_failed" = "schema_validation_failed";

  for (let i = 0; i < 2; i++) {
    // .parse() can either return parsed_output: null / stop_reason: "refusal" on a normal
    // response, OR throw directly (e.g. truncated/unparseable JSON from a cut-off
    // response) — both are retryable schema-validation failures, not fatal errors.
    let response;
    try {
      response = await attempt(
        i === 0 ? undefined : "Your previous response didn't validate against the required schema — return JSON matching it exactly."
      );
    } catch (err) {
      // A real API/transport error (auth, rate limit, permission, etc.) is not a retryable
      // schema-validation failure — masking it here would discard status/type the caller
      // needs (e.g. distinguishing "web search unavailable" from "model gave bad JSON").
      // Only genuine parse/shape failures (truncated/unparseable JSON) fall through to retry.
      if (err instanceof Anthropic.APIError) throw err;
      lastReason = "schema_validation_failed";
      continue;
    }

    if (response.stop_reason === "refusal") {
      lastReason = "refusal";
      continue;
    }
    if (response.parsed_output == null) {
      lastReason = "schema_validation_failed";
      continue;
    }

    await logRun({
      projectId,
      step,
      promptVersion,
      inputHash,
      outputJson: response.parsed_output,
      confidence: confidenceFrom(response.parsed_output),
      batchId,
      usedWebSearch: !!webSearch,
      page,
    });
    return response.parsed_output;
  }

  await logRun({ projectId, step, promptVersion, inputHash, outputJson: null, confidence: null, batchId, usedWebSearch: !!webSearch, page });
  throw new AIGenerationFailedError(step, lastReason, 2);
}
