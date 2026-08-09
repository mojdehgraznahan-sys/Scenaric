"use server";

// Strategic Options — product extension (Build Plan §12; SCHWARTZ_METHODOLOGY_SKILL.md's "+"
// row, tile 9 of 9). "Wind-tunnelling" in Shell/GBN terms — never Schwartz's own named step.
// Same table/action split as implications.ts/ai-implications.ts and indicators.ts/
// ai-indicators.ts: plain reads/mutations live in ./strategy.ts, this file is the AI-driven
// generation call. Deterministic/classification-style call (§0 Principle 5's "temperature 0")
// per this step's own spec, resolved the same way as ai-implications.ts/ai-indicators.ts
// already resolve it for this codebase's AI client (no literal temperature knob) —
// effort:"low", thinking:false.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { NotFoundError } from "@/lib/ai/errors";

// Risk is a byproduct of real robust-count data, never a raw model guess (§0 Principle 5) —
// shared with ai-strategy-tasks.ts's stressTestOption, which must re-derive an option's risk
// the exact same way after a stress test flips a score, not with a second, possibly-diverging
// rubric.
export const riskFromRobustCount = (robustCount: number): "Low" | "Medium" | "High" => {
  if (robustCount >= 3) return "Low";
  if (robustCount === 2) return "Medium";
  return "High";
};

const StrategyScoreSchema = z.object({
  scenario_id: z.string(),
  robust: z.boolean(),
  // One sentence, must cite grounded_in — "never a generic 'performs well' with no grounding,"
  // for robust:true AND robust:false alike. Enforced server-side below, not just by the
  // prompt's own instruction.
  rationale: z.string(),
  // Implication ids or predetermined-element (signal) ids from this call's own
  // scenarios[].implications / predetermined_elements lists — never an invented id. Cross-
  // checked against the real id set before insert (see validGroundingIds below).
  grounded_in: z.array(z.string()),
});

const StrategyOptionSchema = z.object({
  name: z.string(),
  notes: z.string(),
  // Exactly one score per each of the project's 4 scenarios.
  scores: z.array(StrategyScoreSchema).length(4),
});

const StrategyOptionsSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  options: z.array(StrategyOptionSchema).min(2).max(4),
});

const STRATEGY_TASK_PROMPT = `Task: Propose strategic options for the focal question and
"wind-tunnel" each one against all 4 of the project's scenarios — does this concrete action
still work if this future happens? This is the product's own extension of Schwartz's method
(standard Shell/GBN "wind-tunnelling" practice), not one of the book's own named steps — never
imply otherwise.

Input: { focal_question: string,
  scenarios: [{ id: string, name: string, logic: string,
    implications: [{ id: string, text: string, category: "capital"|"hiring"|"tech"|"partners"|"other" }] }]
  /* always exactly 4 */,
  predetermined_elements: [{ id: string, title: string, body: string }]
  /* signals that hold true across ALL 4 scenarios — may be empty */ }

Rules:
- Propose 2-4 strategic options. Each must be a concrete, actionable operating/investment choice
  the organization could take now (a real market-entry mode, partnership structure, capability
  investment, etc.) — never a restated goal ("succeed in all markets") and never phrased as a
  scenario or a prediction.
- For EACH option, produce exactly one score against EACH of the 4 given scenarios — 4 score
  entries per option, one scenario_id matching each input scenario id, no duplicates, none
  omitted.
- Every score's rationale must be one sentence and grounded_in must cite at least one real id
  from this input's scenarios[].implications or predetermined_elements — never an invented id.
  This applies to robust:true AND robust:false judgments alike: "performs well" or "doesn't fit"
  with no cited mechanism is not acceptable in either direction.
- Judge robust:true only when the option's actual mechanism is explicitly supported by (or does
  not conflict with) the cited implication/predetermined element; judge robust:false when the
  cited implication/predetermined element describes a condition the option's mechanism could not
  survive or exploit.
- If truly nothing in a given scenario's implications or the predetermined elements grounds a
  judgment for an option, do not fabricate a citation — omit that scenario's score for that
  option instead (the option will then have fewer than 4 scores and will be rejected downstream
  by a separate, deterministic check; that is expected and correct, not something to route
  around by inventing grounding).
- Score honestly — do not pre-filter or self-censor based on how many scenarios an option ends up
  robust in. A separate, deterministic process (not you) decides afterward whether an option with
  0 or all 4 robust scores gets rejected or flagged; your only job is an honest, grounded
  per-scenario judgment.
- If the input doesn't have enough grounded material (implications/predetermined elements) across
  the 4 scenarios to construct genuinely grounded, differentiated options, return
  sufficient_evidence:false and a gap explaining why, instead of padding with generic options.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  options: [{ name: string, notes: string,
    scores: [{ scenario_id: string, robust: boolean, rationale: string, grounded_in: string[] }] /* exactly 4 */
  }] }`;

export interface GenerateStrategicOptionsResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  optionIds: string[];
  rejected: { name: string; reason: string }[];
  warnings: { optionId: string; message: string }[];
}

// POST .../projects/:id/strategy/generate
export async function generateStrategicOptions(projectId: string): Promise<GenerateStrategicOptionsResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", projectId)
    .single();
  if (projectError) throw new NotFoundError(`Project ${projectId} could not be loaded.`);

  const { data: activeAxes, error: axesError } = await supabase
    .from("axes")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .maybeSingle();
  if (axesError) throw axesError;

  const noEvidence = (gap: string): GenerateStrategicOptionsResult => ({ sufficientEvidence: false, gap, optionIds: [], rejected: [], warnings: [] });

  if (!activeAxes) {
    return noEvidence("This project doesn't have an active scenario matrix yet — build the 4 scenarios (Step 5) before generating strategic options.");
  }

  const { data: scenarioRows, error: scenariosError } = await supabase
    .from("scenarios")
    .select("id, name, logic")
    .eq("project_id", projectId)
    .eq("axes_id", activeAxes.id)
    .eq("is_archived", false);
  if (scenariosError) throw scenariosError;

  if (scenarioRows.length !== 4) {
    return noEvidence(`This project has ${scenarioRows.length} active scenario(s) — strategic options require exactly 4.`);
  }
  if (scenarioRows.some((s) => !s.logic)) {
    return noEvidence("One or more scenarios doesn't have a scenario logic yet (Step 5) — complete scenario logics before generating strategic options.");
  }
  const scenarioIds = scenarioRows.map((s) => s.id);
  const scenarioIdSet = new Set(scenarioIds);

  const { data: implicationRows, error: implicationsError } = await supabase
    .from("implications")
    .select("id, scenario_id, text, category")
    .in("scenario_id", scenarioIds);
  if (implicationsError) throw implicationsError;

  const { data: predeterminedDots, error: dotsError } = await supabase
    .from("matrix_dots")
    .select("signal_id")
    .eq("project_id", projectId)
    .eq("bucket", "predetermined");
  if (dotsError) throw dotsError;

  let predeterminedSignals: { id: string; title: string; body: string }[] = [];
  if (predeterminedDots.length > 0) {
    const { data: signalRows, error: signalsError } = await supabase
      .from("signals")
      .select("id, title, body")
      .in(
        "id",
        predeterminedDots.map((d) => d.signal_id)
      );
    if (signalsError) throw signalsError;
    predeterminedSignals = signalRows;
  }

  if (implicationRows.length === 0 && predeterminedSignals.length === 0) {
    return noEvidence("None of the 4 scenarios have implications yet, and there are no predetermined elements to ground a strategic option in — generate implications (Step 7) first.");
  }

  const implicationsByScenario = new Map<string, { id: string; text: string; category: string | null }[]>();
  for (const row of implicationRows) {
    const list = implicationsByScenario.get(row.scenario_id) ?? [];
    list.push({ id: row.id, text: row.text, category: row.category });
    implicationsByScenario.set(row.scenario_id, list);
  }
  // Used by the cost rubric below — only real implication ids resolve to a resource category;
  // predetermined-element ids never do (they carry a STEEP category, not a resource one, and
  // describe fixed context rather than what THIS option costs to execute).
  const implicationCategoryById = new Map(implicationRows.map((row) => [row.id, row.category]));
  const validGroundingIds = new Set<string>([...implicationRows.map((r) => r.id), ...predeterminedSignals.map((s) => s.id)]);

  const output = await runStructured({
    step: "strategy.generate",
    projectId,
    taskPrompt: STRATEGY_TASK_PROMPT,
    input: {
      focal_question: project.refined_focal_question ?? project.focal_question,
      scenarios: scenarioRows.map((s) => ({
        id: s.id,
        name: s.name,
        logic: s.logic,
        implications: (implicationsByScenario.get(s.id) ?? []).map((imp) => ({ id: imp.id, text: imp.text, category: imp.category })),
      })),
      predetermined_elements: predeterminedSignals.map((s) => ({ id: s.id, title: s.title, body: s.body })),
    },
    schema: StrategyOptionsSchema,
    effort: "low",
    thinking: false,
  });

  if (!output.sufficient_evidence || output.options.length === 0) {
    return noEvidence(output.gap ?? "The model found insufficient evidence for grounded strategic options.");
  }

  type AcceptedOption = {
    name: string;
    notes: string;
    robustCount: number;
    allFour: boolean;
    scores: { scenario_id: string; robust: boolean; rationale: string; grounded_in: string[] }[];
  };
  const rejected: { name: string; reason: string }[] = [];
  const accepted: AcceptedOption[] = [];

  for (const option of output.options) {
    // Every score must reference exactly one of this project's real 4 scenarios, each exactly
    // once — an option with a dropped/duplicated scenario_id never reaches the DB with silently
    // incomplete coverage.
    const coveredScenarioIds = new Set(option.scores.map((s) => s.scenario_id));
    if (coveredScenarioIds.size !== 4 || !option.scores.every((s) => scenarioIdSet.has(s.scenario_id))) {
      rejected.push({ name: option.name, reason: "Did not produce exactly one grounded score per each of the project's 4 scenarios." });
      continue;
    }

    // Defense in depth beyond the prompt's own instruction (global scaffold rule 2: "if a claim
    // has no grounding, do not include it") — strip any invented/empty citation, then reject the
    // whole option if that leaves any of its 4 scores ungrounded, rather than persisting a
    // partially-grounded judgment.
    const cleanedScores = option.scores.map((s) => ({ ...s, grounded_in: s.grounded_in.filter((id) => validGroundingIds.has(id)) }));
    if (cleanedScores.some((s) => s.grounded_in.length === 0)) {
      rejected.push({ name: option.name, reason: "At least one scenario score had no real, grounded citation." });
      continue;
    }

    const robustCount = cleanedScores.filter((s) => s.robust).length;
    // "Reject any option that is robust in 0 ... scenarios" — an option that survives none of
    // the 4 modeled futures isn't a viable hedge, regardless of how well-cited its rationale is.
    if (robustCount === 0) {
      rejected.push({ name: option.name, reason: "Robust in 0 of the 4 scenarios — not a viable option in any modeled future." });
      continue;
    }

    accepted.push({ name: option.name, notes: option.notes, robustCount, allFour: robustCount === 4, scores: cleanedScores });
  }

  if (accepted.length === 0) {
    return { sufficientEvidence: false, gap: "None of the model's candidate options survived grounding/robustness validation.", optionIds: [], rejected, warnings: [] };
  }

  // Cost is likewise a byproduct of real data (risk itself is the module-level
  // riskFromRobustCount above) — tracks the resource/time demand implied by the real
  // implications the option's own scores cited, never predetermined elements, which describe
  // fixed context, not what THIS option costs to execute.
  const costFromCitedImplications = (scores: { grounded_in: string[] }[]): "Low" | "Medium" | "High" => {
    const citedCategories = new Set(
      scores.flatMap((s) =>
        s.grounded_in
          .map((id) => implicationCategoryById.get(id))
          .filter((c): c is NonNullable<typeof c> => c != null)
      )
    );
    if (citedCategories.has("capital")) return "High";
    if (citedCategories.has("tech") || citedCategories.has("hiring")) return "Medium";
    return "Low";
  };

  // Regenerating replaces the prior AI-generated set outright (same convention as
  // ai-implications.ts/ai-indicators.ts) — manually-created options (created_via:'manual') are
  // left untouched, since a regenerate shouldn't discard a human's own entries. The FK cascade on
  // strategy_scenario_scores.strategy_id takes the deleted options' scores with them.
  const { error: deleteError } = await supabase.from("strategic_options").delete().eq("project_id", projectId).eq("created_via", "ai");
  if (deleteError) throw deleteError;

  // This regenerate is about to change strategy_scenario_scores for the project (new AI
  // options' scores land on top of whatever unchanged manual options/scores remain) — the
  // cached recommendation (ai-strategy-recommendation.ts) is now stale regardless of whether
  // its own primary/pairing ids happen to still exist, so invalidate it unconditionally rather
  // than relying only on strategy_recommendations' own ON DELETE CASCADE (which only catches
  // "the cached option was deleted," not "a new option was added that should now win instead").
  const { error: invalidateError } = await supabase.from("strategy_recommendations").delete().eq("project_id", projectId);
  if (invalidateError) throw invalidateError;

  const warnings: { optionId: string; message: string }[] = [];
  const optionIds: string[] = [];

  for (const option of accepted) {
    const riskValue = riskFromRobustCount(option.robustCount);
    const costValue = costFromCitedImplications(option.scores);
    // TEMP DIAGNOSTIC — remove once the strategic_options_risk_check 500 is root-caused.
    console.error("[strategy.generate][diagnostic]", {
      name: option.name,
      robustCount: option.robustCount,
      riskValue,
      riskValueType: typeof riskValue,
      riskValueJson: JSON.stringify(riskValue),
      costValue,
      costValueType: typeof costValue,
    });
    const { data: inserted, error: insertError } = await supabase
      .from("strategic_options")
      .insert({
        project_id: projectId,
        name: option.name,
        notes: option.notes,
        risk: riskValue,
        cost: costValue,
        created_via: "ai",
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    const { error: scoresError } = await supabase.from("strategy_scenario_scores").insert(
      option.scores.map((s) => ({
        project_id: projectId,
        strategy_id: inserted.id,
        scenario_id: s.scenario_id,
        robust: s.robust,
        rationale: s.rationale,
        grounded_in: s.grounded_in,
      }))
    );
    if (scoresError) throw scoresError;

    optionIds.push(inserted.id);
    // "all-4 usually signals a vague, non-differentiated option — flag it as a warning rather
    // than blocking" — persisted normally, just surfaced back to the caller rather than stored
    // as a DB column, since it's advisory rather than part of the option's own durable record.
    if (option.allFour) {
      warnings.push({
        optionId: inserted.id,
        message: `"${option.name}" is robust in all 4 scenarios — this usually means the option is too vague or non-differentiated rather than a genuine full hedge. Consider sharpening it.`,
      });
    }
  }

  revalidatePath("/strategy");
  return { sufficientEvidence: true, optionIds, rejected, warnings };
}
