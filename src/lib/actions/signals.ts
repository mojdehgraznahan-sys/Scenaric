"use server";

// Signals CRUD — backend build order §14 item 4c Phase 1. RLS (supabase/migrations/0003_rls.sql)
// scopes every query to the caller's org via project_id; no manual org/user filtering needed here.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type SignalRow = Database["public"]["Tables"]["signals"]["Row"];
export type SteepCategory = SignalRow["category"];
export type SignalOrigin = SignalRow["origin"];
export type SignalWithGrounding = SignalRow & { groundedInsightIds: string[] };

export async function listSignals(projectId: string): Promise<SignalWithGrounding[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("signals")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const { data: links, error: linksError } = await supabase
    .from("signal_insight_links")
    .select("signal_id, insight_id")
    .eq("project_id", projectId);
  if (linksError) throw linksError;

  const groundedBySignal = new Map<string, string[]>();
  for (const link of links) {
    const existing = groundedBySignal.get(link.signal_id);
    if (existing) existing.push(link.insight_id);
    else groundedBySignal.set(link.signal_id, [link.insight_id]);
  }

  return data.map((row) => ({ ...row, groundedInsightIds: groundedBySignal.get(row.id) ?? [] }));
}

export async function createSignal(input: {
  projectId: string;
  category: SteepCategory;
  source: string;
  title: string;
  body?: string;
  impact?: number | null;
  uncertainty?: "Low" | "Medium" | "High" | null;
  origin?: SignalOrigin;
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
      origin: input.origin ?? "user",
    })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/signals");
  return data;
}

export async function updateSignal(input: {
  id: string;
  title?: string;
  body?: string;
  category?: SteepCategory;
  source?: string;
  impact?: number | null;
  uncertainty?: "Low" | "Medium" | "High" | null;
}): Promise<SignalRow> {
  const supabase = createClient();
  const { id, ...fields } = input;
  const { data, error } = await supabase.from("signals").update(fields).eq("id", id).select().single();
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
