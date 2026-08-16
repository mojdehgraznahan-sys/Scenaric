"use server";

// Matrix's "Ask AI" — a fixed task menu (ask-ai.tsx's context="matrix" branch), never freeform.
// Step 4 (Rank forces) is closed-book per SCHWARTZ_METHODOLOGY_SKILL.md's research-mode table
// ("Research calls never happen inside steps 4-7... even opportunistically") — none of these
// tasks attach webSearch. Two of the six Ask AI prompts are backed here; the other two
// ("Are my two selected axes truly independent?") reuses ai-matrix.ts's checkAxisIndependence
// directly rather than duplicating an independence-check prompt.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import type { MatrixBucket } from "@/lib/matrix-mapping";

const STEEP_CATEGORIES = ["Social", "Technology", "Economic", "Ecological", "Political"] as const;
const LOCAL_ACTOR_TYPES = ["competitor", "regulator", "customer", "supplier", "partner", "internal_capability"] as const;

// ─────────────────────── "Why is this signal a critical uncertainty?" ───────────────────────
// Scoped to the selected dot. Narrates the bucket/rationale classifyMatrixBuckets/
// reclassifySignal (ai-matrix.ts) already computed and persisted — never re-derives a fresh
// judgment, so this can never disagree with what the dot's own bucket actually is.

const ExplainDotSchema = z.object({ explanation: z.string() });

const EXPLAIN_DOT_TASK_PROMPT = `Task: Narrate, in 2-3 plain sentences, why this signal landed in
its current Rank Forces bucket — grounded strictly in its already-computed impact/uncertainty
scores and bucket_rationale below. Do not re-judge the bucket or second-guess it; your job is to
explain the existing classification clearly, not produce a new one.

Input: { signal: {title, body, category}, bucket: "critical_uncertainty"|"predetermined"|
  "background"|"wildcard", bucket_rationale: string, impact: number(1-5), uncertainty: "Low"|
  "Medium"|"High" }

Rules:
- Reference the actual impact/uncertainty values and bucket_rationale content — never a generic
  statement like "this signal seems important."
- If the bucket is "critical_uncertainty", explicitly note it's eligible as a scenario axis; if
  "predetermined", note it holds across all 4 scenarios; if "wildcard", note it's a shock and
  never axis-eligible; if "background", note why it doesn't rise to critical/predetermined.

Output schema: { explanation: string }`;

export interface ExplainDotResult {
  bucket: MatrixBucket;
  explanation: string;
}

export async function explainSelectedDot(projectId: string, signalId: string): Promise<ExplainDotResult> {
  const supabase = createClient();

  const { data: signal, error: signalError } = await supabase
    .from("signals")
    .select("title, body, category, impact, uncertainty")
    .eq("id", signalId)
    .single();
  if (signalError) throw signalError;

  const { data: dot, error: dotError } = await supabase
    .from("matrix_dots")
    .select("bucket, bucket_rationale")
    .eq("project_id", projectId)
    .eq("signal_id", signalId)
    .single();
  if (dotError) throw dotError;
  if (!dot.bucket) throw new Error("This signal hasn't been classified into a Rank Forces bucket yet.");

  const output = await runStructured({
    step: "matrix_ask_ai.explain_dot",
    projectId,
    taskPrompt: EXPLAIN_DOT_TASK_PROMPT,
    input: {
      signal: { title: signal.title, body: signal.body, category: signal.category },
      bucket: dot.bucket,
      bucket_rationale: dot.bucket_rationale,
      impact: signal.impact,
      uncertainty: signal.uncertainty,
    },
    schema: ExplainDotSchema,
    effort: "low",
  });

  return { bucket: dot.bucket, explanation: output.explanation };
}

// ─────────────────────── "What am I missing?" ───────────────────────
// Coverage gaps across STEEP categories (signals) and local-actor types (insights,
// category='local_actor') — the same taxonomy ai-research-suggestions.ts's local-force scan
// already uses. Judges relevance to the focal question rather than mechanically flagging every
// zero-count bucket.

const CoverageGapsSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  gaps: z
    .array(
      z.object({
        area: z.string(),
        reason: z.string(),
      })
    )
    .max(6),
});

const COVERAGE_GAPS_TASK_PROMPT = `Task: Given this project's current signal coverage across the 5
STEEP categories and local-actor types, identify which categories/types are genuinely
underrepresented AND relevant to the focal question — not just mechanically empty.

Input: { focal_question: string, industry: string,
  steep_counts: { Social: number, Technology: number, Economic: number, Ecological: number,
    Political: number },
  local_actor_counts: { competitor: number, regulator: number, customer: number,
    supplier: number, partner: number, internal_capability: number } }

Rules:
- Only flag an area if it's both low-count AND plausibly relevant to the focal question/
  industry given — a genuinely low-relevance category (e.g. Ecological for a pure software
  licensing decision) should NOT be flagged just because its count is low.
- \`reason\` must explain WHY that gap matters to this specific focal question, not a generic
  "you should add more signals here."
- If coverage already looks reasonably balanced relative to the focal question, return
  sufficient_evidence:false and a gap explaining that, rather than inventing a gap to look
  complete.
- Cap at 6 flagged areas.

Output schema: { sufficient_evidence: boolean, gap: string | null,
  gaps: [{ area: string, reason: string }] }`;

export interface CoverageGapsResult {
  sufficientEvidence: boolean;
  gap: string | null;
  gaps: { area: string; reason: string }[];
}

export async function findCoverageGaps(projectId: string): Promise<CoverageGapsResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, industry")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const [{ data: signals, error: signalsError }, { data: insights, error: insightsError }] = await Promise.all([
    supabase.from("signals").select("category").eq("project_id", projectId),
    supabase.from("insights").select("actor_type").eq("project_id", projectId).eq("category", "local_actor"),
  ]);
  if (signalsError) throw signalsError;
  if (insightsError) throw insightsError;

  const steepCounts = Object.fromEntries(STEEP_CATEGORIES.map((c) => [c, signals.filter((s) => s.category === c).length]));
  const localActorCounts = Object.fromEntries(LOCAL_ACTOR_TYPES.map((t) => [t, insights.filter((i) => i.actor_type === t).length]));

  const output = await runStructured({
    step: "matrix_ask_ai.coverage_gaps",
    projectId,
    taskPrompt: COVERAGE_GAPS_TASK_PROMPT,
    input: {
      focal_question: project.refined_focal_question ?? project.focal_question,
      industry: project.industry,
      steep_counts: steepCounts,
      local_actor_counts: localActorCounts,
    },
    schema: CoverageGapsSchema,
    effort: "medium",
  });

  return { sufficientEvidence: output.sufficient_evidence, gap: output.gap, gaps: output.gaps };
}

// ─────────────────────── "Suggest an alternate axis pair" ───────────────────────
// Hard constraint (SCHWARTZ_METHODOLOGY_SKILL.md): axes must come from the critical_uncertainty
// bucket only — this task's input is restricted to that bucket, server-side, before the model
// ever sees a candidate list. Diagnostic-only: never writes/auto-applies an axis change —
// changing axes stays the job of Matrix's own pick/Re-axis UI.

const AlternateAxisPairSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  pair: z
    .object({
      signal_a_id: z.string(),
      signal_b_id: z.string(),
    })
    .nullable(),
  rationale: z.string().nullable(),
});

const ALTERNATE_AXIS_PAIR_TASK_PROMPT = `Task: Propose an alternative candidate scenario-axis pair,
different from the current pick, that might be more decision-relevant to the focal question.

Input: { focal_question: string, current_pair_titles: string[],
  candidates: [{ signal_id: string, title: string, body: string, category: string,
    impact: number, uncertainty: "High" }] /* every candidate is ALREADY critical_uncertainty-
    bucketed — never propose anything outside this list */ }

Rules:
- pair.signal_a_id/signal_b_id MUST be two DIFFERENT real signal_ids copied verbatim from
  \`candidates\` — never invented, never the current pair, never a signal from any other bucket.
- rationale must explain why this pairing could surface a more decision-relevant set of futures
  than the current pick for THIS focal question — not a generic "these are also important."
- If fewer than 2 usable alternates exist, or none form a genuinely better pairing, return
  sufficient_evidence:false, pair:null, rationale:null, and a gap explaining why.
- This is a suggestion only — never imply it has been applied.

Output schema: { sufficient_evidence: boolean, gap: string | null,
  pair: { signal_a_id: string, signal_b_id: string } | null, rationale: string | null }`;

export interface AlternateAxisPairResult {
  sufficientEvidence: boolean;
  gap: string | null;
  pair: { signalId: string; title: string }[] | null;
  rationale: string | null;
}

export async function suggestAlternateAxisPair(projectId: string, excludeSignalIds: string[]): Promise<AlternateAxisPairResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  // Two separate queries + a JS-side join by signal_id — same convention matrix.ts's
  // fetchScoredSignalsWithDots already uses, rather than a Supabase FK-embed select.
  const { data: dots, error: dotsError } = await supabase
    .from("matrix_dots")
    .select("signal_id")
    .eq("project_id", projectId)
    .eq("bucket", "critical_uncertainty");
  if (dotsError) throw dotsError;

  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body, category, impact, uncertainty")
    .in(
      "id",
      dots.map((d) => d.signal_id)
    );
  if (signalsError) throw signalsError;

  type CandidateRow = { id: string; title: string; body: string; category: string; impact: number; uncertainty: string };
  const criticalUncertaintySignals = signals as CandidateRow[];
  const candidates = criticalUncertaintySignals.filter((s) => !excludeSignalIds.includes(s.id));

  if (candidates.length < 2) {
    return {
      sufficientEvidence: false,
      gap: "Fewer than 2 other critical-uncertainty signals exist to propose an alternate pair from.",
      pair: null,
      rationale: null,
    };
  }

  const excludedTitles = criticalUncertaintySignals.filter((s) => excludeSignalIds.includes(s.id)).map((s) => s.title);

  const output = await runStructured({
    step: "matrix_ask_ai.alternate_axis_pair",
    projectId,
    taskPrompt: ALTERNATE_AXIS_PAIR_TASK_PROMPT,
    input: {
      focal_question: project.refined_focal_question ?? project.focal_question,
      current_pair_titles: excludedTitles,
      candidates: candidates.map((c) => ({ signal_id: c.id, title: c.title, body: c.body, category: c.category, impact: c.impact, uncertainty: c.uncertainty })),
    },
    schema: AlternateAxisPairSchema,
    effort: "medium",
  });

  if (!output.sufficient_evidence || !output.pair) {
    return { sufficientEvidence: false, gap: output.gap, pair: null, rationale: null };
  }

  const byId = new Map(candidates.map((c) => [c.id, c.title]));
  const titleA = byId.get(output.pair.signal_a_id);
  const titleB = byId.get(output.pair.signal_b_id);
  // Defensive: the model is instructed to only use real candidate ids, but never trust that
  // blindly — if either id doesn't resolve to a real candidate, treat it as insufficient rather
  // than rendering a broken/half-real pair.
  if (!titleA || !titleB) {
    return { sufficientEvidence: false, gap: "The model proposed a signal outside the critical-uncertainty candidate list.", pair: null, rationale: null };
  }

  return {
    sufficientEvidence: true,
    gap: null,
    pair: [
      { signalId: output.pair.signal_a_id, title: titleA },
      { signalId: output.pair.signal_b_id, title: titleB },
    ],
    rationale: output.rationale,
  };
}

// ─────────────────────── "Explain the predetermined elements" / "Any wildcards?" ───────────
// Shared fetch + summarize helper — same shape, different bucket and framing. Empty bucket
// short-circuits to a plain "none yet" result without an AI call at all, rather than fabricating
// content to look complete.

export interface BucketSummaryResult {
  count: number;
  summary: string;
}

async function summarizeBucket(projectId: string, bucket: "predetermined" | "wildcard", taskStep: string, taskPrompt: string): Promise<BucketSummaryResult> {
  const supabase = createClient();

  const { data: dots, error: dotsError } = await supabase
    .from("matrix_dots")
    .select("signal_id, bucket_rationale")
    .eq("project_id", projectId)
    .eq("bucket", bucket);
  if (dotsError) throw dotsError;

  if (dots.length === 0) {
    return { count: 0, summary: bucket === "predetermined" ? "No predetermined forces yet." : "No wildcards yet." };
  }

  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, category, body")
    .in(
      "id",
      dots.map((d) => d.signal_id)
    );
  if (signalsError) throw signalsError;

  const rationaleBySignalId = new Map(dots.map((d) => [d.signal_id, d.bucket_rationale]));
  const items = signals.map((s) => ({ signal: s, bucket_rationale: rationaleBySignalId.get(s.id) ?? null }));

  const SummarySchema = z.object({ summary: z.string() });
  const output = await runStructured({
    step: taskStep,
    projectId,
    taskPrompt,
    input: {
      signals: items.map((i) => ({ title: i.signal.title, category: i.signal.category, body: i.signal.body, bucket_rationale: i.bucket_rationale })),
    },
    schema: SummarySchema,
    effort: "medium",
  });

  return { count: items.length, summary: output.summary };
}

const PREDETERMINED_TASK_PROMPT = `Task: Summarize this project's predetermined-bucketed signals
in 2-4 sentences, grounded strictly in the given signals and their bucket_rationale — explain
WHY each will hold constant across all 4 scenarios regardless of which axis pair is chosen
(Schwartz's hard constraint: predetermined elements must never contradict any one scenario's
logic).

Input: { signals: [{ title, category, body, bucket_rationale }] }

Rules:
- Reference the actual signal titles and their bucket_rationale — never a generic statement.
- Never invent a signal not in the list.

Output schema: { summary: string }`;

const WILDCARD_TASK_PROMPT = `Task: Summarize this project's wildcard-bucketed signals in 2-4
sentences, grounded strictly in the given signals and their bucket_rationale — for each, surface
the discrete shock mechanism (the sudden, low-probability, high-consequence event) that makes it
a wildcard rather than a continuous trend.

Input: { signals: [{ title, category, body, bucket_rationale }] }

Rules:
- Reference the actual signal titles and their bucket_rationale — never a generic statement.
- Never invent a signal not in the list.

Output schema: { summary: string }`;

export async function explainPredeterminedElements(projectId: string): Promise<BucketSummaryResult> {
  return summarizeBucket(projectId, "predetermined", "matrix_ask_ai.predetermined_elements", PREDETERMINED_TASK_PROMPT);
}

export async function explainWildcards(projectId: string): Promise<BucketSummaryResult> {
  return summarizeBucket(projectId, "wildcard", "matrix_ask_ai.wildcards", WILDCARD_TASK_PROMPT);
}
