"use server";

// Interviews CRUD — Knowledge Base right column ("+ Invite participant"). Real participant
// name/role/STEEP tag/quote, manually logged — no AI involved in populating this (the §5
// insight-extraction step never produces participant identity). RLS (0003_rls.sql) scopes
// every query to the caller's org via project_id.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type InterviewRow = Database["public"]["Tables"]["interviews"]["Row"];
export type SteepTag = NonNullable<InterviewRow["tag"]>;

export async function listInterviews(projectId: string): Promise<InterviewRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInterview(input: {
  projectId: string;
  participantName: string;
  role?: string | null;
  tag?: SteepTag | null;
  keyQuote?: string | null;
  sourceId?: string | null;
}): Promise<InterviewRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("interviews")
    .insert({
      project_id: input.projectId,
      participant_name: input.participantName,
      role: input.role ?? null,
      tag: input.tag ?? null,
      key_quote: input.keyQuote ?? null,
      source_id: input.sourceId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/knowledge");
  return data;
}

export async function deleteInterview(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("interviews").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/knowledge");
}
