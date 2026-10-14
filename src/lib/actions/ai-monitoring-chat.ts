"use server";

// Monitoring page's "Ask anything…" freeform chat — a project-scoped variant of
// askStrategyChat's grounded-chat + confirm-before-save pattern (ai-strategy-chat.ts), sitting
// alongside the fixed task menu (ai-monitoring-tasks.ts), never replacing it. Grounded strictly
// in this project's own tracked events (event_scenario_links/event_likelihood_history) and
// scenarios. Any new-event idea this surfaces is a `suggested_event` SELECTED from the
// project's own currently-untracked events — never invented, tighter than the indicators-era
// version of this file, which could propose a brand-new, fabricated indicator. Never
// auto-persisted — the same "labeled + requires confirmation before it's saved into the
// project" contract as askStrategyChat's suggested_option (see event-monitoring.ts's
// addEventToMonitoring, called only after the user clicks "+ Monitor this event" in ask-ai.tsx).
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { fetchTrackedEvents } from "@/lib/decision-tracking";
import { LIKELIHOOD_LEVELS } from "@/lib/decision-model";
import { PERSONA_SCENARIO_SENTINEL } from "@/lib/ai/personas";
import { z } from "zod";

const MonitoringChatSchema = z.object({
  answer: z.string(),
  cites: z.array(z.string()),
  suggested_event: z
    .object({
      event_id: z.string(),
      // Unlike the old indicators-era suggestion, always a real scenario — an event worth
      // monitoring is worth monitoring FOR something; event_scenario_links has no concept of
      // a scenario-less tracked event.
      scenario_id: z.string(),
      rationale: z.string(),
    })
    .optional(),
});

const MONITORING_CHAT_TASK_PROMPT = `${PERSONA_SCENARIO_SENTINEL}

Task: Answer the user's question about their tracked events
— grounded strictly in the tracked events, their recent likelihood history, and the scenarios
already in this project. Never answer from general market/industry knowledge as if it were
project fact.

Input: { question: string, focal_question: string,
  tracked_events: [{ id: string, title: string, current_level: string,
    scenario_names: string[] }],
  untracked_events: [{ id: string, title: string, status: string, category: string }]
    /* project events NOT yet tracked for any scenario — the only pool suggested_event may
    select from */,
  scenarios: [{ id: string, name: string }],
  recent_readings: [{ event_id: string, event_title: string, date: string, level: string,
    rationale: string | null }] /* up to 50 most recent, project-wide */ }

Rules:
- Answer ONLY using the supplied tracked_events/readings/scenarios. Name events and scenarios
  exactly as stored. Never invent an event, scenario, reading, or news item not present here.
- cites lists the event/scenario ids the answer actually relied on.
- If the question requires information not present here (a different project, general industry
  trends, an event that doesn't exist), say so plainly and name which page would supply it —
  never fabricate an answer to fill the gap.
- If, and only if, the user is specifically asking what's worth monitoring FOR A SPECIFIC
  SCENARIO, you may select ONE event from untracked_events via suggested_event — event_id must
  be a real id from untracked_events, never invented, and scenario_id must be a real id from
  scenarios (never null — an event worth monitoring is always worth monitoring for some
  scenario). Do not populate suggested_event for a plain informational question, or when no
  specific scenario is identifiable.
- Keep answer under ~120 words unless the user explicitly asks for more depth.

Output schema:
{ answer: string, cites: string[],
  suggested_event?: { event_id: string, scenario_id: string, rationale: string } }`;

export interface MonitoringChatResult {
  answer: string;
  cites: string[];
  suggestedEvent?: {
    eventId: string;
    eventTitle: string;
    scenarioId: string;
    scenarioName: string | null;
    rationale: string;
  };
}

export async function askMonitoringChat(input: { projectId: string; question: string }): Promise<MonitoringChatResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", input.projectId)
    .single();
  if (projectError) throw projectError;

  const tracked = await fetchTrackedEvents(supabase, input.projectId);
  const trackedEventIds = new Set(tracked.map((t) => t.eventId));

  const { data: allEvents, error: allEventsError } = await supabase
    .from("events")
    .select("id, title, status, category")
    .eq("project_id", input.projectId);
  if (allEventsError) throw allEventsError;
  const untrackedEvents = allEvents.filter((e) => !trackedEventIds.has(e.id));

  const scenarioIds = Array.from(new Set(tracked.flatMap((t) => t.supports)));
  let scenarioRows: { id: string; name: string }[] = [];
  if (scenarioIds.length > 0) {
    const { data, error } = await supabase.from("scenarios").select("id, name").in("id", scenarioIds);
    if (error) throw error;
    scenarioRows = data;
  }
  const scenarioNameById = new Map(scenarioRows.map((s) => [s.id, s.name]));

  const recentReadings = tracked
    .flatMap((t) => t.history.map((h) => ({ event_id: t.eventId, event_title: t.title, date: h.observedAt, level: LIKELIHOOD_LEVELS[h.level], rationale: h.cite })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);

  const output = await runStructured({
    step: "monitoring.chat",
    projectId: input.projectId,
    taskPrompt: MONITORING_CHAT_TASK_PROMPT,
    input: {
      question: input.question,
      focal_question: project.refined_focal_question ?? project.focal_question,
      tracked_events: tracked.map((t) => ({
        id: t.eventId,
        title: t.title,
        current_level: LIKELIHOOD_LEVELS[t.currentLevel],
        scenario_names: t.supports.map((id) => scenarioNameById.get(id) ?? id),
      })),
      untracked_events: untrackedEvents.map((e) => ({ id: e.id, title: e.title, status: e.status, category: e.category ?? "" })),
      scenarios: scenarioRows,
      recent_readings: recentReadings,
    },
    schema: MonitoringChatSchema,
    effort: "medium",
  });

  const untrackedById = new Map(untrackedEvents.map((e) => [e.id, e]));
  const validScenarioIds = new Set(scenarioRows.map((s) => s.id));

  let suggestedEvent: MonitoringChatResult["suggestedEvent"];
  if (output.suggested_event && untrackedById.has(output.suggested_event.event_id) && validScenarioIds.has(output.suggested_event.scenario_id)) {
    const s = output.suggested_event;
    suggestedEvent = {
      eventId: s.event_id,
      eventTitle: untrackedById.get(s.event_id)!.title,
      scenarioId: s.scenario_id,
      scenarioName: scenarioNameById.get(s.scenario_id) ?? null,
      rationale: s.rationale,
    };
  }

  return { answer: output.answer, cites: output.cites, suggestedEvent };
}
