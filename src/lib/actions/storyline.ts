"use server";

// What's left after Storyline's retirement (design/storyline_handoff/) — everything else in
// this file (node/edge CRUD, getStoryline) was exclusive to the old drag-and-drop Storyline
// page and has been deleted along with it. syncEventScenarioLink survives: it keeps
// event_scenario_links (0042_decision_layer.sql) in sync, and Monitoring's live
// "+ Monitor this event" action (event-monitoring.ts's addEventToMonitoring) still calls it —
// that join table, not anything storyline-specific, is what decision-tracking.ts's
// fetchTrackedEvents reads to decide an event is "tracked".
import { createClient } from "@/lib/supabase/server";
import type { Phase } from "../storyline-mapping";

type SupabaseClient = ReturnType<typeof createClient>;

export async function syncEventScenarioLink(supabase: SupabaseClient, projectId: string, scenarioId: string, eventId: string, phase: Phase) {
  const { error } = await supabase
    .from("event_scenario_links")
    .upsert({ project_id: projectId, event_id: eventId, scenario_id: scenarioId, phase }, { onConflict: "event_id,scenario_id" });
  if (error) throw error;
}
