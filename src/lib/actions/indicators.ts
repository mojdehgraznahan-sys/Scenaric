"use server";

// Indicators access — Step 8 (Build Plan §11). Indicators are AI-generated
// (src/lib/actions/ai-indicators.ts) from a scenario's own storyline; read-only here, same
// split as insights.ts/ai-insights.ts and implications.ts/ai-implications.ts. Distinct from
// signposts.ts (if it existed) — signposts are a separate, live-web-search-grounded product
// extension tied to Storyline's plausibility refresh, never the same table or generation
// path as this static, build-order step (SCHWARTZ_METHODOLOGY_SKILL.md's "Signpost" section).
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
