"use server";

// Narrative page's "Monitor events" — plain CRUD over event_scenario_links, the same table
// Storyline's own syncEventScenarioLink (storyline.ts) already writes to whenever a chain node
// is grounded in an event. This is the direct successor to indicators.ts's createManualIndicator
// (0042_decision_layer.sql's documented retirement): instead of creating a new Indicator entity,
// the user marks one of the project's existing events as worth monitoring for a scenario.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncEventScenarioLink } from "./storyline";
import type { Phase } from "../storyline-mapping";

export interface MonitoredEventRow {
  eventId: string;
  title: string;
  status: "observed" | "possible";
  likelihood: "Low" | "Medium" | "High" | null;
  phase: Phase;
}

// GET .../scenarios/:id/monitored-events — "already monitored" pre-checked state for the
// Narrative page's picker.
export async function listScenarioMonitoredEvents(scenarioId: string): Promise<MonitoredEventRow[]> {
  const supabase = createClient();

  const { data: links, error: linksError } = await supabase.from("event_scenario_links").select("event_id, phase").eq("scenario_id", scenarioId);
  if (linksError) throw linksError;
  if (links.length === 0) return [];

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, status, likelihood")
    .in(
      "id",
      links.map((l) => l.event_id)
    );
  if (eventsError) throw eventsError;

  const phaseByEventId = new Map(links.map((l) => [l.event_id, l.phase as Phase]));
  return events.map((e) => ({ eventId: e.id, title: e.title, status: e.status, likelihood: e.likelihood, phase: phaseByEventId.get(e.id)! }));
}

// POST .../scenarios/:id/monitored-events { eventId } — thin wrapper over
// syncEventScenarioLink; "precursors" is the same default reviewDiscoveredEvent (decisions.ts)
// already uses for a freshly-linked event with no storyline placement yet.
export async function addEventToMonitoring(projectId: string, scenarioId: string, eventId: string, phase: Phase = "precursors"): Promise<void> {
  const supabase = createClient();
  await syncEventScenarioLink(supabase, projectId, scenarioId, eventId, phase);
  revalidatePath("/monitoring");
  revalidatePath("/narrative");
}

// DELETE .../scenarios/:id/monitored-events/:eventId
export async function removeEventFromMonitoring(scenarioId: string, eventId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("event_scenario_links").delete().eq("scenario_id", scenarioId).eq("event_id", eventId);
  if (error) throw error;
  revalidatePath("/monitoring");
  revalidatePath("/narrative");
}
