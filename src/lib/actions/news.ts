"use server";

// GET /projects/:id/news — powers the dashboard's News Feed card. "unread" (Task 3) =
// published after this project's last dashboard-view timestamp (projects.dashboard_last_
// viewed_at, supabase/migrations/0026_news_items.sql), persisted per-project (this app has
// no per-user project-membership table — same precedent as projects.updated_at already being
// the sole "last activity" signal elsewhere on the dashboard).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type NewsItemRow = Database["public"]["Tables"]["news_items"]["Row"];

export async function listProjectNews(projectId: string, options: { unreadOnly?: boolean } = {}): Promise<{ items: NewsItemRow[]; unreadCount: number }> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("dashboard_last_viewed_at")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  let query = supabase.from("news_items").select("*").eq("project_id", projectId).order("published_at", { ascending: false });

  // A null dashboard_last_viewed_at means "never viewed" — everything counts as unread, so no
  // filter is applied in that case (rather than excluding rows with a null published_at).
  if (options.unreadOnly && project.dashboard_last_viewed_at) {
    query = query.gt("published_at", project.dashboard_last_viewed_at);
  }

  const { data: items, error: itemsError } = await query;
  if (itemsError) throw itemsError;

  let unreadCount = items.length;
  if (!options.unreadOnly) {
    unreadCount = project.dashboard_last_viewed_at
      ? items.filter((item) => item.published_at !== null && item.published_at > project.dashboard_last_viewed_at!).length
      : items.length;
  }

  return { items, unreadCount };
}

export async function markDashboardViewed(projectId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("projects").update({ dashboard_last_viewed_at: new Date().toISOString() }).eq("id", projectId);
  if (error) throw error;
  revalidatePath("/home");
}
