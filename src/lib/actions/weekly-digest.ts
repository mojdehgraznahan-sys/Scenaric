"use server";

// Weekly scenario digest — AI Analyst tab's "Send weekly scenario digest" toggle
// (project_ai_settings.weekly_digest, default OFF). New email infrastructure: this is the
// first place this codebase sends outbound email (via Resend) — see RESEND_API_KEY/
// RESEND_FROM_EMAIL in .env.local.example.
//
// Digest content reuses summarizeWeekSignals (ai-home-tasks.ts, already built for the Home
// dashboard's Ask AI "Summarize this week's signals" task — same STEEP-grouped real signal
// summary, already ai_runs-logged) rather than re-deriving it, plus real indicator-alert and
// recent-news counts via the same simple queries dashboard.ts/news.ts already use.
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeWeekSignals } from "./ai-home-tasks";
import { getProjectAiSettingsMap } from "./project-ai-settings";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured — set it in .env.local (see .env.local.example) to send the weekly digest.");
  return new Resend(apiKey);
}

function renderDigestHtml(projectName: string, weekSignals: Awaited<ReturnType<typeof summarizeWeekSignals>>, indicatorsInAlert: number, newsThisWeek: number): string {
  const categoriesHtml =
    weekSignals.totalSignals === 0
      ? "<p>No new signals this week.</p>"
      : weekSignals.categories
          .map((c) => `<p><strong>${c.category}</strong> (${c.count}) — ${c.summary}</p>`)
          .join("");
  return `
    <h2>Weekly digest — ${projectName}</h2>
    <p>${weekSignals.totalSignals} new signal(s) this week, ${indicatorsInAlert} indicator(s) in alert, ${newsThisWeek} news item(s) pulled.</p>
    ${categoriesHtml}
  `;
}

async function computeAndSendDigestForProject(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<{ recipients: number }> {
  const { data: project, error: projectError } = await supabase.from("projects").select("name, org_id").eq("id", projectId).single();
  if (projectError) throw projectError;

  const { data: recipients, error: recipientsError } = await supabase.from("profiles").select("email").eq("org_id", project.org_id);
  if (recipientsError) throw recipientsError;
  if (recipients.length === 0) return { recipients: 0 };

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [weekSignals, { count: indicatorsInAlert }, { count: newsThisWeek }] = await Promise.all([
    summarizeWeekSignals(projectId, supabase),
    supabase.from("indicators").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "Alert"),
    supabase.from("news_items").select("id", { count: "exact", head: true }).eq("project_id", projectId).gte("created_at", sevenDaysAgo),
  ]);

  const fromAddress = process.env.RESEND_FROM_EMAIL;
  if (!fromAddress) throw new Error("RESEND_FROM_EMAIL is not configured — set it in .env.local (see .env.local.example) to send the weekly digest.");

  const resend = getResendClient();
  const { error: sendError } = await resend.emails.send({
    from: fromAddress,
    to: recipients.map((r) => r.email),
    subject: `Scenaric weekly digest — ${project.name}`,
    html: renderDigestHtml(project.name, weekSignals, indicatorsInAlert ?? 0, newsThisWeek ?? 0),
  });
  if (sendError) throw new Error(sendError.message);

  return { recipients: recipients.length };
}

export interface WeeklyDigestSummary {
  projectsSent: number;
  projectsSkipped: number;
  errors: { projectId: string; message: string }[];
}

// Entry point for the weekly-digest cron route — same shape as runNewsFeedForAllProjects/
// runIndicatorMonitoringForAllProjects (serial per-project loop, per-project errors collected
// rather than aborting the whole run). Only projects with weekly_digest explicitly true are
// sent to — default is OFF, matching the toggle's prior mock value.
export async function runWeeklyDigestForAllProjects(): Promise<WeeklyDigestSummary> {
  const supabase = createAdminClient();

  const { data: projects, error } = await supabase.from("projects").select("id").eq("archived", false);
  if (error) throw error;

  const settingsByProject = await getProjectAiSettingsMap(
    projects.map((p) => p.id),
    supabase
  );

  let projectsSent = 0;
  let projectsSkipped = 0;
  const errors: { projectId: string; message: string }[] = [];

  for (const project of projects) {
    if (settingsByProject.get(project.id)?.weekly_digest !== true) {
      projectsSkipped += 1;
      continue;
    }
    try {
      await computeAndSendDigestForProject(supabase, project.id);
      projectsSent += 1;
    } catch (err) {
      errors.push({ projectId: project.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { projectsSent, projectsSkipped, errors };
}
