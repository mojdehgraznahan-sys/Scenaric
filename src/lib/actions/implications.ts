"use server";

// Implications access — Step 7 (Build Plan §10). Implications are AI-generated
// (src/lib/actions/ai-implications.ts) from a scenario's own narrative; read-only here,
// same split as insights.ts/ai-insights.ts.
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type ImplicationRow = Database["public"]["Tables"]["implications"]["Row"];

export async function listImplications(scenarioId: string): Promise<ImplicationRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("implications")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}
