"use server";

// GET /projects/:id/dashboard — replaces page-dashboard.tsx's client-derived stepsComplete/
// kpis (previously seed.stats demo data) with real, server-computed values. stepsComplete
// reuses the exact canonical gating function list_projects_with_progress() already wraps
// (supabase/migrations/0005_steps_complete_gate.sql, most recently redefined by
// 0023_strategy_gate_and_drop_strategies.sql) — no second gating implementation.
import { createClient } from "@/lib/supabase/server";

export interface DashboardKpi {
  value: number;
  sub: string;
}

export interface ProjectDashboard {
  stepsComplete: number;
  kpis: {
    signals: DashboardKpi;
    scenarios: DashboardKpi;
    indicators: DashboardKpi;
    strategicOptions: DashboardKpi;
  };
}

export async function getProjectDashboard(projectId: string): Promise<ProjectDashboard> {
  const supabase = createClient();

  const { data: stepsComplete, error: stepsError } = await supabase.rpc("compute_steps_complete", { p_project_id: projectId });
  if (stepsError) throw stepsError;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: signals, error: signalsError }, { data: scenarios, error: scenariosError }, { data: indicators, error: indicatorsError }] =
    await Promise.all([
      supabase.from("signals").select("created_at").eq("project_id", projectId),
      supabase.from("scenarios").select("id").eq("project_id", projectId).eq("is_archived", false),
      supabase.from("indicators").select("status").eq("project_id", projectId),
    ]);
  if (signalsError) throw signalsError;
  if (scenariosError) throw scenariosError;
  if (indicatorsError) throw indicatorsError;

  const signalsThisWeek = signals.filter((s) => s.created_at >= sevenDaysAgo).length;
  const indicatorsInAlert = indicators.filter((i) => i.status === "Alert").length;

  const { data: strategicOptions, error: strategicOptionsError } = await supabase
    .from("strategic_options")
    .select("id, is_primary")
    .eq("project_id", projectId);
  if (strategicOptionsError) throw strategicOptionsError;

  const primaryOption = strategicOptions.find((o) => o.is_primary);
  let robustCount = 0;
  if (primaryOption) {
    const { data: robustScores, error: robustScoresError } = await supabase
      .from("strategy_scenario_scores")
      .select("id")
      .eq("strategy_id", primaryOption.id)
      .eq("robust", true);
    if (robustScoresError) throw robustScoresError;
    robustCount = robustScores.length;
  }

  return {
    stepsComplete,
    kpis: {
      signals: {
        value: signals.length,
        sub: signals.length > 0 ? `+${signalsThisWeek} this week` : "Add your first signal",
      },
      scenarios: {
        value: scenarios.length,
        sub: scenarios.length > 0 ? "Ready for narratives" : "Build your matrix first",
      },
      indicators: {
        value: indicators.length,
        sub: indicators.length > 0 ? `${indicatorsInAlert} in alert` : "Not set up yet",
      },
      strategicOptions: {
        value: strategicOptions.length,
        sub: primaryOption && robustCount > 0 ? `${robustCount} robust across futures` : strategicOptions.length > 0 ? "Wind-tunnelling in progress" : "Not started",
      },
    },
  };
}
