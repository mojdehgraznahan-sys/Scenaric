"use server";

// One-time indicators -> event_likelihood_history seed (design/2026-10-05 Phase 1 plan,
// Finding 1 / "retire indicators, migrate its data model"). Deterministic, not an AI call —
// unlike the Storyline backfill, there's no ambiguity to resolve, only an honest, approximate
// vocabulary mapping to apply once.
//
// indicator status (On track/Watch/Alert, a risk-level judgment, often about a whole scenario)
// and event likelihood (Ruled out..Occurred, whether a specific thing happens) measure
// different things — there's no precise formula between them. This only seeds a STARTING
// POINT for an indicator that already named one specific event (indicators.event_id, added by
// 0037_events.sql), using the plainest honest mapping (Alert -> High, Watch -> Medium,
// On track -> Low); it does not attempt to reconstruct the indicator's full reading history.
// An indicator with only a scenario_id (no specific event) gets no seed row — there's nothing
// event-specific to carry forward. Admin-triggered once, not wired into any cron.
import { createAdminClient } from "@/lib/supabase/admin";
import type { LikelihoodLevel } from "@/lib/decision-model";

function statusToLikelihoodLevel(status: "On track" | "Watch" | "Alert"): LikelihoodLevel {
  if (status === "Alert") return 3; // High — not 4 (Occurred): an Alert indicator means risk is high, not that the event has happened
  if (status === "Watch") return 2; // Medium
  return 1; // Low
}

export interface IndicatorsRetirementSeedResult {
  projectId: string;
  indicatorsEligible: number;
  eventsSeeded: number;
}

export async function seedEventLikelihoodFromIndicators(projectId: string): Promise<IndicatorsRetirementSeedResult> {
  const supabase = createAdminClient();

  const { data: indicators, error: indicatorsError } = await supabase
    .from("indicators")
    .select("id, event_id, status")
    .eq("project_id", projectId)
    .not("event_id", "is", null);
  if (indicatorsError) throw indicatorsError;
  if (indicators.length === 0) return { projectId, indicatorsEligible: 0, eventsSeeded: 0 };

  const eventIds = Array.from(new Set(indicators.map((i) => i.event_id as string)));
  const { data: alreadyTracked, error: trackedError } = await supabase.from("event_likelihood_history").select("event_id").in("event_id", eventIds);
  if (trackedError) throw trackedError;
  const alreadyTrackedIds = new Set(alreadyTracked.map((r) => r.event_id));

  const toSeed = indicators.filter((i) => i.event_id && !alreadyTrackedIds.has(i.event_id));
  if (toSeed.length === 0) return { projectId, indicatorsEligible: indicators.length, eventsSeeded: 0 };

  const { error: insertError } = await supabase.from("event_likelihood_history").insert(
    toSeed.map((i) => ({
      project_id: projectId,
      event_id: i.event_id as string,
      level: statusToLikelihoodLevel(i.status),
      changed_by: "user" as const,
      cite: `Seeded from the retired indicator's last status (${i.status}) — an approximate starting point, not a precise conversion.`,
    }))
  );
  if (insertError) throw insertError;

  return { projectId, indicatorsEligible: indicators.length, eventsSeeded: toSeed.length };
}

export async function seedEventLikelihoodFromIndicatorsForAllProjects(): Promise<IndicatorsRetirementSeedResult[]> {
  const supabase = createAdminClient();
  const { data: projects, error } = await supabase.from("projects").select("id");
  if (error) throw error;
  const results: IndicatorsRetirementSeedResult[] = [];
  for (const project of projects) results.push(await seedEventLikelihoodFromIndicators(project.id));
  return results;
}
