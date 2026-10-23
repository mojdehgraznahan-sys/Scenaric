"use server";

// What's left after Narrative's retirement (design/storyline_handoff/) — listScenarioMonitoredEvents
// and removeEventFromMonitoring were exclusive to Narrative's own "Monitor events" picker and
// have been deleted along with it. addEventToMonitoring survives: Monitoring's live Ask-AI
// "+ Monitor this event" action (ask-ai.tsx, context="monitoring") still calls it — a thin
// wrapper over syncEventScenarioLink (storyline.ts), the direct successor to indicators.ts's
// createManualIndicator (0042_decision_layer.sql's documented retirement).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { syncEventScenarioLink } from "./storyline";
import type { Phase } from "../storyline-mapping";

export async function addEventToMonitoring(projectId: string, scenarioId: string, eventId: string, phase: Phase = "precursors"): Promise<void> {
  const supabase = createClient();
  await syncEventScenarioLink(supabase, projectId, scenarioId, eventId, phase);
  revalidatePath("/monitoring");
}
