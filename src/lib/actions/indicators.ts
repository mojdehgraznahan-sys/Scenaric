"use server";

// Indicators access — Step 8 (Build Plan §11). Indicators are AI-generated
// (src/lib/actions/ai-indicators.ts) from a scenario's own storyline; read-only here, same
// split as insights.ts/ai-insights.ts and implications.ts/ai-implications.ts. Distinct from
// signposts.ts (if it existed) — signposts are a separate, live-web-search-grounded product
// extension tied to Storyline's plausibility refresh, never the same table or generation
// path as this static, build-order step (SCHWARTZ_METHODOLOGY_SKILL.md's "Signpost" section).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type IndicatorRow = Database["public"]["Tables"]["indicators"]["Row"];

export async function listIndicatorsForScenario(scenarioId: string): Promise<IndicatorRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("indicators")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listIndicatorsForProject(projectId: string): Promise<IndicatorRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("indicators")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export interface IndicatorWithReadings extends IndicatorRow {
  // Ascending by date (oldest first), at most 7 entries — a brand-new indicator with no
  // history yet is a valid, honest [] rather than padded/fabricated points.
  readings: { date: string; value: number }[];
}

// GET .../projects/:id/indicators — indicators joined with their last 7 indicator_readings
// for the sparkline. One .limit(7) query per indicator (reusing the exact query shape
// indicators-monitoring.ts's own trend recompute already trusts) rather than a single
// fetch-all-then-group-in-JS query — indicator_readings is append-only and unbounded over a
// project's lifetime, so per-indicator limit(7) queries stay cheap forever regardless of how
// much history accumulates, unlike "fetch every reading for these indicator ids."
export async function listIndicatorsForProjectWithReadings(projectId: string): Promise<IndicatorWithReadings[]> {
  const supabase = createClient();
  const { data: indicators, error } = await supabase
    .from("indicators")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (indicators.length === 0) return [];

  const readingsByIndicator = await Promise.all(
    indicators.map(async (indicator) => {
      const { data: readings, error: readingsError } = await supabase
        .from("indicator_readings")
        .select("date, value")
        .eq("indicator_id", indicator.id)
        .order("date", { ascending: false })
        .limit(7);
      if (readingsError) throw readingsError;
      return [...readings].reverse();
    })
  );

  return indicators.map((indicator, i) => ({ ...indicator, readings: readingsByIndicator[i] }));
}

export interface AlertIndicatorSummary {
  indicatorId: string;
  indicatorName: string;
  scenarioId: string | null;
  // Verbatim from the most recent grounded indicator_readings row — never invented at request
  // time, this is a pure DB read.
  rationale: string;
  asOfDate: string;
}

// GET .../projects/:id/indicators/alert-summary — current Alert-status indicators, for the
// "N indicators in alert" banner. Every indicator currently in Alert status was moved there by
// a validated, grounded update (ai-indicators-evaluation.ts's schema requires grounded_in +
// rationale on every update) — so in practice every Alert indicator has a real grounded
// reading to cite. An Alert indicator with zero grounded readings is skipped rather than
// given fallback/fabricated text — defensive code for a hypothetical future write path
// (e.g. a manual status edit), not a case reachable today.
export async function listAlertIndicatorSummaries(projectId: string): Promise<AlertIndicatorSummary[]> {
  const supabase = createClient();
  const { data: alertIndicators, error } = await supabase
    .from("indicators")
    .select("id, name, scenario_id")
    .eq("project_id", projectId)
    .eq("status", "Alert");
  if (error) throw error;
  if (alertIndicators.length === 0) return [];

  const summaries = await Promise.all(
    alertIndicators.map(async (indicator): Promise<AlertIndicatorSummary | null> => {
      const { data: reading, error: readingError } = await supabase
        .from("indicator_readings")
        .select("rationale, date")
        .eq("indicator_id", indicator.id)
        .not("grounded_in", "is", null)
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (readingError) throw readingError;
      if (!reading || !reading.rationale) return null;
      return { indicatorId: indicator.id, indicatorName: indicator.name, scenarioId: indicator.scenario_id, rationale: reading.rationale, asOfDate: reading.date };
    })
  );

  return summaries.filter((s): s is AlertIndicatorSummary => s != null);
}

// "Add indicator" → Manual mode. Mirrors strategy.ts's createManualStrategicOption exactly —
// grounded_in stays null and is never validated, since a human's own manual entry isn't bound
// by the same AI-grounding discipline that constrains model output
// (SCHWARTZ_METHODOLOGY_SKILL.md). status: "Watch" (not "On track") matches the AI generation
// path's own starting state — "On track" would falsely imply an already-evaluated-and-clear
// indicator with zero history. Picked up automatically by tomorrow's cron run with no other
// change needed.
export async function createManualIndicator(input: {
  projectId: string;
  scenarioId: string | null;
  name: string;
  note?: string | null;
  triggerCondition?: string | null;
}): Promise<IndicatorRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("indicators")
    .insert({
      project_id: input.projectId,
      scenario_id: input.scenarioId,
      name: input.name,
      note: input.note ?? null,
      trigger_condition: input.triggerCondition ?? null,
      status: "Watch",
      source_type: "project",
      created_via: "manual",
    })
    .select()
    .single();
  if (error) throw error;

  revalidatePath("/monitoring");
  return data;
}
