"use server";

// GET/PATCH /projects/:id/ai-settings — the Settings page's "AI Analyst" tab, previously 4
// toggles with pure local useState and zero persistence or behavioral effect. Also read by
// sources.ts (auto_extract_insights), ai-news-items.ts (suggest_from_news_feeds),
// weekly-digest.ts (weekly_digest), and ai-strategy.ts/ai-storyline.ts (strict_schwartz_mode)
// — this file is the single place that knows the default values, so "no row yet" behaves
// identically everywhere rather than each caller guessing its own default.
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type ProjectAiSettings = Omit<Database["public"]["Tables"]["project_ai_settings"]["Row"], "updated_at">;

// Matches project_ai_settings' own column defaults exactly — a project with no row yet
// behaves identically to one whose row was just inserted with all defaults.
const DEFAULT_SETTINGS: Omit<ProjectAiSettings, "project_id"> = {
  auto_extract_insights: true,
  suggest_from_news_feeds: true,
  weekly_digest: false,
  strict_schwartz_mode: true,
};

export async function getProjectAiSettings(projectId: string, supabaseClient?: SupabaseClient<Database>): Promise<ProjectAiSettings> {
  const supabase = supabaseClient ?? createClient();
  const { data, error } = await supabase
    .from("project_ai_settings")
    .select("project_id, auto_extract_insights, suggest_from_news_feeds, weekly_digest, strict_schwartz_mode")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data ?? { project_id: projectId, ...DEFAULT_SETTINGS };
}

// Batched variant for the news-feed cron's all-projects loop — one query instead of N.
// Projects with no row are simply absent from the returned map; callers apply
// DEFAULT_SETTINGS themselves (see ai-news-items.ts).
export async function getProjectAiSettingsMap(
  projectIds: string[],
  supabaseClient: SupabaseClient<Database>
): Promise<Map<string, ProjectAiSettings>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await supabaseClient
    .from("project_ai_settings")
    .select("project_id, auto_extract_insights, suggest_from_news_feeds, weekly_digest, strict_schwartz_mode")
    .in("project_id", projectIds);
  if (error) throw error;
  return new Map(data.map((row) => [row.project_id, row]));
}

export async function updateProjectAiSettings(projectId: string, patch: Partial<Omit<ProjectAiSettings, "project_id">>): Promise<ProjectAiSettings> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("project_ai_settings")
    .upsert({ project_id: projectId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "project_id" })
    .select("project_id, auto_extract_insights, suggest_from_news_feeds, weekly_digest, strict_schwartz_mode")
    .single();
  if (error) throw error;
  revalidatePath("/settings");
  return data;
}
