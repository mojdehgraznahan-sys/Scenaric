"use server";

// Signals CRUD — backend build order §14 item 4c Phase 1. RLS (supabase/migrations/0003_rls.sql)
// scopes every query to the caller's org via project_id; no manual org/user filtering needed here.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type SignalRow = Database["public"]["Tables"]["signals"]["Row"];
export type SteepCategory = SignalRow["category"];

export async function listSignals(projectId: string): Promise<SignalRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createSignal(input: {
  projectId: string;
  category: SteepCategory;
  source: string;
  title: string;
  body?: string;
  impact?: number | null;
  uncertainty?: "Low" | "Medium" | "High" | null;
}): Promise<SignalRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("signals")
    .insert({
      project_id: input.projectId,
      category: input.category,
      source: input.source,
      title: input.title,
      body: input.body ?? "",
      impact: input.impact ?? null,
      uncertainty: input.uncertainty ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/signals");
  return data;
}

export async function deleteSignal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("signals").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/signals");
}
