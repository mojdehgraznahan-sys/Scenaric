"use server";

// Steps 2/3 exploratory research (SCHWARTZ_METHODOLOGY_SKILL.md's "Where research mode
// (live web/news) is allowed vs. forbidden" section) — the only two build-order steps besides
// step 8 allowed to run live web/news lookups. Both scans below are read-only web_search calls
// that stage their results into research_suggestions (0029_research_suggestions.sql,
// status:'suggested', source:'external_research') — never inserted directly as signals/
// insights. Promotion only happens via confirmResearchSuggestion, mirroring the Dashboard News
// Feed's news_items -> addNewsItemToSignals staging pattern (ai-news-items.ts).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { runStructured } from "@/lib/ai/client";
import { AIWebSearchError, NotFoundError } from "@/lib/ai/errors";
import { createClient } from "@/lib/supabase/server";
import { createSignal, type SteepCategory } from "./signals";
import { scoreOneSignal } from "./ai-signals";
import { buildSignalsContext } from "./signals-context";
import type { Database } from "@/lib/supabase/types";

export type ResearchSuggestionRow = Database["public"]["Tables"]["research_suggestions"]["Row"];
type SignalRow = Database["public"]["Tables"]["signals"]["Row"];

const LocalForceScanSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  items: z
    .array(
      z.object({
        actor_name: z.string(),
        actor_type: z.enum(["competitor", "regulator", "customer", "supplier", "partner", "internal_capability"]),
        // 2-3 sentences: who they are and why they matter to the focal question — not a quote,
        // this is the model's own summary of what it found via web_search.
        description: z.string(),
        citation_title: z.string(),
        citation_url: z.string(),
      })
    )
    .max(8),
});

const LOCAL_FORCE_SCAN_TASK_PROMPT = `Task: Search the live web for REAL, currently-active local/task-
environment actors (Step 2, Key forces — customers, suppliers, competitors, regulators,
partners the org would directly interact with) relevant to this project's focal question,
that are not already covered by its existing local-actor insights.

Input: { focal_question: string, industry: string, horizon: string,
         existing_actors: [{ actor_name: string, actor_type: string }]
         /* avoid resurfacing one of these — check semantic overlap, not just exact name match */ }

Rules:
- Every item must be a real, currently-relevant actor you actually found via web_search —
  never a fabricated company/agency/name. cite the real source you found it in.
- \`actor_type\` is exactly one of: competitor, regulator, customer, supplier, partner,
  internal_capability.
- \`description\` is 2-3 sentences explaining who this actor is and the specific mechanism by
  which they bear on the focal question — not generic company-profile text.
- citation_title/citation_url must be the real title/URL you found this actor referenced in —
  never invented.
- Skip anything semantically the same as an existing_actors entry.
- If web_search turns up nothing genuinely new and relevant, return sufficient_evidence:false
  and a gap explaining why — do not pad with tangential results to look complete.
- Cap at 8 items per call.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  items: [{ actor_name: string, actor_type: "competitor"|"regulator"|"customer"|"supplier"|
            "partner"|"internal_capability", description: string, citation_title: string,
            citation_url: string }] }`;

const MacroTrendSweepSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  items: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
        category: z.enum(["Social", "Technology", "Economic", "Ecological", "Political"]),
        citation_title: z.string(),
        citation_url: z.string(),
      })
    )
    .max(8),
});

const MACRO_TREND_SWEEP_TASK_PROMPT = `Task: Search the live web for REAL, currently-relevant
macro-environmental STEEP trends (Step 3, Driving forces — Social, Technological, Economic,
Ecological, Political forces outside the org's direct control) relevant to this project's
focal question, that are not already covered by its existing signals.

Input: { focal_question: string, industry: string, horizon: string,
         existing_signals: [{ title: string, category: string }]
         /* avoid resurfacing one of these — check semantic overlap, not just exact title match */ }

Rules:
- Every item must be a real, currently-relevant macro trend you actually found via web_search —
  never a fabricated statistic, report, or trend.
- Each item needs exactly one STEEP category: Social, Technology, Economic, Ecological, or
  Political.
- Write \`title\` as a factual trend statement (<=8 words), \`body\` as a 2-sentence
  explanation of the mechanism connecting it to the focal question.
- citation_title/citation_url must be the real title/URL you found this trend reported in —
  never invented.
- Skip anything semantically the same as an existing_signals entry.
- If web_search turns up nothing genuinely new and relevant, return sufficient_evidence:false
  and a gap explaining why — do not pad with tangential results to look complete.
- Cap at 8 items per call.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  items: [{ title: string, body: string,
            category: "Social"|"Technology"|"Economic"|"Ecological"|"Political",
            citation_title: string, citation_url: string }] }`;

export interface RunScanResult {
  sufficientEvidence: boolean;
  gap: string | null;
  suggestionsCreated: number;
}

export interface RunScanOptions {
  /** Steers (never restricts) this one call toward a specific angle — e.g. "competitors only,
   *  emphasize recent moves" — without changing the output schema or actor_type/category enum.
   *  Same spirit as ai-news-feed.ts's focusTopics param. Omitted by default; every existing
   *  caller (this page's generic scan buttons, Signals' "Scan for driving forces") is
   *  unaffected. */
  focus?: string;
}

// Step 2 — Key forces. "Scan for local actors (web)" on the Knowledge Base page.
export async function runLocalForceScan(projectId: string, options: RunScanOptions = {}): Promise<RunScanResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, industry, horizon")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const { data: existingInsights, error: insightsError } = await supabase
    .from("insights")
    .select("text, actor_type")
    .eq("project_id", projectId)
    .eq("category", "local_actor");
  if (insightsError) throw insightsError;

  let output: z.infer<typeof LocalForceScanSchema>;
  try {
    output = await runStructured({
      step: "signals.local_force_scan",
      projectId,
      taskPrompt: options.focus ? `${LOCAL_FORCE_SCAN_TASK_PROMPT}\n\nFOCUS (this call only): ${options.focus}` : LOCAL_FORCE_SCAN_TASK_PROMPT,
      input: {
        focal_question: project.refined_focal_question ?? project.focal_question,
        industry: project.industry,
        horizon: project.horizon,
        existing_actors: existingInsights.map((i) => ({ actor_name: i.text, actor_type: i.actor_type ?? "" })),
      },
      schema: LocalForceScanSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }

  if (!output.sufficient_evidence || output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.gap, suggestionsCreated: 0 };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("research_suggestions")
    .upsert(
      output.items.map((item) => ({
        project_id: projectId,
        step: "key_forces" as const,
        title: item.actor_name,
        body: item.description,
        actor_type: item.actor_type,
        citation_title: item.citation_title,
        citation_url: item.citation_url,
      })),
      { onConflict: "project_id,step,title", ignoreDuplicates: true }
    )
    .select("id");
  if (insertError) throw insertError;

  revalidatePath("/knowledge");
  return { sufficientEvidence: true, gap: null, suggestionsCreated: inserted.length };
}

// Step 3 — Driving forces. "Scan for driving forces (web)" on the Signals Library page.
export async function runMacroTrendSweep(projectId: string, options: RunScanOptions = {}): Promise<RunScanResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, industry, horizon")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const { data: existingSignals, error: signalsError } = await supabase.from("signals").select("title, category").eq("project_id", projectId);
  if (signalsError) throw signalsError;

  let output: z.infer<typeof MacroTrendSweepSchema>;
  try {
    output = await runStructured({
      step: "signals.macro_trend_sweep",
      projectId,
      taskPrompt: options.focus ? `${MACRO_TREND_SWEEP_TASK_PROMPT}\n\nFOCUS (this call only): ${options.focus}` : MACRO_TREND_SWEEP_TASK_PROMPT,
      input: {
        focal_question: project.refined_focal_question ?? project.focal_question,
        industry: project.industry,
        horizon: project.horizon,
        existing_signals: existingSignals.map((s) => ({ title: s.title, category: s.category })),
      },
      schema: MacroTrendSweepSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }

  if (!output.sufficient_evidence || output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.gap, suggestionsCreated: 0 };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("research_suggestions")
    .upsert(
      output.items.map((item) => ({
        project_id: projectId,
        step: "driving_forces" as const,
        title: item.title,
        body: item.body,
        category: item.category,
        citation_title: item.citation_title,
        citation_url: item.citation_url,
      })),
      { onConflict: "project_id,step,title", ignoreDuplicates: true }
    )
    .select("id");
  if (insertError) throw insertError;

  revalidatePath("/signals");
  return { sufficientEvidence: true, gap: null, suggestionsCreated: inserted.length };
}

export async function listResearchSuggestions(
  projectId: string,
  step: "key_forces" | "driving_forces" | ("key_forces" | "driving_forces" | "find")[]
): Promise<ResearchSuggestionRow[]> {
  const supabase = createClient();
  const steps = Array.isArray(step) ? step : [step];
  const { data, error } = await supabase
    .from("research_suggestions")
    .select("*")
    .eq("project_id", projectId)
    .in("step", steps)
    .eq("status", "suggested")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// ---- Signals "Ask AI" Group 1 "Find" (SIGNALS_ASK_AI_PROMPTS.md) ----
// Same research-mode-on / stage-into-research_suggestions pattern as runLocalForceScan/
// runMacroTrendSweep above, under the shared step:'find' value (see
// 0035_research_suggestions_find_step.sql for why: these prompts can return a mix of
// key-force and driving-force items in one response, and 'find' keeps that mix routing to
// one place — the Signals page's Suggestions tab, confirming into `signals` — instead of
// splitting by classification into the pre-existing key_forces/driving_forces routing.

const ACTOR_TYPES = ["competitor", "regulator", "customer", "supplier", "partner", "internal_capability"] as const;
const STEEP = ["Social", "Technology", "Economic", "Ecological", "Political"] as const;

const FindItemBase = z.object({
  force_type: z.enum(["key", "driving"]),
  title: z.string(),
  body: z.string(),
  category: z.enum(STEEP).nullable(), // set iff force_type === "driving"
  actor_type: z.enum(ACTOR_TYPES).nullable(), // set iff force_type === "key"
  citation_title: z.string(),
  citation_url: z.string(),
});

interface FindInsertItem {
  title: string;
  body: string;
  category: SteepCategory | null;
  actor_type: (typeof ACTOR_TYPES)[number] | null;
  citation_title: string;
  citation_url: string;
}

async function insertFindSuggestions(supabase: ReturnType<typeof createClient>, projectId: string, items: FindInsertItem[]): Promise<number> {
  if (items.length === 0) return 0;
  const { data: inserted, error } = await supabase
    .from("research_suggestions")
    .upsert(
      items.map((item) => ({
        project_id: projectId,
        step: "find" as const,
        title: item.title,
        body: item.body,
        category: item.category,
        actor_type: item.actor_type,
        citation_title: item.citation_title,
        citation_url: item.citation_url,
      })),
      { onConflict: "project_id,step,title", ignoreDuplicates: true }
    )
    .select("id");
  if (error) throw error;
  return inserted.length;
}

// 1.1 "Scan for forces I haven't captured"
const FindScanSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  items: z.array(FindItemBase).max(10),
});

const FIND_SCAN_TASK_PROMPT = `Task: Search the live web for REAL forces relevant to this project's
focal question that are absent from its existing signals — split across Step 2 (Key forces:
customers, suppliers, competitors, regulators the org directly interacts with) and Step 3
(Driving forces: macro Social/Technological/Economic/Ecological/Political forces outside its
control).

Input: { focal_question: string, industry: string, horizon: string,
         existing_signal_titles: string[]
         /* avoid resurfacing one of these — check semantic overlap, not just string match */ }

Rules:
- Identify 6-10 forces total, actually found via web_search — never fabricated.
- Set \`force_type\` to "key" (set \`actor_type\`, leave \`category\` null) or "driving" (set
  \`category\`, leave \`actor_type\` null).
- \`body\` states, in one sentence, why this force bears on THIS SPECIFIC focal question — not
  the industry generally.
- citation_title/citation_url must be the real title/URL you found this in — never invented.
- Do not restate anything semantically the same as an existing_signal_titles entry.
- If web_search turns up nothing genuinely new and relevant, return sufficient_evidence:false
  and a gap explaining why.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  items: [{ force_type: "key"|"driving", title: string, body: string,
            category: "Social"|"Technology"|"Economic"|"Ecological"|"Political"|null,
            actor_type: "competitor"|"regulator"|"customer"|"supplier"|"partner"|
              "internal_capability"|null,
            citation_title: string, citation_url: string }] }`;

export async function runFindScan(projectId: string): Promise<RunScanResult> {
  const ctx = await buildSignalsContext(projectId);
  let output: z.infer<typeof FindScanSchema>;
  try {
    output = await runStructured({
      step: "signals.find.scan",
      projectId,
      taskPrompt: FIND_SCAN_TASK_PROMPT,
      input: { focal_question: ctx.focalQuestion, industry: ctx.industry, horizon: ctx.horizon, existing_signal_titles: ctx.existingSignalTitles },
      schema: FindScanSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }
  if (!output.sufficient_evidence || output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.gap, suggestionsCreated: 0 };
  }
  const supabase = createClient();
  const created = await insertFindSuggestions(supabase, projectId, output.items);
  revalidatePath("/signals");
  return { sufficientEvidence: true, gap: null, suggestionsCreated: created };
}

// 1.2 "Turn my oracle questions into forces" — needs onboarding.o1/o2/o3 (Phase 0).
const FindOracleItemSchema = FindItemBase.extend({
  source_question: z.enum(["o1", "o2", "o3"]),
  resolution_paths: z.array(z.string()).max(3),
  duplicates_existing: z.string().nullable(),
});
const FindOracleSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  items: z.array(FindOracleItemSchema).max(9),
});

const FIND_ORACLE_TASK_PROMPT = `Task: Search the live web to turn the user's own "oracle
questions" (from onboarding: if an oracle would answer truthfully about their business, what
would they ask it) into named forces — these are the user's own stated unknowns, high-priority
candidates, not speculation.

Input: { focal_question: string, horizon: string,
         oracle_questions: [{ key: "o1"|"o2"|"o3", text: string }],
         existing_signal_titles: string[] }

Rules:
- For EACH oracle question given, name the underlying force whose outcome is unknown, set
  \`source_question\` to that question's key, and classify \`force_type\` (key vs driving) as in
  the base schema.
- \`resolution_paths\` lists 2-3 plausible ways the force could resolve over the horizon.
- Set \`duplicates_existing\` to the matching title if this force is semantically the same as an
  existing_signal_titles entry, else null — still return the item (do not silently drop it).
- Ground every item in something found via web_search where relevant; cite it.
- If a given question yields nothing substantive, say so in \`gap\` rather than padding.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  items: [{ source_question: "o1"|"o2"|"o3", force_type: "key"|"driving", title: string,
            body: string, category: (STEEP)|null, actor_type: (actor types)|null,
            resolution_paths: string[], duplicates_existing: string|null,
            citation_title: string, citation_url: string }] }`;

export async function runFindOracleQuestions(projectId: string): Promise<RunScanResult> {
  const ctx = await buildSignalsContext(projectId);
  if (!ctx.onboarding?.o1) {
    return { sufficientEvidence: false, gap: "This project has no oracle-question answers from onboarding to work from.", suggestionsCreated: 0 };
  }
  const oracleQuestions = [
    { key: "o1" as const, text: ctx.onboarding.o1 },
    ...(ctx.onboarding.o2 ? [{ key: "o2" as const, text: ctx.onboarding.o2 }] : []),
    ...(ctx.onboarding.o3 ? [{ key: "o3" as const, text: ctx.onboarding.o3 }] : []),
  ];
  let output: z.infer<typeof FindOracleSchema>;
  try {
    output = await runStructured({
      step: "signals.find.oracle",
      projectId,
      taskPrompt: FIND_ORACLE_TASK_PROMPT,
      input: { focal_question: ctx.focalQuestion, horizon: ctx.horizon, oracle_questions: oracleQuestions, existing_signal_titles: ctx.existingSignalTitles },
      schema: FindOracleSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }
  if (!output.sufficient_evidence || output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.gap, suggestionsCreated: 0 };
  }
  const supabase = createClient();
  const created = await insertFindSuggestions(supabase, projectId, output.items);
  revalidatePath("/signals");
  return { sufficientEvidence: true, gap: null, suggestionsCreated: created };
}

// 1.3 "Profile the actors I don't control" — needs onboarding.actors (Phase 0). {actors} is
// freeform prose (blockD.dependencies), not a structured list — the model identifies the
// discrete parties itself as part of the same reasoning/web_search pass, capped at 6, rather
// than being pre-split client-side (a rambling answer could otherwise fan out into an
// unbounded number of research sub-calls).
const FindActorItemSchema = z.object({
  actor_name: z.string(),
  actor_type: z.enum(ACTOR_TYPES).nullable(),
  body: z.string(),
  citation_title: z.string(),
  citation_url: z.string(),
});
const FindActorsSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  items: z.array(FindActorItemSchema).max(6),
});

const FIND_ACTORS_TASK_PROMPT = `Task: The user named parties they depend on but do not control.
Identify the DISCRETE actors in that freeform text (it may name several in one sentence), then
for each, search the live web for their current strategic posture, recent moves, and the single
most consequential thing they could do over the horizon that would change this user's decision.

Input: { focal_question: string, horizon: string, actors_text: string /* freeform, may name
         several parties in one answer — identify each distinct one */ }

Rules:
- Identify at most 6 discrete actors from actors_text. If it names more, pick the 6 most
  consequential to focal_question.
- For each: \`body\` covers current strategic posture + recent/announced moves + the most
  consequential thing they could plausibly do over the horizon — grounded in web_search, never
  fabricated. This becomes one candidate key force (Step 2) per actor.
- \`actor_type\` classifies the actor (competitor/regulator/customer/supplier/partner/
  internal_capability) — null only if genuinely ambiguous.
- If web_search turns up nothing substantive on a named actor, omit them and note it in \`gap\`
  rather than filling in generic, unsupported claims.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  items: [{ actor_name: string, actor_type: (actor types)|null, body: string,
            citation_title: string, citation_url: string }] }`;

export async function runFindActorProfile(projectId: string): Promise<RunScanResult> {
  const ctx = await buildSignalsContext(projectId);
  if (!ctx.onboarding?.actors) {
    return { sufficientEvidence: false, gap: "This project has no dependency/actors answer from onboarding to work from.", suggestionsCreated: 0 };
  }
  let output: z.infer<typeof FindActorsSchema>;
  try {
    output = await runStructured({
      step: "signals.find.actors",
      projectId,
      taskPrompt: FIND_ACTORS_TASK_PROMPT,
      input: { focal_question: ctx.focalQuestion, horizon: ctx.horizon, actors_text: ctx.onboarding.actors },
      schema: FindActorsSchema,
      effort: "medium",
      webSearch: { maxUses: 6 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }
  if (!output.sufficient_evidence || output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.gap, suggestionsCreated: 0 };
  }
  const supabase = createClient();
  const created = await insertFindSuggestions(
    supabase,
    projectId,
    output.items.map((item) => ({
      title: item.actor_name,
      body: item.body,
      category: null,
      actor_type: item.actor_type,
      citation_title: item.citation_title,
      citation_url: item.citation_url,
    }))
  );
  revalidatePath("/signals");
  return { sufficientEvidence: true, gap: null, suggestionsCreated: created };
}

// 1.4 "What would make my worst case happen?" — needs onboarding.bad (Phase 0); turns is
// optional context, folded in when present.
const FindWorstCaseItemSchema = FindItemBase.extend({
  observable_precursor: z.string(),
  duplicates_existing: z.string().nullable(),
});
const FindWorstCaseSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  items: z.array(FindWorstCaseItemSchema).max(10),
});

const FIND_WORST_CASE_TASK_PROMPT = `Task: Working backwards from the user's stated worst case,
search the live web for the forces that would have to move for it to materialize — prioritize
forces with observable present-day precursors over abstract risks.

Input: { focal_question: string, horizon: string, worst_case: string,
         turning_points: string | null /* pivotal events the user said they'd want to see
         coming, if given */, existing_signal_titles: string[] }

Rules:
- Identify up to 10 forces whose movement would be necessary for worst_case to happen, grounded
  in web_search where relevant.
- \`observable_precursor\` states the specific, present-day-visible signal that this force is
  already moving — not a vague "watch for X" generality.
- Set \`duplicates_existing\` to the matching title if semantically the same as an
  existing_signal_titles entry, else null (still return the item).
- Classify \`force_type\`/\`category\`/\`actor_type\` as in the base schema.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  items: [{ force_type: "key"|"driving", title: string, body: string,
            category: (STEEP)|null, actor_type: (actor types)|null,
            observable_precursor: string, duplicates_existing: string|null,
            citation_title: string, citation_url: string }] }`;

export async function runFindWorstCaseBackcast(projectId: string): Promise<RunScanResult> {
  const ctx = await buildSignalsContext(projectId);
  if (!ctx.onboarding?.bad) {
    return { sufficientEvidence: false, gap: "This project has no worst-case answer from onboarding to work from.", suggestionsCreated: 0 };
  }
  let output: z.infer<typeof FindWorstCaseSchema>;
  try {
    output = await runStructured({
      step: "signals.find.worst_case",
      projectId,
      taskPrompt: FIND_WORST_CASE_TASK_PROMPT,
      input: {
        focal_question: ctx.focalQuestion,
        horizon: ctx.horizon,
        worst_case: ctx.onboarding.bad,
        turning_points: ctx.onboarding.turns,
        existing_signal_titles: ctx.existingSignalTitles,
      },
      schema: FindWorstCaseSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }
  if (!output.sufficient_evidence || output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.gap, suggestionsCreated: 0 };
  }
  const supabase = createClient();
  const created = await insertFindSuggestions(supabase, projectId, output.items);
  revalidatePath("/signals");
  return { sufficientEvidence: true, gap: null, suggestionsCreated: created };
}

// 1.5 "Blind-spot sweep" — driving-force-only (category always set); category_notes is prose
// commentary (e.g. "under-weighted category X is appropriate here because...") surfaced only
// in the drawer's summary card via `gap`, never inserted as a suggestion row itself.
const FindBlindSpotItemSchema = z.object({
  title: z.string(),
  body: z.string(),
  category: z.enum(STEEP),
  citation_title: z.string(),
  citation_url: z.string(),
});
const FindBlindSpotSchema = z.object({
  sufficient_evidence: z.boolean(),
  category_notes: z.string().nullable(),
  items: z.array(FindBlindSpotItemSchema).max(12),
});

const FIND_BLIND_SPOT_TASK_PROMPT = `Task: Given how this project's signals currently cluster
across STEEP categories, identify which categories are under-represented relative to what the
focal question actually depends on, then search the live web for 2-3 forces in each thin
category.

Input: { focal_question: string, industry: string, horizon: string,
         category_distribution: { Social: number, Technology: number, Economic: number,
           Ecological: number, Political: number } }

Rules:
- Only propose forces for categories that are BOTH thin (low count) AND actually relevant to
  focal_question — explicitly call out in \`category_notes\` any category where thin coverage is
  appropriate (not a gap) rather than padding it with filler forces.
- Every item is driving-force-only (category always set, force is macro/STEEP, not a local
  actor) — grounded in web_search, never fabricated.
- Cap at 12 items total across all thin categories.

Output schema:
{ sufficient_evidence: boolean, category_notes: string | null,
  items: [{ title: string, body: string,
            category: "Social"|"Technology"|"Economic"|"Ecological"|"Political",
            citation_title: string, citation_url: string }] }`;

export async function runFindBlindSpotSweep(projectId: string): Promise<RunScanResult> {
  const ctx = await buildSignalsContext(projectId);
  let output: z.infer<typeof FindBlindSpotSchema>;
  try {
    output = await runStructured({
      step: "signals.find.blind_spot",
      projectId,
      taskPrompt: FIND_BLIND_SPOT_TASK_PROMPT,
      input: { focal_question: ctx.focalQuestion, industry: ctx.industry, horizon: ctx.horizon, category_distribution: ctx.categoryDistribution },
      schema: FindBlindSpotSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }
  if (output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.category_notes, suggestionsCreated: 0 };
  }
  const supabase = createClient();
  const created = await insertFindSuggestions(
    supabase,
    projectId,
    output.items.map((item) => ({ ...item, actor_type: null }))
  );
  revalidatePath("/signals");
  return { sufficientEvidence: true, gap: output.category_notes, suggestionsCreated: created };
}

async function getOwnSuggestion(projectId: string, id: string): Promise<ResearchSuggestionRow> {
  const supabase = createClient();
  const { data, error } = await supabase.from("research_suggestions").select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Research suggestion ${id} could not be found in project ${projectId}.`);
  return data;
}

export interface ConfirmResearchSuggestionResult {
  suggestion: ResearchSuggestionRow;
  signal?: SignalRow;
}

// Confirm-before-merge — the required UI step per SCHWARTZ_METHODOLOGY_SKILL.md before an
// external-research suggestion becomes real project data. Mirrors addNewsItemToSignals
// (ai-news-items.ts): idempotent re-click, and (for driving_forces) awaits scoring so the
// resulting signal is never left sitting unscored the way the fire-and-forget UI path would.
export async function confirmResearchSuggestion(projectId: string, id: string): Promise<ConfirmResearchSuggestionResult> {
  const supabase = createClient();
  const suggestion = await getOwnSuggestion(projectId, id);

  if (suggestion.status === "confirmed") {
    if (suggestion.confirmed_signal_id) {
      const { data: existing, error } = await supabase.from("signals").select("*").eq("id", suggestion.confirmed_signal_id).single();
      if (error) throw error;
      return { suggestion, signal: existing };
    }
    return { suggestion };
  }

  if (suggestion.step === "driving_forces" || suggestion.step === "find") {
    const signal = await createSignal({
      projectId,
      category: suggestion.category ?? "Social",
      source: suggestion.citation_title ?? "External research",
      title: suggestion.title,
      body: suggestion.body,
      origin: "external_research",
    });
    await scoreOneSignal(projectId, signal.id);
    const { data: scoredSignal, error: scoredSignalError } = await supabase.from("signals").select("*").eq("id", signal.id).single();
    if (scoredSignalError) throw scoredSignalError;

    const { data: updatedSuggestion, error: updateError } = await supabase
      .from("research_suggestions")
      .update({ status: "confirmed", confirmed_signal_id: signal.id })
      .eq("id", id)
      .select()
      .single();
    if (updateError) throw updateError;

    revalidatePath("/signals");
    return { suggestion: updatedSuggestion, signal: scoredSignal };
  }

  // key_forces — create a sources row for provenance (same shape addNewsItemToSignals uses for
  // a promoted news item), then a single insights row, rather than routing back through
  // extractInsightsForProject: the scan call already produced the classified, cited candidate
  // directly, so re-extracting from its own summary would just be re-deriving what's already
  // known.
  const { data: insertedSource, error: sourceError } = await supabase
    .from("sources")
    .insert({
      project_id: projectId,
      name: suggestion.title,
      type: "external_research" as const,
      status: "complete" as const,
      storage_url: suggestion.citation_url,
      extracted_text: suggestion.body,
      uploaded_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("id")
    .single();
  if (sourceError) throw sourceError;

  const { data: insertedInsight, error: insightError } = await supabase
    .from("insights")
    .insert({
      project_id: projectId,
      source_id: insertedSource.id,
      text: suggestion.body,
      actor_type: suggestion.actor_type,
      category: "local_actor",
      confidence: "medium",
      source_type: "Web",
    })
    .select("id")
    .single();
  if (insightError) throw insightError;

  const { data: updatedSuggestion, error: updateError } = await supabase
    .from("research_suggestions")
    .update({ status: "confirmed", confirmed_insight_id: insertedInsight.id })
    .eq("id", id)
    .select()
    .single();
  if (updateError) throw updateError;

  revalidatePath("/knowledge");
  return { suggestion: updatedSuggestion };
}

export async function dismissResearchSuggestion(projectId: string, id: string): Promise<void> {
  const supabase = createClient();
  await getOwnSuggestion(projectId, id); // 404s if it's not this project's row
  const { error } = await supabase.from("research_suggestions").update({ status: "dismissed" }).eq("id", id).eq("project_id", projectId);
  if (error) throw error;
  revalidatePath("/knowledge");
  revalidatePath("/signals");
}
