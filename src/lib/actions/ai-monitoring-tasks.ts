"use server";

// Monitoring page's "Ask AI" — a fixed task menu (ask-ai.tsx's context="monitoring" branch),
// never freeform (freeform lives in ai-monitoring-chat.ts, same split as Strategy's
// ai-strategy-tasks.ts/ai-strategy-chat.ts). All four tasks reason ONLY over this project's own
// indicators/indicator_readings/sources — no web search, no general external knowledge. Never
// touches signposts/plausibility_checks/ai-grounding.ts (a separate, already-shipped product
// extension per SCHWARTZ_METHODOLOGY_SKILL.md's "Signpost" section).
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { NotFoundError } from "@/lib/ai/errors";
import { z } from "zod";
import { STATUS_ORDINAL, type IndicatorStatus } from "@/lib/indicator-status";
import { generateIndicatorsForScenario, type GenerateIndicatorsResult } from "./ai-indicators";

// ─────────────────────── Task 1: Which scenario is most likely emerging? ───────────────────────

const RankScenariosRationaleSchema = z.object({ rationale: z.string() });

const RANK_SCENARIOS_PROMPT = `Task: Explain, in grounded prose, why the given top-ranked scenario
currently has the strongest Alert/Watch signal among this project's scenarios. The ranking
itself has already been computed deterministically (summing each scenario's indicators'
severity: On track=0, Watch=1, Alert=2) — do not recompute or second-guess it, only narrate it.

Input: { top_scenario: { name: string, score: number,
  indicators: [{ name: string, status: string, trend: string | null }] },
  runner_up: { name: string, score: number } | null }

Rules:
- 2-3 sentences.
- Name the top scenario and cite the SPECIFIC indicators (by their real given names) whose
  status is driving its score — never a vague "several indicators."
- If the top scenario's score is 0 (nothing in Watch/Alert anywhere), say so plainly instead of
  manufacturing urgency — a quiet monitoring picture is a valid, honest result.
- Never invent an indicator or scenario name beyond what's given.

Output schema: { rationale: string }`;

export interface ScenarioSignalRank {
  scenarioId: string;
  scenarioName: string;
  score: number;
  indicatorCount: number;
}

export interface RankScenariosResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  topScenarioId: string | null;
  topScenarioName: string | null;
  ranking: ScenarioSignalRank[];
  rationale: string | null;
}

const noRanking = (gap: string): RankScenariosResult => ({
  sufficientEvidence: false,
  gap,
  topScenarioId: null,
  topScenarioName: null,
  ranking: [],
  rationale: null,
});

// POST .../projects/:id/monitoring/ask-ai { task: "most_likely_scenario" }
export async function rankScenariosByIndicatorSignal(projectId: string): Promise<RankScenariosResult> {
  const supabase = createClient();

  const { data: indicators, error: indicatorsError } = await supabase
    .from("indicators")
    .select("id, scenario_id, name, status, trend")
    .eq("project_id", projectId);
  if (indicatorsError) throw indicatorsError;
  if (indicators.length === 0) {
    return noRanking("No indicators exist yet — generate or add some first.");
  }

  const scenarioIds = Array.from(new Set(indicators.map((i) => i.scenario_id).filter((id): id is string => id != null)));
  if (scenarioIds.length === 0) {
    return noRanking("None of this project's indicators are linked to a scenario yet.");
  }

  const { data: scenarioRows, error: scenariosError } = await supabase.from("scenarios").select("id, name").in("id", scenarioIds);
  if (scenariosError) throw scenariosError;
  const scenarioNameById = new Map(scenarioRows.map((s) => [s.id, s.name]));

  // Deterministic — "which scenario has the strongest signal" is a checkable sum, not a
  // judgment call (same rationale as ai-strategy-recommendation.ts's primary/pairing
  // selection): the model is never asked to rank, only to narrate the real ranking.
  const byScenario = new Map<string, { score: number; indicators: { name: string; status: IndicatorStatus; trend: string | null }[] }>();
  for (const ind of indicators) {
    if (!ind.scenario_id) continue;
    const bucket = byScenario.get(ind.scenario_id) ?? { score: 0, indicators: [] };
    bucket.score += STATUS_ORDINAL[ind.status];
    bucket.indicators.push({ name: ind.name, status: ind.status, trend: ind.trend });
    byScenario.set(ind.scenario_id, bucket);
  }

  const ranking: ScenarioSignalRank[] = Array.from(byScenario.entries())
    .map(([scenarioId, bucket]) => ({
      scenarioId,
      scenarioName: scenarioNameById.get(scenarioId) ?? scenarioId,
      score: bucket.score,
      indicatorCount: bucket.indicators.length,
    }))
    .sort((a, b) => b.score - a.score);

  const top = ranking[0];
  const topBucket = byScenario.get(top.scenarioId)!;
  const runnerUp = ranking[1] ?? null;

  const output = await runStructured({
    step: "monitoring_ask_ai.most_likely_scenario",
    projectId,
    taskPrompt: RANK_SCENARIOS_PROMPT,
    input: {
      top_scenario: { name: top.scenarioName, score: top.score, indicators: topBucket.indicators },
      runner_up: runnerUp ? { name: runnerUp.scenarioName, score: runnerUp.score } : null,
    },
    schema: RankScenariosRationaleSchema,
    effort: "low",
    thinking: false,
  });

  // Defense in depth beyond the prompt's own instruction — the input was curated to only the
  // top scenario's own real data, but confirm the rationale actually names it before trusting
  // it; a deterministic, equally grounded template is the fallback otherwise (same convention
  // as ai-strategy-recommendation.ts).
  const rationale = output.rationale.includes(top.scenarioName)
    ? output.rationale
    : `${top.scenarioName} currently has the strongest signal (score ${top.score} of ${topBucket.indicators.length} indicator(s)): ${topBucket.indicators.map((i) => `${i.name} (${i.status})`).join(", ")}.`;

  return { sufficientEvidence: true, topScenarioId: top.scenarioId, topScenarioName: top.scenarioName, ranking, rationale };
}

// ─────────────────────── Task 2: Explain this indicator's status ───────────────────────

const ExplainIndicatorSchema = z.object({ explanation: z.string().min(20) });

const EXPLAIN_INDICATOR_PROMPT = `Task: Write a plain-language walkthrough of how ONE indicator
arrived at its current status, using ONLY the real, grounded readings given below — do not
introduce a new reason not present in them.

Input: { indicator: { name: string, current_status: string, trigger_condition: string | null },
  readings: [{ date: string, rationale: string, source_title: string, source_url: string }]
  /* chronological, oldest first */ }

Rules:
- 3-5 sentences, walking the readings in order.
- Name the indicator and cite the specific news source titles given.
- Never invent a fact, date, or source not present in readings.

Output schema: { explanation: string }`;

export interface ExplainIndicatorResult {
  indicatorId: string;
  indicatorName: string;
  explanation: string;
}

// POST .../projects/:id/monitoring/ask-ai { task: "explain_indicator", indicatorId }
export async function explainIndicatorStatus(indicatorId: string): Promise<ExplainIndicatorResult> {
  const supabase = createClient();

  const { data: indicator, error: indicatorError } = await supabase
    .from("indicators")
    .select("id, project_id, name, status, trigger_condition")
    .eq("id", indicatorId)
    .single();
  if (indicatorError) throw new NotFoundError(`Indicator ${indicatorId} could not be loaded.`);

  const { data: readings, error: readingsError } = await supabase
    .from("indicator_readings")
    .select("date, rationale, grounded_in")
    .eq("indicator_id", indicatorId)
    .not("grounded_in", "is", null)
    .order("date", { ascending: false })
    .limit(7);
  if (readingsError) throw readingsError;

  if (readings.length === 0) {
    return {
      indicatorId,
      indicatorName: indicator.name,
      explanation: "No grounded reading exists for this indicator yet — its status hasn't been backed by a specific news item so far.",
    };
  }

  const ascending = [...readings].reverse();
  const sourceIds = ascending.map((r) => r.grounded_in).filter((id): id is string => id != null);
  const { data: sources, error: sourcesError } = await supabase.from("sources").select("id, name, storage_url").in("id", sourceIds);
  if (sourcesError) throw sourcesError;
  const sourceById = new Map(sources.map((s) => [s.id, s]));

  const citedReadings = ascending
    .filter((r) => r.rationale != null)
    .map((r) => {
      const source = r.grounded_in ? sourceById.get(r.grounded_in) : undefined;
      return { date: r.date, rationale: r.rationale as string, source_title: source?.name ?? "(source not found)", source_url: source?.storage_url ?? "" };
    });

  if (citedReadings.length === 0) {
    return {
      indicatorId,
      indicatorName: indicator.name,
      explanation: "No grounded reading exists for this indicator yet — its status hasn't been backed by a specific news item so far.",
    };
  }

  const output = await runStructured({
    step: "monitoring_ask_ai.explain_indicator",
    projectId: indicator.project_id,
    taskPrompt: EXPLAIN_INDICATOR_PROMPT,
    input: {
      indicator: { name: indicator.name, current_status: indicator.status, trigger_condition: indicator.trigger_condition },
      readings: citedReadings,
    },
    schema: ExplainIndicatorSchema,
    effort: "low",
    thinking: false,
  });

  return { indicatorId, indicatorName: indicator.name, explanation: output.explanation };
}

// ─────────────────────── Task 3: What changed in the last 7 days? ───────────────────────

const RecentChangesSummarySchema = z.object({ summary: z.string() });

const RECENT_CHANGES_PROMPT = `Task: Summarize which indicators changed status in the last 7
days, grouped by scenario, using ONLY the real transitions given below.

Input: { changes: [{ indicator_name: string, scenario_name: string | null, from_status: string,
  to_status: string, date: string, rationale: string | null }] }

Rules:
- Group by scenario_name in the summary (mention indicators with no scenario separately, if
  any are present).
- Cite each indicator's real name, its from→to transition, and its rationale when present.
- Never invent a transition, indicator, or scenario not present in changes.
- Keep it tight — roughly one sentence per scenario group unless a group has many transitions.

Output schema: { summary: string }`;

export interface IndicatorChange {
  indicatorId: string;
  indicatorName: string;
  scenarioId: string | null;
  scenarioName: string | null;
  fromStatus: IndicatorStatus;
  toStatus: IndicatorStatus;
  date: string;
  rationale: string | null;
}

export interface RecentChangesResult {
  changes: IndicatorChange[];
  summary: string;
}

// POST .../projects/:id/monitoring/ask-ai { task: "recent_changes" }
export async function summarizeRecentChanges(projectId: string): Promise<RecentChangesResult> {
  const supabase = createClient();

  const { data: indicators, error: indicatorsError } = await supabase.from("indicators").select("id, scenario_id, name").eq("project_id", projectId);
  if (indicatorsError) throw indicatorsError;
  if (indicators.length === 0) {
    return { changes: [], summary: "No indicators exist yet." };
  }

  const scenarioIds = Array.from(new Set(indicators.map((i) => i.scenario_id).filter((id): id is string => id != null)));
  const scenarioNameById = new Map<string, string>();
  if (scenarioIds.length > 0) {
    const { data: scenarioRows, error: scenariosError } = await supabase.from("scenarios").select("id, name").in("id", scenarioIds);
    if (scenariosError) throw scenariosError;
    for (const s of scenarioRows) scenarioNameById.set(s.id, s.name);
  }

  // Deterministic transition detection — no AI needed to spot a diff between consecutive
  // readings. Same per-indicator limit(7) query shape already trusted elsewhere
  // (indicators-monitoring.ts's own trend recompute, indicators.ts's sparkline fetch).
  const changes: IndicatorChange[] = [];
  for (const indicator of indicators) {
    const { data: readings, error: readingsError } = await supabase
      .from("indicator_readings")
      .select("date, status_at_time, rationale")
      .eq("indicator_id", indicator.id)
      .order("date", { ascending: false })
      .limit(7);
    if (readingsError) throw readingsError;
    const ascending = [...readings].reverse();
    for (let i = 1; i < ascending.length; i++) {
      const prev = ascending[i - 1];
      const curr = ascending[i];
      if (curr.status_at_time === prev.status_at_time) continue;
      changes.push({
        indicatorId: indicator.id,
        indicatorName: indicator.name,
        scenarioId: indicator.scenario_id,
        scenarioName: indicator.scenario_id ? (scenarioNameById.get(indicator.scenario_id) ?? null) : null,
        fromStatus: prev.status_at_time,
        toStatus: curr.status_at_time,
        date: curr.date,
        rationale: curr.rationale,
      });
    }
  }

  if (changes.length === 0) {
    return { changes: [], summary: "No indicators changed status in the last 7 days." };
  }

  const output = await runStructured({
    step: "monitoring_ask_ai.recent_changes",
    projectId,
    taskPrompt: RECENT_CHANGES_PROMPT,
    input: {
      changes: changes.map((c) => ({
        indicator_name: c.indicatorName,
        scenario_name: c.scenarioName,
        from_status: c.fromStatus,
        to_status: c.toStatus,
        date: c.date,
        rationale: c.rationale,
      })),
    },
    schema: RecentChangesSummarySchema,
    effort: "low",
    thinking: false,
  });

  return { changes, summary: output.summary };
}

// ─────────────────────── Task 4: Suggest a new indicator for an under-monitored scenario ───

export interface SuggestIndicatorForScenarioResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  targetScenarioId: string | null;
  targetScenarioName: string | null;
  generateResult: GenerateIndicatorsResult | null;
}

// POST .../projects/:id/monitoring/ask-ai { task: "suggest_indicator" }
// No new AI call of its own — delegates directly to the existing generateIndicatorsForScenario
// (already logs its own ai_runs row under step "indicators.generate"). Only proceeds when the
// least-covered scenario has ZERO indicators, since generateIndicatorsForScenario deletes a
// scenario's prior indicators before inserting new ones — calling it against a scenario that
// already has some would be a surprising one-click destructive regenerate from inside the Ask
// AI drawer, not the additive "suggest one more" the prompt name implies.
export async function suggestIndicatorForUnderMonitoredScenario(projectId: string): Promise<SuggestIndicatorForScenarioResult> {
  const supabase = createClient();

  const { data: activeAxes, error: axesError } = await supabase.from("axes").select("id").eq("project_id", projectId).eq("is_active", true).maybeSingle();
  if (axesError) throw axesError;
  if (!activeAxes) {
    return { sufficientEvidence: false, gap: "This project doesn't have an active scenario matrix yet.", targetScenarioId: null, targetScenarioName: null, generateResult: null };
  }

  const { data: scenarioRows, error: scenariosError } = await supabase
    .from("scenarios")
    .select("id, name")
    .eq("project_id", projectId)
    .eq("axes_id", activeAxes.id)
    .eq("is_archived", false);
  if (scenariosError) throw scenariosError;
  if (scenarioRows.length !== 4) {
    return {
      sufficientEvidence: false,
      gap: `This project has ${scenarioRows.length} active scenario(s) — this task requires exactly 4.`,
      targetScenarioId: null,
      targetScenarioName: null,
      generateResult: null,
    };
  }

  const { data: indicatorRows, error: indicatorsError } = await supabase
    .from("indicators")
    .select("scenario_id")
    .in(
      "scenario_id",
      scenarioRows.map((s) => s.id)
    );
  if (indicatorsError) throw indicatorsError;

  const countByScenario = new Map(scenarioRows.map((s) => [s.id, 0]));
  for (const row of indicatorRows) {
    if (!row.scenario_id) continue;
    countByScenario.set(row.scenario_id, (countByScenario.get(row.scenario_id) ?? 0) + 1);
  }

  let target = scenarioRows[0];
  for (const scenario of scenarioRows) {
    if ((countByScenario.get(scenario.id) ?? 0) < (countByScenario.get(target.id) ?? 0)) target = scenario;
  }
  const minCount = countByScenario.get(target.id) ?? 0;

  if (minCount > 0) {
    return {
      sufficientEvidence: false,
      gap: `All scenarios have at least one indicator (fewest is ${minCount}, on "${target.name}"). Regenerating would replace an existing scenario's indicators, so this won't run automatically — use Monitoring's own "Add indicator → Suggest with AI" for a specific scenario if you want that.`,
      targetScenarioId: target.id,
      targetScenarioName: target.name,
      generateResult: null,
    };
  }

  const generateResult = await generateIndicatorsForScenario(target.id);
  return { sufficientEvidence: true, targetScenarioId: target.id, targetScenarioName: target.name, generateResult };
}
