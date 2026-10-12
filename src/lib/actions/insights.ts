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

// RLS (0003_rls.sql) only scopes to the caller's org, not this specific project — without the
// explicit .eq("project_id", ...) a stale insight id from a sibling project in the same org
// would otherwise return/delete the wrong project's insight (getInsight feeds page-signals.tsx's
// mergeInsight deep link, so this doubles as the fix for that leaking another project's text
// into the current one's Add Event modal).
export async function getInsight(projectId: string, id: string): Promise<InsightRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("insights").select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function deleteInsight(projectId: string, id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("insights").delete().eq("id", id).eq("project_id", projectId).select("id").single();
  if (error) throw error;
  revalidatePath("/knowledge");
}
