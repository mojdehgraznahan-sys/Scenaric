"use server";

// GET/PATCH /projects/:id/settings — the Settings page's "Project" tab (page-settings.tsx),
// previously 100% cosmetic (defaultValue-only inputs, no save path at all). Also the write
// target for the Settings Ask AI's "Draft"/"Sharpen" focal-question suggestions
// (ai-settings-tasks.ts) once a user explicitly accepts one.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ValidationError } from "@/lib/ai/errors";
import type { Database } from "@/lib/supabase/types";

export type ProjectSettings = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  "id" | "name" | "focal_question" | "refined_focal_question" | "horizon" | "industry" | "summary"
>;

export interface ProjectSettingsPatch {
  name?: string;
  focal_question?: string;
  refined_focal_question?: string | null;
  horizon?: string;
  industry?: string;
  summary?: string;
}

export async function getProjectSettings(projectId: string): Promise<ProjectSettings> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, focal_question, refined_focal_question, horizon, industry, summary")
    .eq("id", projectId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProjectSettings(projectId: string, patch: ProjectSettingsPatch): Promise<ProjectSettings> {
  const supabase = createClient();

  const { data: current, error: currentError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", projectId)
    .single();
  if (currentError) throw currentError;

  // The real risk: focal_question is not-null with no fallback anywhere downstream, unlike
  // refined_focal_question (every AI prompt already falls back to focal_question when it's
  // null — that's the intentional Step 1 gate signal, not a bug). Blanking focal_question
  // itself with no refined replacement in play would leave nothing for any prompt to read.
  const effectiveFocalQuestion = patch.focal_question !== undefined ? patch.focal_question : current.focal_question;
  const effectiveRefined = patch.refined_focal_question !== undefined ? patch.refined_focal_question : current.refined_focal_question;
  if (!effectiveFocalQuestion?.trim() && !effectiveRefined?.trim()) {
    throw new ValidationError("Focal question can't be emptied without a refined replacement — Step 1 and every AI prompt in this project depend on it.");
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .select("id, name, focal_question, refined_focal_question, horizon, industry, summary")
    .single();
  if (error) throw error;

  revalidatePath("/settings");
  return data;
}
