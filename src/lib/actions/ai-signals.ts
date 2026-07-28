"use server";

// §6 — Step 3: Driving forces (build order §14 item 4c Phase 2). Three calls:
// suggestSignals (candidate generation from insights), scoreUnscoredSignals
// (impact/uncertainty scoring for any signal missing either), and suggestSignalCategory
// (single-item STEEP classification, used to pre-fill the category field when drafting a
// new signal from a Knowledge Base insight — see page-signals.tsx's merge-into-signal
// flow). Fires from the Signals Library's "Suggest signals" button, manually per-signal
// via the "Score" action, or automatically when the merge modal opens.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runStructured, AIGenerationFailedError } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { SteepCategory } from "./signals";

export type SignalRow = Database["public"]["Tables"]["signals"]["Row"];

const SuggestSignalsSchema = z.object({
  signals: z
    .array(
      z.object({
        title: z.string(),
        body: z.string(),
        category: z.enum(["Social", "Technology", "Economic", "Ecological", "Political"]),
        source: z.string(),
        grounded_in: z.array(z.string()),
        origin: z.enum(["insight", "external_pattern"]),
      })
    )
    .max(6),
});

const SUGGEST_TASK_PROMPT = `Task: Convert local insights + the focal question into STEEP-classified
driving-force signals, each representing ONE distinct macro uncertainty
the scenario set must consider.

Input: { focal_question: string, horizon: string, industry: string,
         insights: [{id, text, actor_type}], existing_signals: [{id,title,category}] }

Rules:
- Every new signal must be grounded_in >= 1 insight id, OR explicitly
  flagged \`origin:"external_pattern"\` if it names a well-established
  macro trend for this industry/horizon not present in insights (allowed,
  but must be flagged, never presented as sourced from the user's data).
- Do NOT propose a signal that duplicates an existing_signals title or
  underlying uncertainty — check semantic overlap, not just exact text.
- Each signal needs exactly one STEEP category: Social, Technology,
  Economic, Ecological, or Political.
- Write \`title\` as a factual trend statement (<=8 words), \`body\` as a
  2-sentence explanation of the mechanism connecting it to the focal
  question, and cite \`source\` as the real originating source name
  (e.g. "Internal interview — Jan Oosterom") — never a fabricated
  publication name.
- Cap at 6 new signals per call.

Output schema:
{ signals: [{ title, body, category, source, grounded_in: string[],
              origin: "insight"|"external_pattern" }] }`;

const ScoreSignalSchema = z.object({
  impact: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  uncertainty: z.enum(["Low", "Medium", "High"]),
  rationale: z.string(),
});

const SCORE_TASK_PROMPT = `Task: Score ONE signal on Schwartz's two axes used for the ranking matrix:
IMPACT (how much would this reshape the focal decision if it occurred)
and UNCERTAINTY (how unpredictable is its outcome/direction).

Input: { focal_question, signal: {title, body, category} }

Rubric (apply literally, do not freelance a different scale):
Impact 1 = negligible effect on the decision; 5 = would overturn the
strategy entirely.
Uncertainty Low = outcome is largely predetermined/trending;
Medium = plausible range of outcomes, some predictability;
High = genuinely unknowable direction today.

Output schema:
{ impact: 1|2|3|4|5, uncertainty: "Low"|"Medium"|"High",
  rationale: string /* one sentence, cites the mechanism, not a vibe */ }`;

export interface SuggestSignalsResult {
  created: number;
  signals: SignalRow[];
}

export async function suggestSignals(projectId: string): Promise<SuggestSignalsResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, horizon, industry")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  const { data: insights, error: insightsError } = await supabase
    .from("insights")
    .select("id, text, actor_type")
    .eq("project_id", projectId);
  if (insightsError) throw insightsError;

  const { data: existingSignals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, category")
    .eq("project_id", projectId);
  if (signalsError) throw signalsError;

  const output = await runStructured({
    step: "signals.suggest",
    projectId,
    taskPrompt: SUGGEST_TASK_PROMPT,
    input: {
      focal_question: focalQuestion,
      horizon: project.horizon,
      industry: project.industry,
      insights: insights.map((i) => ({ id: i.id, text: i.text, actor_type: i.actor_type })),
      existing_signals: existingSignals.map((s) => ({ id: s.id, title: s.title, category: s.category })),
    },
    schema: SuggestSignalsSchema,
    effort: "medium",
  });

  if (output.signals.length === 0) return { created: 0, signals: [] };

  const { data: inserted, error: insertError } = await supabase
    .from("signals")
    .insert(
      output.signals.map((s) => ({
        project_id: projectId,
        category: s.category,
        source: s.source,
        title: s.title,
        body: s.body,
        origin: s.origin,
      }))
    )
    .select();
  if (insertError) throw insertError;

  // A single multi-row INSERT...RETURNING preserves input order, so output.signals[i]
  // corresponds to inserted[i]. Never grounded for "external_pattern" signals — those are
  // explicitly not insight-sourced. Link-row failures (e.g. a hallucinated insight id
  // that fails the FK constraint) are logged, not thrown — the signals themselves already
  // inserted successfully and shouldn't be undone by a grounding-metadata problem.
  const linkRows = output.signals.flatMap((s, i) =>
    s.origin === "insight" ? s.grounded_in.map((insightId) => ({ project_id: projectId, signal_id: inserted[i].id, insight_id: insightId })) : []
  );
  if (linkRows.length > 0) {
    const { error: linkError } = await supabase.from("signal_insight_links").insert(linkRows);
    if (linkError) console.error("[ai-signals] failed to persist grounded_in links", linkError);
  }

  revalidatePath("/signals");
  return { created: inserted.length, signals: inserted };
}

export interface ScoreSignalsResult {
  scored: number;
  failures: { signalId: string; title: string }[];
}

// Shared by scoreUnscoredSignals (batch) and scoreOneSignal (single-item, called right
// after a signal is created — see store.tsx's createSignal, which fires this
// fire-and-forget so "Add Signal"/merge-into-signal submit stays instant).
async function scoreSignalRow(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  focalQuestion: string,
  signal: { id: string; title: string; body: string; category: string }
): Promise<void> {
  const output = await runStructured({
    step: "signals.score",
    projectId,
    taskPrompt: SCORE_TASK_PROMPT,
    input: { focal_question: focalQuestion, signal: { title: signal.title, body: signal.body, category: signal.category } },
    schema: ScoreSignalSchema,
    effort: "low",
  });
  const { error } = await supabase.from("signals").update({ impact: output.impact, uncertainty: output.uncertainty }).eq("id", signal.id);
  if (error) throw error;
}

export async function scoreOneSignal(projectId: string, signalId: string): Promise<void> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  const { data: signal, error: signalError } = await supabase
    .from("signals")
    .select("id, title, body, category")
    .eq("id", signalId)
    .single();
  if (signalError) throw signalError;

  await scoreSignalRow(supabase, projectId, focalQuestion, signal);
  revalidatePath("/signals");
}

export async function scoreUnscoredSignals(projectId: string): Promise<ScoreSignalsResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  const { data: unscored, error: unscoredError } = await supabase
    .from("signals")
    .select("id, title, body, category")
    .eq("project_id", projectId)
    .or("impact.is.null,uncertainty.is.null");
  if (unscoredError) throw unscoredError;

  const result: ScoreSignalsResult = { scored: 0, failures: [] };

  for (const signal of unscored) {
    try {
      await scoreSignalRow(supabase, projectId, focalQuestion, signal);
      result.scored += 1;
    } catch (err) {
      if (err instanceof AIGenerationFailedError) {
        result.failures.push({ signalId: signal.id, title: signal.title });
      } else {
        throw err;
      }
    }
  }

  revalidatePath("/signals");
  return result;
}

const CategorizeSignalSchema = z.object({
  category: z.enum(["Social", "Technology", "Economic", "Ecological", "Political"]),
  rationale: z.string(),
});

const CATEGORIZE_TASK_PROMPT = `Task: Classify ONE piece of extracted evidence (an insight being
turned into a Signal) into Schwartz's STEEP taxonomy — the macro-environmental
category that best fits the underlying uncertainty it represents.

Input: { focal_question: string, text: string }

Rubric (apply literally, do not freelance a different scale):
- Social: demographic, cultural, behavioral, or lifestyle shifts.
- Technology: technical capability, infrastructure, or innovation shifts.
- Economic: market, pricing, capital, or macroeconomic shifts.
- Ecological: environmental, climate, or resource shifts.
- Political: regulatory, policy, or geopolitical shifts.
Pick exactly one — the single best fit, even if more than one plausibly applies.

Output schema:
{ category: "Social"|"Technology"|"Economic"|"Ecological"|"Political",
  rationale: string /* one sentence, cites the mechanism, not a vibe */ }`;

export interface SuggestCategoryResult {
  category: SteepCategory;
  rationale: string;
}

export async function suggestSignalCategory(input: { projectId: string; text: string }): Promise<SuggestCategoryResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  const output = await runStructured({
    step: "signals.categorize",
    projectId: input.projectId,
    taskPrompt: CATEGORIZE_TASK_PROMPT,
    input: { focal_question: focalQuestion, text: input.text },
    schema: CategorizeSignalSchema,
    effort: "low",
  });

  return output;
}
