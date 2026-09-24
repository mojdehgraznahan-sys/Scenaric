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

// Onboarding's Step 1 four-block interview answers (focal-interview-blocks.ts /
// OnboardingState's blockA-D in store.tsx) — passed through from launch() so they survive
// past the wizard instead of being dropped, per SIGNALS_ASK_AI_PROMPTS.md's need for this
// data on the Signals page well after onboarding is over. All fields optional/nullable:
// any block (or individual optional question within it) may have been skipped.
export interface OnboardingAnswersInput {
  companyName?: string | null;
  blockA?: { keepsAwake?: string; decision5to10yr?: string; ownerAndDeadline?: string; ifWrongBreaks?: string };
  blockB?: { oracleQ1?: string; oracleQ2?: string; oracleQ3?: string };
  blockC?: { bestCaseAndPath?: string; worstCaseAndPivots?: string; turningPoints?: string };
  blockD?: { inevitable?: string; genuinelyUncertain?: string; dependencies?: string };
}

// Blank onboarding answers (e.g. "" for a skipped question) are stored as null, not "" —
// lets buildSignalsContext/per-chip gating tell "unanswered" apart from "answered blank".
function blankToNull(v: string | undefined | null): string | null {
  return v && v.trim() ? v : null;
}

export async function createProject(input: {
  name: string;
  focal_question?: string;
  refined_focal_question?: string | null;
  horizon?: string;
  industry?: string;
  summary?: string;
  onboardingAnswers?: OnboardingAnswersInput;
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

  const a = input.onboardingAnswers;
  if (a) {
    const { error: answersError } = await supabase.from("onboarding_answers").insert({
      project_id: data.id,
      company_name: blankToNull(a.companyName),
      keeps_awake: blankToNull(a.blockA?.keepsAwake),
      decision_5to10yr: blankToNull(a.blockA?.decision5to10yr),
      owner_and_deadline: blankToNull(a.blockA?.ownerAndDeadline),
      if_wrong_breaks: blankToNull(a.blockA?.ifWrongBreaks),
      oracle_q1: blankToNull(a.blockB?.oracleQ1),
      oracle_q2: blankToNull(a.blockB?.oracleQ2),
      oracle_q3: blankToNull(a.blockB?.oracleQ3),
      best_case_and_path: blankToNull(a.blockC?.bestCaseAndPath),
      worst_case_and_pivots: blankToNull(a.blockC?.worstCaseAndPivots),
      turning_points: blankToNull(a.blockC?.turningPoints),
      inevitable: blankToNull(a.blockD?.inevitable),
      genuinely_uncertain: blankToNull(a.blockD?.genuinelyUncertain),
      dependencies: blankToNull(a.blockD?.dependencies),
    });
    if (answersError) throw answersError;
  }

  revalidatePath("/projects");
  return data;
}

// Read-side counterpart to createProject's onboarding_answers insert above. Field names here
// match SIGNALS_ASK_AI_PROMPTS.md's token names ({awake}, {o1}, {given}, {actors}, ...) rather
// than the DB's blockA-D-derived column names, since this is the shape AI prompt builders
// (buildSignalsContext, Phase 1+) actually want to interpolate from.
export interface OnboardingAnswers {
  companyName: string | null;
  awake: string | null;
  decision: string | null;
  owner: string | null;
  stakes: string | null;
  o1: string | null;
  o2: string | null;
  o3: string | null;
  good: string | null;
  bad: string | null;
  turns: string | null;
  given: string | null;
  open: string | null;
  actors: string | null;
}

export async function getOnboardingAnswers(projectId: string): Promise<OnboardingAnswers | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("onboarding_answers").select("*").eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    companyName: data.company_name,
    awake: data.keeps_awake,
    decision: data.decision_5to10yr,
    owner: data.owner_and_deadline,
    stakes: data.if_wrong_breaks,
    o1: data.oracle_q1,
    o2: data.oracle_q2,
    o3: data.oracle_q3,
    good: data.best_case_and_path,
    bad: data.worst_case_and_pivots,
    turns: data.turning_points,
    given: data.inevitable,
    open: data.genuinely_uncertain,
    actors: data.dependencies,
  };
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
