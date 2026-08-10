"use server";

// POST /projects/:id/dashboard/recommendations — replaces the Home dashboard's two hardcoded
// "Recommended next"/"Monitor" cards (page-dashboard.tsx) with real, grounded copy. Candidate
// SELECTION stays deterministic (same "code picks the real target, AI only narrates" discipline
// as ai-strategy-recommendation.ts's primary/pairing selection and ai-monitoring-tasks.ts's
// scenario ranking) — the model only judges whether a candidate is worth_surfacing and writes
// its one-sentence, number-citing rationale. This keeps every route/CTA 100% real, never a
// hallucinated link.
//
// getNextGate/getMonitorCandidate are also reused verbatim by ai-home-tasks.ts's next_steps and
// explain_progress Ask AI tasks — one computation, two presentations (compact card vs.
// conversational paragraph) — so the "what's next" reasoning never drifts between the two
// surfaces.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { getProjectDashboard } from "./dashboard";
import { STEP_LABELS, STEP_ROUTES } from "@/lib/step-tracker";

export interface NextGate {
  // 1-9, matches compute_steps_complete()'s own term order (supabase/migrations/
  // 0023_strategy_gate_and_drop_strategies.sql) — NOT the same indexing as the 9 UI tiles
  // (STEP_GATE collapses two of these terms onto one tile; see step-tracker.ts's own comment).
  term: number;
  label: string;
  route: string;
  current: number | null;
  required: number | null;
}

// Queries only the ONE table relevant to the next unmet term, not all 9 — cheap, and mirrors
// this codebase's existing habit of re-deriving real counts in TS rather than introspecting the
// SQL function (dashboard.ts already does this for signals/scenarios/indicators/strategic_options).
export async function getNextGate(projectId: string, stepsComplete: number): Promise<NextGate | null> {
  const supabase = createClient();
  const term = stepsComplete + 1;

  switch (term) {
    case 1: {
      const { data, error } = await supabase.from("projects").select("refined_focal_question").eq("id", projectId).single();
      if (error) throw error;
      return { term, label: STEP_LABELS[0], route: STEP_ROUTES[0], current: data.refined_focal_question ? 1 : 0, required: 1 };
    }
    case 2: {
      const { count, error } = await supabase.from("insights").select("id", { count: "exact", head: true }).eq("project_id", projectId);
      if (error) throw error;
      return { term, label: STEP_LABELS[1], route: STEP_ROUTES[1], current: count ?? 0, required: 1 };
    }
    case 3: {
      const { count, error } = await supabase.from("signals").select("id", { count: "exact", head: true }).eq("project_id", projectId);
      if (error) throw error;
      return { term, label: STEP_LABELS[2], route: STEP_ROUTES[2], current: count ?? 0, required: 4 };
    }
    case 4: {
      // Same condition compute_steps_complete() itself uses, verbatim.
      const { data, error } = await supabase
        .from("axes")
        .select("id")
        .eq("project_id", projectId)
        .in("independence_state", ["independent", "correlated"])
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return { term, label: STEP_LABELS[3], route: STEP_ROUTES[3], current: data ? 1 : 0, required: 1 };
    }
    case 5: {
      const { count, error } = await supabase.from("scenarios").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("plausible", true);
      if (error) throw error;
      return { term, label: STEP_LABELS[4], route: STEP_ROUTES[4], current: count ?? 0, required: 4 };
    }
    case 6: {
      const { count, error } = await supabase.from("scenarios").select("id", { count: "exact", head: true }).eq("project_id", projectId).not("narrative", "is", null);
      if (error) throw error;
      return { term, label: STEP_LABELS[5], route: STEP_ROUTES[5], current: count ?? 0, required: 4 };
    }
    case 7: {
      const { count, error } = await supabase.from("implications").select("id", { count: "exact", head: true }).eq("project_id", projectId);
      if (error) throw error;
      return { term, label: STEP_LABELS[6], route: STEP_ROUTES[6], current: count ?? 0, required: 12 };
    }
    case 8: {
      const { count, error } = await supabase.from("indicators").select("id", { count: "exact", head: true }).eq("project_id", projectId);
      if (error) throw error;
      return { term, label: STEP_LABELS[7], route: STEP_ROUTES[7], current: count ?? 0, required: 12 };
    }
    case 9: {
      const { count, error } = await supabase.from("strategic_options").select("id", { count: "exact", head: true }).eq("project_id", projectId);
      if (error) throw error;
      return { term, label: STEP_LABELS[8], route: STEP_ROUTES[8], current: count ?? 0, required: 3 };
    }
    default:
      return null; // all 9 terms already satisfied
  }
}

export interface MonitorCandidate {
  kind: "alerts" | "no_indicators_yet" | "all_on_track";
  indicatorsTotal: number;
  indicatorsInAlert: number;
}

// Takes indicatorsTotal from getProjectDashboard's already-fetched KPI (kpis.indicators.value)
// rather than re-querying it, but runs its own small count query for the alert-specific number
// — cheaper and more robust than re-deriving it by parsing kpis.indicators.sub's display string.
export async function getMonitorCandidate(projectId: string, indicatorsTotal: number): Promise<MonitorCandidate> {
  if (indicatorsTotal === 0) return { kind: "no_indicators_yet", indicatorsTotal, indicatorsInAlert: 0 };

  const supabase = createClient();
  const { count, error } = await supabase
    .from("indicators")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("status", "Alert");
  if (error) throw error;
  const indicatorsInAlert = count ?? 0;

  if (indicatorsInAlert > 0) return { kind: "alerts", indicatorsTotal, indicatorsInAlert };
  return { kind: "all_on_track", indicatorsTotal, indicatorsInAlert };
}

const RecommendationsSchema = z.object({
  actions: z
    .array(
      z.object({
        slot: z.enum(["next_step", "monitor"]),
        worth_surfacing: z.boolean(),
        rationale: z.string(),
      })
    )
    .max(2),
});

const RECOMMENDATIONS_TASK_PROMPT = `Task: Write a one-sentence rationale for each candidate
action below, to display on the Home dashboard — deterministic classification/narration, not
creative brainstorming. The candidates themselves are already decided by the app; you are not
choosing what the actions ARE, only whether each is worth surfacing right now and why.

Input: { focal_question: string,
         next_step: { label: string, current: number | null, required: number | null } | null
           /* null means the whole methodology is already complete */,
         monitor: { kind: "alerts"|"no_indicators_yet"|"all_on_track",
           indicators_total: number, indicators_in_alert: number } }

Rules:
- For each candidate given (next_step if non-null, monitor always), output exactly one action
  with slot set to "next_step" or "monitor" respectively — never invent a third slot.
- rationale MUST cite the real number(s) given (e.g. "2 of the 4 signals needed") — never
  filler text like "this is important" with no number attached, when a number was given.
- worth_surfacing: true unless the candidate is genuinely redundant or empty of content right
  now (e.g. "all_on_track" with 0 total indicators isn't really "on track" — set false and skip
  it rather than writing a hollow reassurance).
- Keep each rationale to one sentence.

Output schema:
{ actions: [{ slot: "next_step"|"monitor", worth_surfacing: boolean, rationale: string }] }`;

export interface RecommendationAction {
  slot: "next_step" | "monitor";
  title: string;
  ctaLabel: string;
  route: string;
  rationale: string;
}

function nextStepCandidateCopy(gate: NextGate | null): { title: string; ctaLabel: string; route: string } {
  if (!gate) return { title: "Review your strategic options", ctaLabel: "Open strategy", route: "/strategy" };
  return { title: `Continue to ${gate.label}`, ctaLabel: `Open ${gate.label.toLowerCase()}`, route: gate.route };
}

function monitorCandidateCopy(candidate: MonitorCandidate): { title: string; ctaLabel: string; route: string } {
  if (candidate.kind === "alerts") return { title: `Review ${candidate.indicatorsInAlert} indicator(s) in alert`, ctaLabel: "Open monitoring", route: "/monitoring" };
  if (candidate.kind === "all_on_track") return { title: `All ${candidate.indicatorsTotal} indicators on track`, ctaLabel: "Open monitoring", route: "/monitoring" };
  return { title: "Set up leading indicators", ctaLabel: "Open monitoring", route: "/monitoring" };
}

export async function getDashboardRecommendations(projectId: string): Promise<{ actions: RecommendationAction[] }> {
  const supabase = createClient();

  const [{ data: project, error: projectError }, dashboard] = await Promise.all([
    supabase.from("projects").select("focal_question, refined_focal_question").eq("id", projectId).single(),
    getProjectDashboard(projectId),
  ]);
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  const [nextGate, monitor] = await Promise.all([
    getNextGate(projectId, dashboard.stepsComplete),
    getMonitorCandidate(projectId, dashboard.kpis.indicators.value),
  ]);

  const output = await runStructured({
    step: "home.recommendation",
    projectId,
    taskPrompt: RECOMMENDATIONS_TASK_PROMPT,
    input: {
      focal_question: focalQuestion,
      next_step: nextGate ? { label: nextGate.label, current: nextGate.current, required: nextGate.required } : null,
      monitor: { kind: monitor.kind, indicators_total: monitor.indicatorsTotal, indicators_in_alert: monitor.indicatorsInAlert },
    },
    schema: RecommendationsSchema,
    effort: "low",
    thinking: false,
  });

  const actions: RecommendationAction[] = [];
  for (const a of output.actions) {
    if (!a.worth_surfacing) continue;
    if (a.slot === "next_step") {
      actions.push({ slot: "next_step", ...nextStepCandidateCopy(nextGate), rationale: a.rationale });
    } else {
      actions.push({ slot: "monitor", ...monitorCandidateCopy(monitor), rationale: a.rationale });
    }
  }

  return { actions };
}
