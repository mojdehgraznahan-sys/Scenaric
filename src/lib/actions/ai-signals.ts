"use server";

// §6 — Step 3: Driving forces (build order §14 item 4c Phase 2). Two calls:
// suggestSignals (candidate generation from insights) and scoreUnscoredSignals
// (impact/uncertainty scoring for any signal missing either). Fires from the Signals
// Library's "Suggest signals" button, or manually per-signal via the "Score" action.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runStructured, AIGenerationFailedError } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

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

  revalidatePath("/signals");
  return { created: inserted.length, signals: inserted };
}

export interface ScoreSignalsResult {
  scored: number;
  failures: { signalId: string; title: string }[];
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
      const output = await runStructured({
        step: "signals.score",
        projectId,
        taskPrompt: SCORE_TASK_PROMPT,
        input: {
          focal_question: focalQuestion,
          signal: { title: signal.title, body: signal.body, category: signal.category },
        },
        schema: ScoreSignalSchema,
        effort: "low",
      });

      const { error: updateError } = await supabase
        .from("signals")
        .update({ impact: output.impact, uncertainty: output.uncertainty })
        .eq("id", signal.id);
      if (updateError) throw updateError;
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
