"use server";

// Signals "Ask AI" Group 3 "Rank" (SIGNALS_ASK_AI_PROMPTS.md) — Step 4, closed-book, temp=0
// (this codebase's "no literal temperature knob" convention: effort:"low", thinking:false,
// never webSearch — see ai/client.ts's RESEARCH_MODE_ALLOWED_STEPS, which deliberately omits
// every signals.rank.* step so the runtime guard blocks any accidental web call).
//
// 3.1/3.2 (score impact/uncertainty) stage into signal_score_proposals
// (0036_signal_score_proposals.sql) rather than writing signals.impact/uncertainty directly —
// "Scores are proposals... The user confirms before the Matrix reads them." scoreSignalRow
// (ai-signals.ts) still writes directly for the pre-existing single-signal/unscored-batch flow;
// that's untouched. 3.3/3.4 (critical uncertainties, predetermined elements) are read-only
// analysis over already-confirmed scores — no proposal rows, ephemeral drawer output only.
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { NotFoundError } from "@/lib/ai/errors";
import { createClient } from "@/lib/supabase/server";
import { buildSignalsContext, type SignalsContextSignal } from "./signals-context";
import type { Database } from "@/lib/supabase/types";

export type SignalScoreProposalRow = Database["public"]["Tables"]["signal_score_proposals"]["Row"];

// Keeps each runStructured call's JSON response well clear of maxTokens — a mature project's
// full signal set (30-50+) scored in one call risks truncated/invalid JSON. Every chunk of one
// run shares one batch_id so the review UI still treats it as one reviewable unit.
const CHUNK_SIZE = 20;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface RunRankResult {
  batchId: string | null;
  proposalsCreated: number;
}

// ---- 3.1 "Score impact against my actual decision" ----
const RankImpactItemSchema = z.object({
  signal_id: z.string(),
  impact: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  rationale: z.string(),
});
const RankImpactSchema = z.object({
  scores: z.array(RankImpactItemSchema),
  least_confident_signal_ids: z.array(z.string()).max(3),
});

const RANK_IMPACT_TASK_PROMPT = `Task: Score every given signal on IMPACT, defined strictly as
how much this force's resolution would change the answer to the focal question — NOT general
industry importance. A force can be enormous in the sector and low-impact for this specific
decision; score that honestly when it's the case.

Input: { focal_question: string, decision_owner: string | null, stakes: string | null,
         signals: [{ id: string, title: string, body: string, category: string }] }

Rules:
- Score 1-5: 1 = negligible effect on THIS decision, 5 = would overturn the strategy entirely.
- \`rationale\` is one sentence citing which part of the focal question (or, when given,
  decision_owner/stakes) the impact bears on — never a generic industry-importance claim.
- Score every signal given — no omissions.
- List up to 3 signal ids you're least confident about in least_confident_signal_ids.

Output schema:
{ scores: [{ signal_id: string, impact: 1|2|3|4|5, rationale: string }],
  least_confident_signal_ids: string[] }`;

export async function runRankImpact(projectId: string): Promise<RunRankResult> {
  const ctx = await buildSignalsContext(projectId);
  if (ctx.signals.length === 0) return { batchId: null, proposalsCreated: 0 };

  const batchId = randomUUID();
  const supabase = createClient();
  let created = 0;

  for (const batch of chunk(ctx.signals, CHUNK_SIZE)) {
    const output = await runStructured({
      step: "signals.rank.impact",
      projectId,
      taskPrompt: RANK_IMPACT_TASK_PROMPT,
      input: {
        focal_question: ctx.focalQuestion,
        decision_owner: ctx.onboarding?.owner ?? null,
        stakes: ctx.onboarding?.stakes ?? null,
        signals: batch.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category })),
      },
      schema: RankImpactSchema,
      effort: "low",
      batchId,
      maxTokens: 6000,
    });

    const leastConfident = new Set(output.least_confident_signal_ids);
    const { error } = await supabase.from("signal_score_proposals").upsert(
      output.scores.map((s) => ({
        project_id: projectId,
        signal_id: s.signal_id,
        dimension: "impact" as const,
        proposed_impact: s.impact,
        rationale: s.rationale,
        low_confidence: leastConfident.has(s.signal_id),
        batch_id: batchId,
      })),
      { onConflict: "signal_id,dimension,batch_id" }
    );
    if (error) throw error;
    created += output.scores.length;
  }

  return { batchId, proposalsCreated: created };
}

// ---- 3.2 "Score uncertainty honestly" ----
const RankUncertaintyItemSchema = z.object({
  signal_id: z.string(),
  uncertainty: z.enum(["Low", "Medium", "High"]),
  rationale: z.string(),
  disagrees_with_user: z.boolean(),
  disagreement_note: z.string().nullable(),
});
const RankUncertaintySchema = z.object({
  scores: z.array(RankUncertaintyItemSchema),
});

const RANK_UNCERTAINTY_TASK_PROMPT = `Task: Score every given signal on UNCERTAINTY over the
stated horizon — how unpredictable the DIRECTION of its resolution is within that window
specifically, not how volatile it looks day-to-day.

Input: { horizon: string,
         given: string | null /* what the user considers effectively inevitable — TEST this
           claim against each signal's own evidence, don't just accept it */,
         open: string | null /* what the user considers genuinely uncertain — test this too,
           in the other direction */,
         signals: [{ id: string, title: string, body: string, category: string }] }

Rules:
- Low = outcome is largely predetermined/trending in one direction over the horizon (even if
  volatile short-term — that alone is not High). Medium = plausible range of outcomes, some
  predictability. High = genuinely unknowable direction today.
- If a signal is plausibly what \`given\` refers to, test the claim: if it's actually
  contestable over the horizon despite the user calling it inevitable, score it honestly and
  set disagrees_with_user:true with disagreement_note explaining why. Same check in the other
  direction for \`open\` (scores as more determined than the user thinks).
- disagrees_with_user is false for any signal not clearly tied to given/open, or where your
  score matches the user's framing.
- Score every signal given — no omissions.

Output schema:
{ scores: [{ signal_id: string, uncertainty: "Low"|"Medium"|"High", rationale: string,
             disagrees_with_user: boolean, disagreement_note: string | null }] }`;

export async function runRankUncertainty(projectId: string): Promise<RunRankResult> {
  const ctx = await buildSignalsContext(projectId);
  if (ctx.signals.length === 0) return { batchId: null, proposalsCreated: 0 };

  const batchId = randomUUID();
  const supabase = createClient();
  let created = 0;

  for (const batch of chunk(ctx.signals, CHUNK_SIZE)) {
    const output = await runStructured({
      step: "signals.rank.uncertainty",
      projectId,
      taskPrompt: RANK_UNCERTAINTY_TASK_PROMPT,
      input: {
        horizon: ctx.horizon,
        given: ctx.onboarding?.given ?? null,
        open: ctx.onboarding?.open ?? null,
        signals: batch.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category })),
      },
      schema: RankUncertaintySchema,
      effort: "low",
      batchId,
      maxTokens: 6000,
    });

    const { error } = await supabase.from("signal_score_proposals").upsert(
      output.scores.map((s) => ({
        project_id: projectId,
        signal_id: s.signal_id,
        dimension: "uncertainty" as const,
        proposed_uncertainty: s.uncertainty,
        rationale: s.rationale,
        low_confidence: false,
        disagrees_with_user_classification: s.disagrees_with_user ? s.disagreement_note : null,
        batch_id: batchId,
      })),
      { onConflict: "signal_id,dimension,batch_id" }
    );
    if (error) throw error;
    created += output.scores.length;
  }

  return { batchId, proposalsCreated: created };
}

// ---- 3.3 "Find my critical uncertainties" — read-only, no proposal rows ----
// The high-impact/high-uncertainty shortlist is computed deterministically client-side (impact
// 4-5 AND uncertainty High on already-CONFIRMED scores) rather than asked of the model — cheaper
// and consistent every run; the model's job is the stress-test reasoning over that fixed set.
interface CriticalAxis {
  signalId: string;
  title: string;
}
interface CriticalPair {
  axisA: CriticalAxis;
  axisB: CriticalAxis;
  reasoning: string;
}
export interface RunRankCriticalUncertaintiesResult {
  shortlist: CriticalAxis[];
  recommendedPair: CriticalPair | null;
  runnerUpPair: CriticalPair | null;
  notes: string | null;
  gap: string | null;
}

const CriticalAxisSchema = z.object({ signal_id: z.string(), title: z.string() });
const CriticalPairSchema = z.object({ axis_a: CriticalAxisSchema, axis_b: CriticalAxisSchema, reasoning: z.string() });
const RankCriticalUncertaintiesSchema = z.object({
  recommended_pair: CriticalPairSchema.nullable(),
  runner_up_pair: CriticalPairSchema.nullable(),
  notes: z.string().nullable(),
  gap: z.string().nullable(),
});

const RANK_CRITICAL_UNCERTAINTIES_TASK_PROMPT = `Task: The given candidates already sit in the
high-impact/high-uncertainty quadrant. Stress-test them as potential scenario axes and
recommend a pair.

Input: { focal_question: string,
         candidates: [{ id: string, title: string, body: string, category: string,
                         impact: number, uncertainty: string }] }

Rules:
- Evaluate: which candidate pairs are genuinely independent vs correlated enough to collapse
  into one effective axis; which are phrased as a spectrum with two nameable poles vs a binary
  yes/no needing rewording; whether a candidate pair actually discriminates between
  meaningfully different futures for focal_question, or all four quadrants would imply the
  same decision.
- Recommend exactly one axis pair (recommended_pair) and one runner-up pair (runner_up_pair),
  each reasoning grounded in the stress-test above, drawn only from the given candidates.
- If no pair among the candidates is defensible yet, set both pairs to null and explain why in
  \`gap\`.
- \`notes\` carries any stress-test commentary that doesn't belong inside a specific pair's
  reasoning (e.g. why a third candidate was passed over).
- In \`reasoning\` and \`notes\`, refer to signals by their title only — signal_id is only ever
  for the axis_a/axis_b id fields, never mentioned in the prose itself.

Output schema:
{ recommended_pair: { axis_a: {signal_id,title}, axis_b: {signal_id,title}, reasoning: string } | null,
  runner_up_pair: (same shape) | null,
  notes: string | null, gap: string | null }`;

function toCriticalPair(p: z.infer<typeof CriticalPairSchema> | null): CriticalPair | null {
  if (!p) return null;
  return {
    axisA: { signalId: p.axis_a.signal_id, title: p.axis_a.title },
    axisB: { signalId: p.axis_b.signal_id, title: p.axis_b.title },
    reasoning: p.reasoning,
  };
}

export async function runRankCriticalUncertainties(projectId: string): Promise<RunRankCriticalUncertaintiesResult> {
  const ctx = await buildSignalsContext(projectId);
  const candidates: SignalsContextSignal[] = ctx.signals.filter((s) => s.impact != null && s.impact >= 4 && s.uncertainty === "High");

  if (candidates.length < 2) {
    return {
      shortlist: candidates.map((s) => ({ signalId: s.id, title: s.title })),
      recommendedPair: null,
      runnerUpPair: null,
      notes: null,
      gap: "Fewer than 2 signals are currently scored high-impact/high-uncertainty — confirm more scores from \"Score impact\"/\"Score uncertainty\" first.",
    };
  }

  const output = await runStructured({
    step: "signals.rank.critical_uncertainties",
    projectId,
    taskPrompt: RANK_CRITICAL_UNCERTAINTIES_TASK_PROMPT,
    input: { focal_question: ctx.focalQuestion, candidates },
    schema: RankCriticalUncertaintiesSchema,
    effort: "medium",
    maxTokens: 4096,
  });

  return {
    shortlist: candidates.map((s) => ({ signalId: s.id, title: s.title })),
    recommendedPair: toCriticalPair(output.recommended_pair),
    runnerUpPair: toCriticalPair(output.runner_up_pair),
    notes: output.notes,
    gap: output.gap,
  };
}

// ---- 3.4 "Check my predetermined elements" — read-only, no proposal rows ----
// Candidates (uncertainty Low AND impact 4-5, on already-CONFIRMED scores) are computed
// deterministically client-side, same reasoning as 3.3 above.
export interface RunRankPredeterminedResult {
  elements: {
    signalId: string;
    title: string;
    evidence: string;
    strength: "strong" | "moderate" | "weak";
    failsAllQuadrantsTest: boolean;
    failReason: string | null;
  }[];
}

const RankPredeterminedItemSchema = z.object({
  signal_id: z.string(),
  title: z.string(),
  evidence: z.string(),
  strength: z.enum(["strong", "moderate", "weak"]),
  fails_all_quadrants_test: z.boolean(),
  fail_reason: z.string().nullable(),
});
const RankPredeterminedSchema = z.object({
  elements: z.array(RankPredeterminedItemSchema).max(15),
});

const RANK_PREDETERMINED_TASK_PROMPT = `Task: The given candidates are already scored
low-uncertainty/high-impact — the predetermined elements. Apply the hard test: a predetermined
element must hold true across ALL FOUR scenario quadrants. Any element that only holds in some
futures is not predetermined — it's a critical uncertainty that's been misfiled.

Input: { candidates: [{ id: string, title: string, body: string, category: string,
                         impact: number, uncertainty: string }] }

Rules:
- For every candidate: \`evidence\` states what makes it near-certain over the horizon;
  \`strength\` rates that evidence honestly (strong/moderate/weak) — never inflate weak
  evidence to look complete.
- Apply the four-quadrant test to every candidate. Set fails_all_quadrants_test:true and
  explain in fail_reason for any that only holds in some futures — surface these, do not
  silently drop them.
- Cover every candidate given — no omissions.

Output schema:
{ elements: [{ signal_id: string, title: string, evidence: string,
               strength: "strong"|"moderate"|"weak", fails_all_quadrants_test: boolean,
               fail_reason: string | null }] }`;

export async function runRankPredetermined(projectId: string): Promise<RunRankPredeterminedResult> {
  const ctx = await buildSignalsContext(projectId);
  const candidates: SignalsContextSignal[] = ctx.signals.filter((s) => s.uncertainty === "Low" && s.impact != null && s.impact >= 4);

  if (candidates.length === 0) return { elements: [] };

  const output = await runStructured({
    step: "signals.rank.predetermined",
    projectId,
    taskPrompt: RANK_PREDETERMINED_TASK_PROMPT,
    input: { candidates },
    schema: RankPredeterminedSchema,
    effort: "medium",
    maxTokens: 4096,
  });

  return {
    elements: output.elements.map((e) => ({
      signalId: e.signal_id,
      title: e.title,
      evidence: e.evidence,
      strength: e.strength,
      failsAllQuadrantsTest: e.fails_all_quadrants_test,
      failReason: e.fail_reason,
    })),
  };
}

// ---- Review queue: signal_score_proposals confirm/dismiss (the ONLY place 3.1/3.2 output
// ever reaches signals.impact/signals.uncertainty) ----

export async function listSignalScoreProposals(projectId: string): Promise<SignalScoreProposalRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("signal_score_proposals")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "proposed")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

async function getOwnProposal(projectId: string, id: string): Promise<SignalScoreProposalRow> {
  const supabase = createClient();
  const { data, error } = await supabase.from("signal_score_proposals").select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new NotFoundError(`Signal score proposal ${id} could not be found in project ${projectId}.`);
  return data;
}

export async function confirmSignalScoreProposal(projectId: string, id: string): Promise<void> {
  const supabase = createClient();
  const proposal = await getOwnProposal(projectId, id);
  if (proposal.status === "confirmed") return; // idempotent re-click

  const patch = proposal.dimension === "impact" ? { impact: proposal.proposed_impact } : { uncertainty: proposal.proposed_uncertainty };
  const { error: signalError } = await supabase.from("signals").update(patch).eq("id", proposal.signal_id);
  if (signalError) throw signalError;

  const { error } = await supabase.from("signal_score_proposals").update({ status: "confirmed" }).eq("id", id);
  if (error) throw error;
  revalidatePath("/signals");
}

export async function dismissSignalScoreProposal(projectId: string, id: string): Promise<void> {
  const supabase = createClient();
  await getOwnProposal(projectId, id); // 404s if it's not this project's row
  const { error } = await supabase.from("signal_score_proposals").update({ status: "dismissed" }).eq("id", id).eq("project_id", projectId);
  if (error) throw error;
  revalidatePath("/signals");
}

export async function confirmAllSignalScoreProposals(projectId: string, batchId: string): Promise<number> {
  const supabase = createClient();
  const { data: proposals, error } = await supabase
    .from("signal_score_proposals")
    .select("*")
    .eq("project_id", projectId)
    .eq("batch_id", batchId)
    .eq("status", "proposed");
  if (error) throw error;

  for (const p of proposals) {
    const patch = p.dimension === "impact" ? { impact: p.proposed_impact } : { uncertainty: p.proposed_uncertainty };
    const { error: signalError } = await supabase.from("signals").update(patch).eq("id", p.signal_id);
    if (signalError) throw signalError;
  }

  const { error: updateError } = await supabase
    .from("signal_score_proposals")
    .update({ status: "confirmed" })
    .eq("project_id", projectId)
    .eq("batch_id", batchId)
    .eq("status", "proposed");
  if (updateError) throw updateError;

  revalidatePath("/signals");
  return proposals.length;
}

export async function dismissAllInBatch(projectId: string, batchId: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("signal_score_proposals")
    .update({ status: "dismissed" })
    .eq("project_id", projectId)
    .eq("batch_id", batchId)
    .eq("status", "proposed")
    .select("id");
  if (error) throw error;
  revalidatePath("/signals");
  return data.length;
}
