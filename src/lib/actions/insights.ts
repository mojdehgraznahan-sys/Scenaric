"use server";

// Insights access — backend build order §14 item 4b Phase 2. Insights are AI-created
// (src/lib/actions/ai-insights.ts); delete is the only manual mutation for now.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type InsightRow = Database["public"]["Tables"]["insights"]["Row"];

export async function listInsights(projectId: string): Promise<InsightRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("insights")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getInsight(id: string): Promise<InsightRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("insights").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteInsight(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("insights").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/knowledge");
}
