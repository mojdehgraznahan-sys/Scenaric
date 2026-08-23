"use server";

// Strategy page's "Ask AI" — a fixed task menu (ask-ai.tsx's context="strategy" branch), never
// freeform (freeform lives in ai-strategy-chat.ts, same split as Storyline/Narrative's fixed
// task menu + separate ScenarioChatPanel). Same table/action split as ai-strategy.ts/strategy.ts:
// this file holds the three canned Ask AI tasks, none of which is the main "generate options"
// flow. All three reason ONLY over this project's own strategic_options/strategy_scenario_scores/
// scenarios/implications/predetermined signals — no web search, no general external knowledge —
// same "grounded, no external knowledge" convention as ai-storyline-tasks.ts/ai-narrative-tasks.ts.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { NotFoundError } from "@/lib/ai/errors";
import { z } from "zod";
import { riskFromRobustCount } from "@/lib/strategy-risk";

async function loadPredeterminedElements(supabase: ReturnType<typeof createClient>, projectId: string): Promise<{ id: string; title: string; body: string }[]> {
  const { data: dots, error: dotsError } = await supabase.from("matrix_dots").select("signal_id").eq("project_id", projectId).eq("bucket", "predetermined");
  if (dotsError) throw dotsError;
  if (dots.length === 0) return [];
  const { data: signalRows, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body")
    .in(
      "id",
      dots.map((d) => d.signal_id)
    );
  if (signalsError) throw signalsError;
  return signalRows;
}

// ─────────────────────── Task 1: Stress-test this option ───────────────────────

const StressTestSchema = z.object({
  findings: z.array(
    z.object({
      scenario_id: z.string(),
      still_robust: z.boolean(),
      rationale: z.string(),
      grounded_in: z.array(z.string()),
    })
  ),
});

const STRESS_TEST_PROMPT = `Task: Stress-test ONE strategic option's currently-robust scenario
scores — actively try to find a reason it might actually FAIL in each scenario where it is
currently marked robust, rather than restating why it currently passes.

Input: { option: { name: string, risk: "Low"|"Medium"|"High"|null, cost: "Low"|"Medium"|"High"|null },
  robust_scenarios: [{ id: string, name: string, logic: string, current_rationale: string,
    implications: [{ id: string, text: string, category: string|null }] }],
  predetermined_elements: [{ id: string, title: string, body: string }] }

Rules:
- Produce exactly one finding per entry in robust_scenarios (same scenario_id, none omitted,
  none duplicated).
- For each, genuinely try to find a failure mode: does any of that scenario's own implications,
  or a predetermined element, describe a condition this option's mechanism could not actually
  survive or exploit, even though it was previously scored robust? Do not just restate
  current_rationale as if trying counts as finding nothing.
- If you find a genuine, specific failure mode: still_robust:false, rationale states the new
  failure reason in one sentence, grounded_in cites the specific implication/predetermined
  element id (from this input only) that breaks it.
- If, after genuinely trying, you find no credible failure mode: still_robust:true, rationale
  confirms why it holds (may sharpen current_rationale), grounded_in cites at least one real id
  it's still grounded in — never leave this empty.
- Never invent a scenario, implication, or predetermined element id not given above.

Output schema:
{ findings: [{ scenario_id: string, still_robust: boolean, rationale: string, grounded_in: string[] }] }`;

export interface StressTestFinding {
  scenarioId: string;
  scenarioName: string;
  stillRobust: boolean;
  rationale: string;
  groundedIn: string[];
  revised: boolean;
}

export interface StressTestOptionResult {
  optionId: string;
  optionName: string;
  findings: StressTestFinding[];
}

// POST .../projects/:id/strategy/ask-ai { task: "stress_test_option", optionId }
export async function stressTestOption(optionId: string): Promise<StressTestOptionResult> {
  const supabase = createClient();

  const { data: option, error: optionError } = await supabase
    .from("strategic_options")
    .select("id, project_id, name, risk, cost")
    .eq("id", optionId)
    .single();
  if (optionError) throw new NotFoundError(`Strategic option ${optionId} could not be loaded.`);

  const { data: scores, error: scoresError } = await supabase
    .from("strategy_scenario_scores")
    .select("id, scenario_id, robust, rationale, grounded_in")
    .eq("strategy_id", optionId);
  if (scoresError) throw scoresError;

  const robustScores = scores.filter((s) => s.robust);
  if (robustScores.length === 0) {
    return { optionId, optionName: option.name, findings: [] };
  }

  const scenarioIds = robustScores.map((s) => s.scenario_id);
  const { data: scenarioRows, error: scenariosError } = await supabase.from("scenarios").select("id, name, logic").in("id", scenarioIds);
  if (scenariosError) throw scenariosError;
  const scenarioById = new Map(scenarioRows.map((s) => [s.id, s]));

  const { data: implicationRows, error: implicationsError } = await supabase
    .from("implications")
    .select("id, scenario_id, text, category")
    .in("scenario_id", scenarioIds);
  if (implicationsError) throw implicationsError;
  const implicationsByScenario = new Map<string, { id: string; text: string; category: string | null }[]>();
  for (const row of implicationRows) {
    const list = implicationsByScenario.get(row.scenario_id) ?? [];
    list.push({ id: row.id, text: row.text, category: row.category });
    implicationsByScenario.set(row.scenario_id, list);
  }

  const predeterminedSignals = await loadPredeterminedElements(supabase, option.project_id);
  const validGroundingIds = new Set<string>([...implicationRows.map((r) => r.id), ...predeterminedSignals.map((s) => s.id)]);

  const output = await runStructured({
    step: "strategy_ask_ai.stress_test_option",
    projectId: option.project_id,
    taskPrompt: STRESS_TEST_PROMPT,
    input: {
      option: { name: option.name, risk: option.risk, cost: option.cost },
      robust_scenarios: robustScores.map((s) => ({
        id: s.scenario_id,
        name: scenarioById.get(s.scenario_id)?.name ?? s.scenario_id,
        logic: scenarioById.get(s.scenario_id)?.logic ?? "",
        current_rationale: s.rationale,
        implications: implicationsByScenario.get(s.scenario_id) ?? [],
      })),
      predetermined_elements: predeterminedSignals.map((s) => ({ id: s.id, title: s.title, body: s.body })),
    },
    schema: StressTestSchema,
    // "Actively look for a reason it might fail" benefits from real deliberation, not a
    // low-effort classification pass — unlike ai-strategy.ts's own generate call, which is a
    // pure scoring/classification task at effort:"low".
    effort: "medium",
    thinking: true,
  });

  const scoreByScenarioId = new Map(robustScores.map((s) => [s.scenario_id, s]));
  const findings: StressTestFinding[] = [];
  let anyRevised = false;

  for (const finding of output.findings) {
    const score = scoreByScenarioId.get(finding.scenario_id);
    if (!score) continue; // not one of this option's own robust scenarios — ignore
    const groundedIn = finding.grounded_in.filter((id) => validGroundingIds.has(id));
    if (groundedIn.length === 0) continue; // never persist or report an ungrounded finding

    const revised = !finding.still_robust;
    if (revised) {
      const { error: updateError } = await supabase
        .from("strategy_scenario_scores")
        .update({ robust: false, rationale: finding.rationale, grounded_in: groundedIn })
        .eq("id", score.id);
      if (updateError) throw updateError;
      anyRevised = true;
    }

    findings.push({
      scenarioId: finding.scenario_id,
      scenarioName: scenarioById.get(finding.scenario_id)?.name ?? finding.scenario_id,
      stillRobust: finding.still_robust,
      rationale: finding.rationale,
      groundedIn,
      revised,
    });
  }

  if (anyRevised) {
    // Ground truth actually changed — the option's own risk (derived from robust count at
    // generation time, ai-strategy.ts's riskFromRobustCount) and the project's cached
    // recommendation (ai-strategy-recommendation.ts) are both now stale.
    const { data: freshScores, error: freshScoresError } = await supabase.from("strategy_scenario_scores").select("robust").eq("strategy_id", optionId);
    if (freshScoresError) throw freshScoresError;
    const newRobustCount = freshScores.filter((s) => s.robust).length;
    const { error: riskUpdateError } = await supabase
      .from("strategic_options")
      .update({ risk: riskFromRobustCount(newRobustCount) })
      .eq("id", optionId);
    if (riskUpdateError) throw riskUpdateError;

    const { error: invalidateError } = await supabase.from("strategy_recommendations").delete().eq("project_id", option.project_id);
    if (invalidateError) throw invalidateError;
  }

  return { optionId, optionName: option.name, findings };
}

// ─────────────────────── Task 2: Why is this not robust here? ───────────────────────

const ExplainNonRobustSchema = z.object({
  explanation: z.string().min(20),
});

const EXPLAIN_NON_ROBUST_PROMPT = `Task: Expand ONE existing one-line "not robust here" rationale
into a fuller explanation for a stakeholder — WHY this specific option fails in this specific
scenario. Elaborate on the SAME cited mechanism(s) given below in more depth; do not introduce a
new reason not already implied by existing_rationale or cited_material.

Input: { option: { name: string }, scenario: { name: string, logic: string },
  existing_rationale: string,
  cited_material: [{ id: string, kind: "implication"|"predetermined_element", text: string }] }

Rules:
- 3-5 sentences.
- Name the option and the scenario by their real given names.
- Quote or closely paraphrase the specific cited_material text that breaks the option here —
  never invent a mechanism, fact, or number not present in existing_rationale or cited_material.

Output schema: { explanation: string }`;

// POST .../projects/:id/strategy/ask-ai { task: "explain_non_robust", optionId, scenarioId }
export async function explainNonRobustCell(optionId: string, scenarioId: string): Promise<{ explanation: string }> {
  const supabase = createClient();

  const { data: option, error: optionError } = await supabase.from("strategic_options").select("id, project_id, name").eq("id", optionId).single();
  if (optionError) throw new NotFoundError(`Strategic option ${optionId} could not be loaded.`);

  const { data: score, error: scoreError } = await supabase
    .from("strategy_scenario_scores")
    .select("id, scenario_id, robust, rationale, grounded_in")
    .eq("strategy_id", optionId)
    .eq("scenario_id", scenarioId)
    .maybeSingle();
  if (scoreError) throw scoreError;
  if (!score) {
    return { explanation: "This option hasn't been scored against that scenario yet." };
  }
  if (score.robust) {
    return { explanation: 'This option is marked robust in that scenario — there is no "not robust" rationale to expand. Try "Stress-test this option" instead.' };
  }

  const { data: scenario, error: scenarioError } = await supabase.from("scenarios").select("id, name, logic").eq("id", scenarioId).single();
  if (scenarioError) throw scenarioError;

  const citedMaterial: { id: string; kind: "implication" | "predetermined_element"; text: string }[] = [];
  if (score.grounded_in.length > 0) {
    const { data: impRows, error: impError } = await supabase.from("implications").select("id, text").in("id", score.grounded_in);
    if (impError) throw impError;
    for (const imp of impRows) citedMaterial.push({ id: imp.id, kind: "implication", text: imp.text });

    const remainingIds = score.grounded_in.filter((id) => !impRows.some((imp) => imp.id === id));
    if (remainingIds.length > 0) {
      const { data: signalRows, error: signalError } = await supabase.from("signals").select("id, title, body").in("id", remainingIds);
      if (signalError) throw signalError;
      for (const sig of signalRows) citedMaterial.push({ id: sig.id, kind: "predetermined_element", text: `${sig.title} — ${sig.body}` });
    }
  }

  if (citedMaterial.length === 0) {
    // Shouldn't happen — every score is required to be grounded before it's ever persisted
    // (ai-strategy.ts) — but if the citation somehow no longer resolves (e.g. the cited
    // implication was deleted since), fall back to the existing one-liner rather than
    // calling the model with nothing real to expand.
    return { explanation: score.rationale };
  }

  const output = await runStructured({
    step: "strategy_ask_ai.explain_non_robust",
    projectId: option.project_id,
    taskPrompt: EXPLAIN_NON_ROBUST_PROMPT,
    input: {
      option: { name: option.name },
      scenario: { name: scenario.name, logic: scenario.logic },
      existing_rationale: score.rationale,
      cited_material: citedMaterial,
    },
    schema: ExplainNonRobustSchema,
    effort: "low",
    thinking: false,
  });

  return { explanation: output.explanation };
}

// ─────────────────────── Task 3: Suggest a hedge ───────────────────────

const SuggestHedgeSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  name: z.string().optional(),
  notes: z.string().optional(),
  rationale: z.string().optional(),
  grounded_in: z.array(z.string()).optional(),
});

const SUGGEST_HEDGE_PROMPT = `Task: Propose ONE new strategic option (or a modification framed as
a new option) aimed specifically at covering the project's currently weakest-covered scenario —
the scenario where the fewest existing options are robust.

Input: { focal_question: string,
  target_scenario: { name: string, logic: string, implications: [{ id: string, text: string, category: string|null }] },
  predetermined_elements: [{ id: string, title: string, body: string }] }

Rules:
- The suggestion must be a concrete, actionable operating/investment choice — never a restated
  goal, never phrased as a prediction.
- rationale must be one to two sentences and cite the specific implication/predetermined element
  id (from this input only) that this option's mechanism specifically addresses in
  target_scenario — never a generic "improves resilience" with no cited mechanism.
- grounded_in must contain at least one real id from this input.
- If target_scenario's implications and predetermined_elements don't contain enough concrete
  material to ground a genuine, specific hedge (not a vague catch-all), set
  sufficient_evidence:false and a gap explaining why, instead of forcing a weak suggestion.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  name?: string, notes?: string, rationale?: string, grounded_in?: string[] }`;

export interface SuggestHedgeResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  targetScenarioId: string | null;
  targetScenarioName: string | null;
  suggestion: { name: string; notes: string; rationale: string; groundedIn: string[] } | null;
}

const noHedge = (gap: string, targetScenarioId: string | null = null, targetScenarioName: string | null = null): SuggestHedgeResult => ({
  sufficientEvidence: false,
  gap,
  targetScenarioId,
  targetScenarioName,
  suggestion: null,
});

// POST .../projects/:id/strategy/ask-ai { task: "suggest_hedge" }
export async function suggestHedge(projectId: string): Promise<SuggestHedgeResult> {
  const supabase = createClient();

  const { data: options, error: optionsError } = await supabase.from("strategic_options").select("id").eq("project_id", projectId);
  if (optionsError) throw optionsError;
  if (options.length === 0) {
    return noHedge("No strategic options exist yet — generate options first.");
  }

  const { data: activeAxes, error: axesError } = await supabase.from("axes").select("id").eq("project_id", projectId).eq("is_active", true).maybeSingle();
  if (axesError) throw axesError;
  if (!activeAxes) {
    return noHedge("This project doesn't have an active scenario matrix yet.");
  }

  const { data: scenarioRows, error: scenariosError } = await supabase
    .from("scenarios")
    .select("id, name, logic")
    .eq("project_id", projectId)
    .eq("axes_id", activeAxes.id)
    .eq("is_archived", false);
  if (scenariosError) throw scenariosError;
  if (scenarioRows.length !== 4) {
    return noHedge(`This project has ${scenarioRows.length} active scenario(s) — a hedge suggestion requires exactly 4.`);
  }

  const { data: scores, error: scoresError } = await supabase
    .from("strategy_scenario_scores")
    .select("scenario_id, robust")
    .in(
      "strategy_id",
      options.map((o) => o.id)
    );
  if (scoresError) throw scoresError;

  // Deterministic — "weakest coverage" is a checkable count, not a judgment call (same
  // rationale as ai-strategy-recommendation.ts's primary/pairing selection).
  const robustCountByScenario = new Map(scenarioRows.map((s) => [s.id, 0]));
  for (const score of scores) {
    if (!score.robust) continue;
    robustCountByScenario.set(score.scenario_id, (robustCountByScenario.get(score.scenario_id) ?? 0) + 1);
  }
  let target = scenarioRows[0];
  for (const scenario of scenarioRows) {
    if ((robustCountByScenario.get(scenario.id) ?? 0) < (robustCountByScenario.get(target.id) ?? 0)) target = scenario;
  }

  const { data: implicationRows, error: implicationsError } = await supabase.from("implications").select("id, text, category").eq("scenario_id", target.id);
  if (implicationsError) throw implicationsError;

  const predeterminedSignals = await loadPredeterminedElements(supabase, projectId);

  if (implicationRows.length === 0 && predeterminedSignals.length === 0) {
    return noHedge(`"${target.name}" has the weakest coverage but has no implications or predetermined elements yet to ground a hedge suggestion in.`, target.id, target.name);
  }

  const { data: project, error: projectError } = await supabase.from("projects").select("focal_question, refined_focal_question").eq("id", projectId).single();
  if (projectError) throw projectError;

  const validGroundingIds = new Set<string>([...implicationRows.map((r) => r.id), ...predeterminedSignals.map((s) => s.id)]);

  const output = await runStructured({
    step: "strategy_ask_ai.suggest_hedge",
    projectId,
    taskPrompt: SUGGEST_HEDGE_PROMPT,
    input: {
      focal_question: project.refined_focal_question ?? project.focal_question,
      target_scenario: { name: target.name, logic: target.logic, implications: implicationRows.map((r) => ({ id: r.id, text: r.text, category: r.category })) },
      predetermined_elements: predeterminedSignals.map((s) => ({ id: s.id, title: s.title, body: s.body })),
    },
    schema: SuggestHedgeSchema,
    effort: "medium",
    thinking: true,
  });

  if (!output.sufficient_evidence || !output.name || !output.rationale) {
    return noHedge(output.gap ?? "The model found insufficient evidence for a grounded hedge suggestion.", target.id, target.name);
  }

  const groundedIn = (output.grounded_in ?? []).filter((id) => validGroundingIds.has(id));
  if (groundedIn.length === 0) {
    return noHedge("The model's suggestion didn't cite any real implication or predetermined element.", target.id, target.name);
  }

  return {
    sufficientEvidence: true,
    targetScenarioId: target.id,
    targetScenarioName: target.name,
    suggestion: { name: output.name, notes: output.notes ?? "", rationale: output.rationale, groundedIn },
  };
}
