"use server";

// Monitoring page's "Ask AI" — a fixed task menu (ask-ai.tsx's context="monitoring" branch),
// never freeform (freeform lives in ai-monitoring-chat.ts, same split as Strategy's
// ai-strategy-tasks.ts/ai-strategy-chat.ts). All four tasks reason ONLY over this project's own
// tracked events (event_scenario_links/event_likelihood_history) — no web search, no general
// external knowledge. Never touches signposts/plausibility_checks/ai-grounding.ts (a separate,
// already-shipped product extension per SCHWARTZ_METHODOLOGY_SKILL.md's "Signpost" section).
//
// Ported from the indicators-based version of this file (0042_decision_layer.sql's documented
// retirement of indicators) — same four tasks, same "code computes the real numbers, AI only
// narrates them" discipline, now grounded in tracked events via the exact pure functions
// Monitoring's own board already trusts (decision-model.ts's momentum/health/delta).
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { NotFoundError } from "@/lib/ai/errors";
import { PERSONA_SCENARIO_SENTINEL } from "@/lib/ai/personas";
import { z } from "zod";
import { fetchTrackedEvents, toTrackedEvent } from "@/lib/decision-tracking";
import { momentum, health, delta, windowPoints, LIKELIHOOD_LEVELS, type HealthTone, type LikelihoodLevel } from "@/lib/decision-model";
import { suggestEventsToMonitor, type SuggestEventsToMonitorResult } from "./ai-event-monitoring";

// ─────────────────────── Task 1: Which scenario is most likely emerging? ───────────────────────

const RankScenariosRationaleSchema = z.object({ rationale: z.string() });

const RANK_SCENARIOS_PROMPT = `${PERSONA_SCENARIO_SENTINEL}

Task: Explain, in grounded prose, why the given top-ranked scenario
currently has the strongest momentum signal among this project's scenarios. The ranking itself
has already been computed deterministically (sum of likelihood-delta*impact across every event
supporting that scenario) — do not recompute or second-guess it, only narrate it.

Input: { top_scenario: { name: string, score: number,
  events: [{ title: string, direction: "rising"|"falling", impact: number }] },
  runner_up: { name: string, score: number } | null }

Rules:
- 2-3 sentences.
- Name the top scenario and cite the SPECIFIC events (by their real given titles) whose
  likelihood is driving its score — never a vague "several events."
- If top_scenario.events is empty, say the monitoring picture is quiet right now instead of
  manufacturing urgency — a quiet picture is a valid, honest result.
- Never invent an event or scenario name beyond what's given.

Output schema: { rationale: string }`;

export interface ScenarioSignalRank {
  scenarioId: string;
  scenarioName: string;
  score: number;
  eventCount: number;
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
export async function rankScenariosByEventSignal(projectId: string): Promise<RankScenariosResult> {
  const supabase = createClient();

  const tracked = await fetchTrackedEvents(supabase, projectId);
  if (tracked.length === 0) {
    return noRanking("No tracked events exist yet — monitor some from Narrative first.");
  }

  const scenarioIds = Array.from(new Set(tracked.flatMap((t) => t.supports)));
  if (scenarioIds.length === 0) {
    return noRanking("None of this project's tracked events support a scenario yet.");
  }

  const { data: scenarioRows, error: scenariosError } = await supabase.from("scenarios").select("id, name").in("id", scenarioIds);
  if (scenariosError) throw scenariosError;
  const scenarioNameById = new Map(scenarioRows.map((s) => [s.id, s.name]));
  const titleByEventId = new Map(tracked.map((t) => [t.eventId, t.title]));

  const points = windowPoints();
  const trackedForModel = tracked.map((t) => toTrackedEvent(t, points));

  // Deterministic — "which scenario has the strongest signal" is a checkable computation, not
  // a judgment call (same rationale as ai-strategy-recommendation.ts's primary/pairing
  // selection): the model is never asked to rank, only to narrate the real ranking. Ranked by
  // health severity first (Off course/At risk scenarios need attention before a merely-
  // building one does), |momentum score| as the tiebreak within the same severity.
  const toneSeverity: Record<HealthTone, number> = { high: 2, mid: 1, low: 0 };
  const scored = scenarioIds.map((scenarioId) => {
    const m = momentum(scenarioId, trackedForModel);
    const h = health(scenarioId, trackedForModel, scenarioIds);
    return { scenarioId, scenarioName: scenarioNameById.get(scenarioId) ?? scenarioId, score: m.score, eventCount: m.contrib.length, tone: h.tone };
  });
  scored.sort((a, b) => toneSeverity[b.tone] - toneSeverity[a.tone] || Math.abs(b.score) - Math.abs(a.score));
  const ranking: ScenarioSignalRank[] = scored.map((s) => ({ scenarioId: s.scenarioId, scenarioName: s.scenarioName, score: s.score, eventCount: s.eventCount }));

  const top = ranking[0];
  const topMomentum = momentum(top.scenarioId, trackedForModel);
  const runnerUp = ranking[1] ?? null;

  const topEvents = topMomentum.contrib.map((c) => ({
    title: titleByEventId.get(c.event.eventId) ?? c.event.eventId,
    direction: (delta(c.event) > 0 ? "rising" : "falling") as "rising" | "falling",
    impact: c.event.impact,
  }));

  const output = await runStructured({
    step: "monitoring_ask_ai.most_likely_scenario",
    projectId,
    taskPrompt: RANK_SCENARIOS_PROMPT,
    input: {
      top_scenario: { name: top.scenarioName, score: top.score, events: topEvents },
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
    : topEvents.length === 0
      ? `${top.scenarioName} currently has the strongest signal, but no tracked event is actively moving it right now.`
      : `${top.scenarioName} currently has the strongest signal (score ${top.score} across ${topEvents.length} event(s)): ${topEvents.map((e) => `${e.title} (${e.direction})`).join(", ")}.`;

  return { sufficientEvidence: true, topScenarioId: top.scenarioId, topScenarioName: top.scenarioName, ranking, rationale };
}

// ─────────────────────── Task 2: Explain this event's likelihood ───────────────────────

const ExplainEventSchema = z.object({ explanation: z.string().min(20) });

const EXPLAIN_EVENT_PROMPT = `${PERSONA_SCENARIO_SENTINEL}

Task: Write a plain-language walkthrough of how ONE tracked
event's likelihood arrived at its current level, using ONLY the real, grounded readings given
below — do not introduce a new reason not present in them.

Input: { event: { title: string },
  readings: [{ date: string, rationale: string, level: string, source_title: string,
  source_url: string }] /* chronological, oldest first */ }

Rules:
- 3-5 sentences, walking the readings in order.
- Name the event and cite the specific news source titles given.
- Never invent a fact, date, or source not present in readings.

Output schema: { explanation: string }`;

export interface ExplainEventResult {
  eventId: string;
  eventTitle: string;
  explanation: string;
}

// POST .../projects/:id/monitoring/ask-ai { task: "explain_event", eventId }
export async function explainEventLikelihood(eventId: string): Promise<ExplainEventResult> {
  const supabase = createClient();

  const { data: event, error: eventError } = await supabase.from("events").select("id, project_id, title").eq("id", eventId).single();
  if (eventError) throw new NotFoundError(`Event ${eventId} could not be loaded.`);

  const { data: readings, error: readingsError } = await supabase
    .from("event_likelihood_history")
    .select("observed_at, level, cite, source_title, source_url")
    .eq("event_id", eventId)
    .not("cite", "is", null)
    .order("observed_at", { ascending: false })
    .limit(7);
  if (readingsError) throw readingsError;

  if (readings.length === 0) {
    return {
      eventId,
      eventTitle: event.title,
      explanation: "No grounded reading exists for this event yet — its likelihood hasn't been backed by a specific news item so far.",
    };
  }

  const ascending = [...readings].reverse();
  const citedReadings = ascending.map((r) => ({
    date: r.observed_at,
    rationale: r.cite as string,
    level: LIKELIHOOD_LEVELS[r.level as LikelihoodLevel],
    source_title: r.source_title ?? "(source not found)",
    source_url: r.source_url ?? "",
  }));

  const output = await runStructured({
    step: "monitoring_ask_ai.explain_event",
    projectId: event.project_id,
    taskPrompt: EXPLAIN_EVENT_PROMPT,
    input: {
      event: { title: event.title },
      readings: citedReadings,
    },
    schema: ExplainEventSchema,
    effort: "low",
    thinking: false,
  });

  return { eventId, eventTitle: event.title, explanation: output.explanation };
}

// ─────────────────────── Task 3: What changed in the last 7 days? ───────────────────────

const RecentChangesSummarySchema = z.object({ summary: z.string() });

const RECENT_CHANGES_PROMPT = `${PERSONA_SCENARIO_SENTINEL}

Task: Summarize which tracked events changed likelihood level in
the last 7 days, grouped by scenario, using ONLY the real transitions given below.

Input: { changes: [{ event_title: string, scenario_names: string[], from_level: string,
  to_level: string, date: string }] }

Rules:
- Group by scenario_names in the summary (mention events supporting several scenarios under
  each, if any are present).
- Cite each event's real title and its from→to level transition.
- Never invent a transition, event, or scenario not present in changes.
- Keep it tight — roughly one sentence per scenario group unless a group has many transitions.

Output schema: { summary: string }`;

export interface EventLikelihoodChange {
  eventId: string;
  eventTitle: string;
  scenarioNames: string[];
  fromLevel: string;
  toLevel: string;
  date: string;
}

export interface RecentChangesResult {
  changes: EventLikelihoodChange[];
  summary: string;
}

// POST .../projects/:id/monitoring/ask-ai { task: "recent_changes" }
export async function summarizeRecentEventChanges(projectId: string): Promise<RecentChangesResult> {
  const supabase = createClient();

  const tracked = await fetchTrackedEvents(supabase, projectId);
  if (tracked.length === 0) {
    return { changes: [], summary: "No tracked events exist yet." };
  }

  const scenarioIds = Array.from(new Set(tracked.flatMap((t) => t.supports)));
  const scenarioNameById = new Map<string, string>();
  if (scenarioIds.length > 0) {
    const { data: scenarioRows, error: scenariosError } = await supabase.from("scenarios").select("id, name").in("id", scenarioIds);
    if (scenariosError) throw scenariosError;
    for (const s of scenarioRows) scenarioNameById.set(s.id, s.name);
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Deterministic transition detection — no AI needed to spot a diff between consecutive
  // readings. Same per-event per-reading-lookup shape ai-home-tasks.ts's
  // whatsChangedSinceLastVisit already uses, just against a fixed 7-day window.
  const changes: EventLikelihoodChange[] = [];
  for (const event of tracked) {
    const ascending = [...event.history].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    for (let i = 1; i < ascending.length; i++) {
      const prev = ascending[i - 1];
      const curr = ascending[i];
      if (curr.level === prev.level) continue;
      if (curr.observedAt < sevenDaysAgo) continue;
      changes.push({
        eventId: event.eventId,
        eventTitle: event.title,
        scenarioNames: event.supports.map((id) => scenarioNameById.get(id) ?? id),
        fromLevel: LIKELIHOOD_LEVELS[prev.level],
        toLevel: LIKELIHOOD_LEVELS[curr.level],
        date: curr.observedAt,
      });
    }
  }

  if (changes.length === 0) {
    return { changes: [], summary: "No tracked events changed likelihood in the last 7 days." };
  }

  const output = await runStructured({
    step: "monitoring_ask_ai.recent_changes",
    projectId,
    taskPrompt: RECENT_CHANGES_PROMPT,
    input: {
      changes: changes.map((c) => ({
        event_title: c.eventTitle,
        scenario_names: c.scenarioNames,
        from_level: c.fromLevel,
        to_level: c.toLevel,
        date: c.date,
      })),
    },
    schema: RecentChangesSummarySchema,
    effort: "low",
    thinking: false,
  });

  return { changes, summary: output.summary };
}

// ─────────────────────── Task 4: Suggest events to monitor for an under-monitored scenario ───

export interface SuggestEventsForScenarioResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  targetScenarioId: string | null;
  targetScenarioName: string | null;
  suggestResult: SuggestEventsToMonitorResult | null;
}

// POST .../projects/:id/monitoring/ask-ai { task: "suggest_events" }
// No new AI call of its own — delegates directly to the existing suggestEventsToMonitor
// (ai-event-monitoring.ts, already logs its own ai_runs row under step
// "monitoring.suggest_events"). Only proceeds when the least-covered scenario has ZERO tracked
// events — suggestEventsToMonitor never deletes anything (purely additive, "never invent, only
// rank"), but a scenario that already has at least one tracked event is better served by
// Narrative's own "Monitor events" picker, which can target it directly.
export async function suggestEventMonitoringForUnderMonitoredScenario(projectId: string): Promise<SuggestEventsForScenarioResult> {
  const supabase = createClient();

  const { data: activeAxes, error: axesError } = await supabase.from("axes").select("id").eq("project_id", projectId).eq("is_active", true).maybeSingle();
  if (axesError) throw axesError;
  if (!activeAxes) {
    return { sufficientEvidence: false, gap: "This project doesn't have an active scenario matrix yet.", targetScenarioId: null, targetScenarioName: null, suggestResult: null };
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
      suggestResult: null,
    };
  }

  const { data: linkRows, error: linksError } = await supabase
    .from("event_scenario_links")
    .select("scenario_id")
    .in(
      "scenario_id",
      scenarioRows.map((s) => s.id)
    );
  if (linksError) throw linksError;

  const countByScenario = new Map(scenarioRows.map((s) => [s.id, 0]));
  for (const row of linkRows) {
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
      gap: `All scenarios have at least one tracked event (fewest is ${minCount}, on "${target.name}"). Use Narrative's own "Monitor events" picker for "${target.name}" if you want more.`,
      targetScenarioId: target.id,
      targetScenarioName: target.name,
      suggestResult: null,
    };
  }

  const suggestResult = await suggestEventsToMonitor(target.id);
  return { sufficientEvidence: true, targetScenarioId: target.id, targetScenarioName: target.name, suggestResult };
}
