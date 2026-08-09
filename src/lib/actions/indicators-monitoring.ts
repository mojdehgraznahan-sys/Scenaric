"use server";

// Daily indicator monitoring job — Step 8 (Indicators) follow-on (Build Plan §11;
// SCHWARTZ_METHODOLOGY_SKILL.md's Step 8 row). Triggered by Vercel Cron once every 24h
// (src/app/api/cron/indicators-monitor/route.ts), never by a user session — every read/write
// here goes through createAdminClient() (service-role, bypasses RLS), since createClient()
// (cookie-based) would silently match zero rows under RLS with no session to resolve
// current_org_id() from, not throw. Distinct from Signposts (ai-grounding.ts) — that's a
// separate, on-demand, per-scenario product extension; this job never touches it.
import { createAdminClient } from "@/lib/supabase/admin";
import { pullNewsFeed } from "./ai-news-feed";
import { evaluateIndicatorsAgainstNews, type IndicatorStatusUpdate } from "./ai-indicators-evaluation";

export type IndicatorStatus = "On track" | "Watch" | "Alert";

// "up" = escalating severity (this scenario's discriminating signal strengthening), "down" =
// the reverse — a scenario isn't intrinsically good or bad, so this is a strength-of-signal
// axis, not a "risk" or "good/bad" one. Documented here since the direction is genuinely
// ambiguous language otherwise; any future UI copy should not imply "up = good." Exported so
// ai-monitoring-tasks.ts's "most likely scenario" ranking reuses the exact same severity
// weighting rather than redefining it.
export const STATUS_ORDINAL: Record<IndicatorStatus, number> = { "On track": 0, Watch: 1, Alert: 2 };

function computeTrend(ascendingReadings: { value: number }[]): "up" | "flat" | "down" | null {
  if (ascendingReadings.length < 2) return null;
  const first = ascendingReadings[0].value;
  const last = ascendingReadings[ascendingReadings.length - 1].value;
  if (last > first) return "up";
  if (last < first) return "down";
  return "flat";
}

export interface IndicatorMonitoringProjectResult {
  projectId: string;
  indicatorsProcessed: number;
  statusChanges: number;
  sourcesCreated: number;
}

// One project's daily pass: ingest news, evaluate active indicators against it, append one
// reading per indicator for today, recompute trend.
export async function runIndicatorMonitoringForProject(projectId: string, batchId: string): Promise<IndicatorMonitoringProjectResult> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: indicatorRows, error: indicatorsError } = await supabase
    .from("indicators")
    .select("id, scenario_id, name, status, trigger_condition")
    .eq("project_id", projectId);
  if (indicatorsError) throw indicatorsError;
  if (indicatorRows.length === 0) {
    return { projectId, indicatorsProcessed: 0, statusChanges: 0, sourcesCreated: 0 };
  }

  // Skip indicators whose linked scenario has been archived (a manually-created,
  // scenario-less indicator has no scenario_id at all and is always active) — same "!archived"
  // convention Canvas/Strategy already use, joined manually here since this repo's hand-written
  // Supabase types don't model embedded-resource relationships.
  const scenarioIds = Array.from(new Set(indicatorRows.map((i) => i.scenario_id).filter((id): id is string => id != null)));
  const scenarioById = new Map<string, { name: string; isArchived: boolean }>();
  if (scenarioIds.length > 0) {
    const { data: scenarioRows, error: scenariosError } = await supabase.from("scenarios").select("id, name, is_archived").in("id", scenarioIds);
    if (scenariosError) throw scenariosError;
    for (const s of scenarioRows) scenarioById.set(s.id, { name: s.name, isArchived: s.is_archived });
  }

  const active = indicatorRows.filter((i) => !i.scenario_id || scenarioById.get(i.scenario_id)?.isArchived !== true);
  if (active.length === 0) {
    return { projectId, indicatorsProcessed: 0, statusChanges: 0, sourcesCreated: 0 };
  }

  const newsResult = await pullNewsFeed(projectId, {
    supabaseClient: supabase,
    uploadedBy: null,
    focusTopics: active.map((i) => ({ name: i.name, triggerCondition: i.trigger_condition })),
    batchId,
  });

  let updates: IndicatorStatusUpdate[] = [];
  if (newsResult.sufficientEvidence && newsResult.sources.length > 0) {
    updates = await evaluateIndicatorsAgainstNews(
      projectId,
      active.map((i) => ({
        id: i.id,
        name: i.name,
        scenarioName: i.scenario_id ? (scenarioById.get(i.scenario_id)?.name ?? "(scenario not found)") : "(no scenario)",
        currentStatus: i.status,
        triggerCondition: i.trigger_condition,
      })),
      newsResult.sources.map((s) => ({ id: s.id, title: s.title, publishedDate: s.publishedDate, summary: s.summary })),
      batchId
    );
  }
  // If there's no news today (sufficientEvidence:false / zero items) or a specific indicator
  // wasn't mentioned, `updates` simply has no entry for it — the loop below carries its
  // current status forward either way, collapsing "no news today" and "news came in but didn't
  // concern this indicator" into the same code path.

  let statusChanges = 0;
  for (const indicator of active) {
    const update = updates.find((u) => u.indicatorId === indicator.id);
    const newStatus: IndicatorStatus = update?.newStatus ?? indicator.status;
    const value = STATUS_ORDINAL[newStatus];

    const { error: readingError } = await supabase.from("indicator_readings").upsert(
      {
        project_id: projectId,
        indicator_id: indicator.id,
        date: today,
        value,
        status_at_time: newStatus,
        grounded_in: update?.groundedIn ?? null,
        rationale: update?.rationale ?? null,
      },
      { onConflict: "indicator_id,date" }
    );
    if (readingError) throw readingError;

    const patch: { last_checked: string; status?: IndicatorStatus } = { last_checked: new Date().toISOString() };
    if (update) {
      patch.status = newStatus;
      statusChanges += 1;
    }
    const { error: updateError } = await supabase.from("indicators").update(patch).eq("id", indicator.id);
    if (updateError) throw updateError;
  }

  // Deterministic trend recompute — no AI call. "Last 7 rows" (not "last 7 calendar days") so
  // a single missed cron run doesn't require gap-filling logic.
  for (const indicator of active) {
    const { data: recent, error: recentError } = await supabase
      .from("indicator_readings")
      .select("value")
      .eq("indicator_id", indicator.id)
      .order("date", { ascending: false })
      .limit(7);
    if (recentError) throw recentError;
    const trend = computeTrend([...recent].reverse());
    const { error: trendError } = await supabase.from("indicators").update({ trend }).eq("id", indicator.id);
    if (trendError) throw trendError;
  }

  return { projectId, indicatorsProcessed: active.length, statusChanges, sourcesCreated: newsResult.sourcesCreated };
}

export interface IndicatorMonitoringSummary {
  batchId: string;
  projectsProcessed: number;
  projectsSkipped: number;
  errors: { projectId: string; message: string }[];
}

// Entry point for the cron route — one batchId shared across every project this invocation
// touches, so the whole day's run is queryable as a unit in ai_runs.
export async function runIndicatorMonitoringForAllProjects(): Promise<IndicatorMonitoringSummary> {
  const batchId = crypto.randomUUID();
  const supabase = createAdminClient();

  const { data: projects, error } = await supabase.from("projects").select("id").eq("archived", false);
  if (error) throw error;

  let projectsProcessed = 0;
  let projectsSkipped = 0;
  const errors: { projectId: string; message: string }[] = [];

  for (const project of projects) {
    try {
      const result = await runIndicatorMonitoringForProject(project.id, batchId);
      if (result.indicatorsProcessed === 0) projectsSkipped += 1;
      else projectsProcessed += 1;
    } catch (err) {
      errors.push({ projectId: project.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { batchId, projectsProcessed, projectsSkipped, errors };
}
