"use server";

// Strategic Options recommendation — Build Plan §12 follow-on (SCHWARTZ_METHODOLOGY_SKILL.md's
// "+" row, tile 9/9 — the product's own extension, never one of Schwartz's 8 named steps).
//
// "Identify the option robust across the most scenarios at the lowest risk" is a checkable,
// single-answer ranking, not a judgment call — so unlike ai-strategy.ts's generate (which asks
// the model to invent and score options), the primary/pairing SELECTION here is computed
// deterministically in code from persisted strategy_scenario_scores (§0 Principle 5: "Deterministic
// where it should be" — same spirit as ai-matrix.ts's bucket classification and ai-signals.ts's
// impact/uncertainty rubric). This guarantees primary_option_id/pairing_option_id can never be a
// hallucinated or merely-plausible-looking id, because the model is never asked to choose one —
// it is only asked to write the grounded rationale prose for a pick that's already made, from a
// tightly curated set of real option/scenario names it's handed. A post-hoc check confirms that
// prose actually names what it's supposed to before persisting it; a deterministic, equally
// grounded template rationale is the fallback if it doesn't.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";

const RISK_RANK: Record<string, number> = { Low: 0, Medium: 1, High: 2 };
const riskRankOf = (risk: string | null): number => (risk != null && risk in RISK_RANK ? RISK_RANK[risk] : 3);

const RecommendationRationaleSchema = z.object({
  rationale: z.string(),
});

const RATIONALE_TASK_PROMPT = `Task: Write a short recommendation rationale for a strategic-options
wind-tunnel result. The primary option and (if given) the pairing option have ALREADY been
selected by a deterministic rule (most scenarios robust in, lowest risk as tiebreak; the pairing
is whichever other option covers the most of the primary's remaining weak scenarios) — your job
is ONLY to explain that already-made pick in prose. Do not second-guess or re-pick the options.

Input: { focal_question: string,
  primary: { name: string, risk: "Low"|"Medium"|"High",
    robust_scenarios: [{ name: string }], weak_scenarios: [{ name: string }] },
  pairing: null | { name: string, risk: "Low"|"Medium"|"High",
    covers_scenarios: [{ name: string }] /* which of primary's weak_scenarios this option covers */ },
  supporting_rationales: [{ scenario_name: string, option_name: string, text: string }]
  /* the real, persisted per-scenario rationale each cited option was scored with */,
  cited_implications: [{ scenario_name: string, text: string }]
  /* real implications behind those same citations, for extra grounding material */ }

Rules:
- 2-3 sentences total.
- Must name primary.name exactly as given, and pairing.name exactly as given if pairing is not
  null — never invent or alter either name.
- Must name at least one specific scenario by its real given name (from robust_scenarios,
  weak_scenarios, or covers_scenarios) — never a vague "the scenarios" or "most futures."
- If pairing is given, explicitly say which weak scenario(s) of primary's it covers, by name, and
  why — draw the "why" from supporting_rationales/cited_implications' actual text for that
  option/scenario pair, never a generic line like "minimizes downside" with no named scenario or
  cited reason behind it.
- If pairing is null, say plainly that the primary option already covers all 4 scenarios (or that
  no other option covers any of its remaining gap) instead of inventing a pairing.
- Do not state a risk/cost value that isn't in the input, and do not invent any option or
  scenario name beyond what's given above.

Output schema: { rationale: string }`;

export interface StrategyRecommendationResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  primaryOptionId: string | null;
  pairingOptionId: string | null;
  rationale: string | null;
  generatedAt: string | null;
  cached: boolean;
}

const noRecommendation = (gap: string): StrategyRecommendationResult => ({
  sufficientEvidence: false,
  gap,
  primaryOptionId: null,
  pairingOptionId: null,
  rationale: null,
  generatedAt: null,
  cached: false,
});

// GET .../projects/:id/strategy/recommendation
export async function getStrategyRecommendation(projectId: string): Promise<StrategyRecommendationResult> {
  const supabase = createClient();

  // Cache hit: ai-strategy.ts's generateStrategicOptions deletes this row whenever
  // strategy_scenario_scores changes for the project, so a row surviving to be read here means
  // nothing has changed since it was computed — served with no AI call at all.
  const { data: cached, error: cacheError } = await supabase.from("strategy_recommendations").select("*").eq("project_id", projectId).maybeSingle();
  if (cacheError) throw cacheError;
  if (cached) {
    return {
      sufficientEvidence: true,
      primaryOptionId: cached.primary_option_id,
      pairingOptionId: cached.pairing_option_id,
      rationale: cached.rationale,
      generatedAt: cached.generated_at,
      cached: true,
    };
  }

  const { data: options, error: optionsError } = await supabase
    .from("strategic_options")
    .select("id, name, risk, cost, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (optionsError) throw optionsError;
  if (options.length === 0) {
    return noRecommendation("No strategic options exist yet — generate options before requesting a recommendation.");
  }

  const { data: scores, error: scoresError } = await supabase
    .from("strategy_scenario_scores")
    .select("strategy_id, scenario_id, robust, rationale, grounded_in")
    .in(
      "strategy_id",
      options.map((o) => o.id)
    );
  if (scoresError) throw scoresError;

  const scenarioIds = Array.from(new Set(scores.map((s) => s.scenario_id)));
  if (scenarioIds.length === 0) {
    return noRecommendation("None of the persisted options have any recorded scenario score yet — wind-tunnel them before requesting a recommendation.");
  }

  const { data: scenarioRows, error: scenariosError } = await supabase.from("scenarios").select("id, name").in("id", scenarioIds);
  if (scenariosError) throw scenariosError;
  const scenarioNameById = new Map(scenarioRows.map((s) => [s.id, s.name]));

  // Deterministic selection — see this file's header comment for why this is code, not a model
  // call. "Most robust, lowest risk" is the primary rank; earliest-created breaks any remaining
  // tie so the result is stable across repeated calls with identical data.
  const stats = options.map((option) => {
    const optionScores = scores.filter((s) => s.strategy_id === option.id);
    const robustScenarioIds = new Set(optionScores.filter((s) => s.robust).map((s) => s.scenario_id));
    return { option, scores: optionScores, robustScenarioIds, robustCount: robustScenarioIds.size };
  });

  if (stats.every((s) => s.robustCount === 0)) {
    // Shouldn't happen for AI-generated options (generateStrategicOptions rejects 0-robust
    // candidates before persisting) but a manually-created option with no scores yet is a real,
    // honest possibility — nothing to recommend from in that case.
    return noRecommendation("None of the persisted options are robust in any scored scenario yet.");
  }

  stats.sort((a, b) => {
    if (b.robustCount !== a.robustCount) return b.robustCount - a.robustCount;
    const riskDiff = riskRankOf(a.option.risk) - riskRankOf(b.option.risk);
    if (riskDiff !== 0) return riskDiff;
    return new Date(a.option.created_at).getTime() - new Date(b.option.created_at).getTime();
  });
  const primary = stats[0];

  const gapScenarioIds = scenarioIds.filter((id) => !primary.robustScenarioIds.has(id));
  let pairing: (typeof stats)[number] | null = null;
  if (gapScenarioIds.length > 0) {
    let bestCoverage = 0;
    for (const candidate of stats) {
      if (candidate.option.id === primary.option.id) continue;
      const coverage = gapScenarioIds.filter((id) => candidate.robustScenarioIds.has(id)).length;
      if (coverage === 0) continue;
      if (
        !pairing ||
        coverage > bestCoverage ||
        (coverage === bestCoverage && riskRankOf(candidate.option.risk) < riskRankOf(pairing.option.risk))
      ) {
        pairing = candidate;
        bestCoverage = coverage;
      }
    }
  }

  const weakScenarioNames = gapScenarioIds.map((id) => scenarioNameById.get(id) ?? id);
  const coveredScenarioIds = pairing ? gapScenarioIds.filter((id) => pairing!.robustScenarioIds.has(id)) : [];
  const coveredScenarioNames = coveredScenarioIds.map((id) => scenarioNameById.get(id) ?? id);

  // Real implications behind the cited grounding for primary's weak scenarios and pairing's
  // covering scenarios — richer material than the score's own rationale text alone, per this
  // step's "reasons over ... scenario implications" requirement. grounded_in entries that point
  // at a predetermined signal rather than an implication simply won't match any row here, which
  // is fine — this is bonus grounding material, not the only source.
  const citedIds = new Set<string>();
  for (const s of primary.scores) if (!s.robust) for (const id of s.grounded_in) citedIds.add(id);
  if (pairing) for (const s of pairing.scores) if (coveredScenarioIds.includes(s.scenario_id)) for (const id of s.grounded_in) citedIds.add(id);

  let citedImplications: { scenario_id: string; text: string }[] = [];
  if (citedIds.size > 0) {
    const { data: impRows, error: impError } = await supabase.from("implications").select("id, scenario_id, text").in("id", Array.from(citedIds));
    if (impError) throw impError;
    citedImplications = impRows;
  }

  const supportingRationales = [
    ...primary.scores
      .filter((s) => !s.robust)
      .map((s) => ({ scenario_name: scenarioNameById.get(s.scenario_id) ?? s.scenario_id, option_name: primary.option.name, text: s.rationale })),
    ...(pairing
      ? pairing.scores
          .filter((s) => coveredScenarioIds.includes(s.scenario_id))
          .map((s) => ({ scenario_name: scenarioNameById.get(s.scenario_id) ?? s.scenario_id, option_name: pairing!.option.name, text: s.rationale }))
      : []),
  ];

  const { data: project, error: projectError } = await supabase.from("projects").select("focal_question, refined_focal_question").eq("id", projectId).single();
  if (projectError) throw projectError;

  const output = await runStructured({
    step: "strategy.recommendation",
    projectId,
    taskPrompt: RATIONALE_TASK_PROMPT,
    input: {
      focal_question: project.refined_focal_question ?? project.focal_question,
      primary: {
        name: primary.option.name,
        risk: primary.option.risk,
        robust_scenarios: Array.from(primary.robustScenarioIds).map((id) => ({ name: scenarioNameById.get(id) ?? id })),
        weak_scenarios: weakScenarioNames.map((name) => ({ name })),
      },
      pairing: pairing ? { name: pairing.option.name, risk: pairing.option.risk, covers_scenarios: coveredScenarioNames.map((name) => ({ name })) } : null,
      supporting_rationales: supportingRationales,
      cited_implications: citedImplications.map((imp) => ({ scenario_name: scenarioNameById.get(imp.scenario_id) ?? imp.scenario_id, text: imp.text })),
    },
    schema: RecommendationRationaleSchema,
    effort: "low",
    thinking: false,
  });

  // "No filler ... must name specific scenarios and reference actual robust/risk data" — checked
  // here, not just asked for in the prompt. A deterministic, equally grounded template (built
  // from the exact same real names) is the fallback, never a second model call — this is a
  // content-quality check, not a schema-validation failure runStructured's own retry would catch.
  const mentionsRequiredNames =
    output.rationale.includes(primary.option.name) &&
    (!pairing || (output.rationale.includes(pairing.option.name) && coveredScenarioNames.some((name) => output.rationale.includes(name))));

  const rationale = mentionsRequiredNames
    ? output.rationale
    : pairing
      ? `${primary.option.name} is the primary recommendation, robust in ${primary.robustCount} of ${scenarioIds.length} scenarios at ${primary.option.risk ?? "unscored"} risk; pair it with ${pairing.option.name} to cover ${coveredScenarioNames.join(" and ")}, where ${pairing.option.name} is robust and ${primary.option.name} is not.`
      : `${primary.option.name} is recommended: it is robust in ${primary.robustCount} of ${scenarioIds.length} scenarios${
          weakScenarioNames.length > 0 ? ` (weak in ${weakScenarioNames.join(", ")})` : ""
        } at ${primary.option.risk ?? "unscored"} risk, the best coverage-to-risk profile among the generated options.`;

  const { data: row, error: upsertError } = await supabase
    .from("strategy_recommendations")
    .upsert({ project_id: projectId, primary_option_id: primary.option.id, pairing_option_id: pairing?.option.id ?? null, rationale }, { onConflict: "project_id" })
    .select()
    .single();
  if (upsertError) throw upsertError;

  revalidatePath("/strategy");
  return {
    sufficientEvidence: true,
    primaryOptionId: row.primary_option_id,
    pairingOptionId: row.pairing_option_id,
    rationale: row.rationale,
    generatedAt: row.generated_at,
    cached: false,
  };
}
