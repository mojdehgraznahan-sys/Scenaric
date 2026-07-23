"use server";

// Project CRUD — backend build order §14 item 1. RLS (supabase/migrations/0003_rls.sql)
// scopes every query to the caller's org; no manual org/user filtering needed here.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];

// steps_complete is server-derived (§13 / build order §14 item 2) — list_projects_with_progress
// (supabase/migrations/0005_steps_complete_gate.sql) computes it fresh from real child-table
// data on every call rather than reading the (otherwise-stale) stored column.
export async function listProjects(): Promise<ProjectRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("list_projects_with_progress");
  if (error) throw error;
  return data;
}

async function currentOrgId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data, error } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();
  if (error) throw error;
  return data.org_id;
}

export async function createProject(input: {
  name: string;
  focal_question?: string;
  refined_focal_question?: string | null;
  horizon?: string;
  industry?: string;
  summary?: string;
}): Promise<ProjectRow> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const org_id = await currentOrgId();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      org_id,
      name: input.name,
      focal_question: input.focal_question || "",
      refined_focal_question: input.refined_focal_question ?? null,
      horizon: input.horizon || "",
      industry: input.industry || "",
      summary: input.summary || "",
      created_by: user?.id,
    })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/projects");
  return data;
}

export async function renameProject(id: string, name: string): Promise<ProjectRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/projects");
  return data;
}

export async function duplicateProject(id: string): Promise<ProjectRow> {
  const supabase = createClient();
  const { data: source, error: readError } = await supabase.from("projects").select("*").eq("id", id).single();
  if (readError) throw readError;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("projects")
    .insert({
      org_id: source.org_id,
      name: source.name + " (Copy)",
      focal_question: source.focal_question,
      horizon: source.horizon,
      industry: source.industry,
      summary: source.summary,
      created_by: user?.id,
    })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/projects");
  return data;
}

export async function setProjectArchived(id: string, archived: boolean): Promise<ProjectRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ archived, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/projects");
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/projects");
}
