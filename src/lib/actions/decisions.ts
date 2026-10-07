"use server";

// Decision layer data access (design/2026-10-05/01-shared-decision-layer/PROMPTS.md, Prompt 4)
// — backs the useDecisions hook (src/lib/use-decisions.ts). Session-scoped (createClient(),
// not createAdminClient()) since this is called directly from client components, same
// convention as events.ts's listEventsWithLinks — RLS does the project-membership check via
// current_org_id(), there's no separate is_project_member() helper in this codebase.
import { createClient } from "@/lib/supabase/server";
import {
  health,
  momentum,
  progress,
  windowPoints,
  type HealthResult,
  type MomentumResult,
} from "@/lib/decision-model";
import { fetchTrackedEvents, toTrackedEvent, type TrackedEventRow } from "@/lib/decision-tracking";
import type { Database } from "@/lib/supabase/types";

type ActionCardRow = Database["public"]["Tables"]["action_cards"]["Row"];
type RouteMoveRow = Database["public"]["Tables"]["route_moves"]["Row"];
type SignpostRow = Database["public"]["Tables"]["signposts"]["Row"];
type DiscoveredEventRow = Database["public"]["Tables"]["discovered_events"]["Row"];
type StrategyRevisionRow = Database["public"]["Tables"]["strategy_revisions"]["Row"];
type ScanRunRow = Database["public"]["Tables"]["scan_runs"]["Row"];

// The project's active Matrix axes, with each side's two signals resolved — feeds the Home
// futures compass (PageHomeV2). Null when the project hasn't built scenarios/axes yet.
export interface DecisionAxes {
  xSignalId: string;
  xPoleA: string;
  xPoleB: string;
  ySignalId: string;
  yPoleA: string;
  yPoleB: string;
}

export interface DecisionsData {
  targetScenarioId: string | null;
  tracked: TrackedEventRow[];
  signposts: SignpostRow[];
  inbox: DiscoveredEventRow[];
  actions: ActionCardRow[];
  route: RouteMoveRow[]; // route_moves for the current target scenario only; [] when no target set
  revision: StrategyRevisionRow | null; // latest row regardless of status — the UI only renders it when status = 'proposed'
  lastScan: ScanRunRow | null;
  axes: DecisionAxes | null;
  momentumByScenario: Record<string, MomentumResult>;
  healthByScenario: Record<string, HealthResult>;
  progressByScenario: Record<string, number>;
}

export async function getDecisionsData(projectId: string): Promise<DecisionsData> {
  const supabase = createClient();

  const [targetResult, scenarioRows, tracked, signpostsResult, inboxResult, actionsResult, revisionResult, lastScanResult, axesResult] = await Promise.all([
    supabase.from("strategy_targets").select("scenario_id").eq("project_id", projectId).maybeSingle(),
    supabase.from("scenarios").select("id").eq("project_id", projectId).eq("is_archived", false),
    fetchTrackedEvents(supabase, projectId),
    supabase.from("signposts").select("*").eq("project_id", projectId),
    supabase.from("discovered_events").select("*").eq("project_id", projectId).order("found_at", { ascending: false }),
    supabase.from("action_cards").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    supabase.from("strategy_revisions").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("scan_runs").select("*").eq("project_id", projectId).order("ran_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("axes").select("x_signal_id, y_signal_id").eq("project_id", projectId).eq("is_active", true).maybeSingle(),
  ]);
  if (targetResult.error) throw targetResult.error;
  if (scenarioRows.error) throw scenarioRows.error;
  if (signpostsResult.error) throw signpostsResult.error;
  if (inboxResult.error) throw inboxResult.error;
  if (actionsResult.error) throw actionsResult.error;
  if (revisionResult.error) throw revisionResult.error;
  if (lastScanResult.error) throw lastScanResult.error;
  if (axesResult.error) throw axesResult.error;

  let axes: DecisionAxes | null = null;
  if (axesResult.data?.x_signal_id && axesResult.data?.y_signal_id) {
    const { data: axisSignals, error: axisSignalsError } = await supabase
      .from("signals")
      .select("id, pole_a, pole_b")
      .in("id", [axesResult.data.x_signal_id, axesResult.data.y_signal_id]);
    if (axisSignalsError) throw axisSignalsError;
    const xSignal = axisSignals.find((s) => s.id === axesResult.data!.x_signal_id);
    const ySignal = axisSignals.find((s) => s.id === axesResult.data!.y_signal_id);
    if (xSignal && ySignal) {
      axes = {
        xSignalId: xSignal.id,
        xPoleA: xSignal.pole_a ?? "",
        xPoleB: xSignal.pole_b ?? "",
        ySignalId: ySignal.id,
        yPoleA: ySignal.pole_a ?? "",
        yPoleB: ySignal.pole_b ?? "",
      };
    }
  }

  const targetScenarioId = targetResult.data?.scenario_id ?? null;
  const allScenarioIds = scenarioRows.data.map((s) => s.id);
  const points = windowPoints();
  const trackedForModel = tracked.map((t) => toTrackedEvent(t, points));

  const momentumByScenario: Record<string, MomentumResult> = {};
  const healthByScenario: Record<string, HealthResult> = {};
  const progressByScenario: Record<string, number> = {};
  for (const scenarioId of allScenarioIds) {
    momentumByScenario[scenarioId] = momentum(scenarioId, trackedForModel);
    healthByScenario[scenarioId] = health(scenarioId, trackedForModel, allScenarioIds);
    progressByScenario[scenarioId] = progress(scenarioId, trackedForModel);
  }

  let route: RouteMoveRow[] = [];
  if (targetScenarioId) {
    const { data, error } = await supabase.from("route_moves").select("*").eq("project_id", projectId).eq("scenario_id", targetScenarioId);
    if (error) throw error;
    route = data;
  }

  return {
    targetScenarioId,
    tracked,
    signposts: signpostsResult.data,
    inbox: inboxResult.data,
    actions: actionsResult.data,
    route,
    revision: revisionResult.data,
    lastScan: lastScanResult.data,
    axes,
    momentumByScenario,
    healthByScenario,
    progressByScenario,
  };
}

export async function setStrategyTarget(projectId: string, scenarioId: string, chosenBy: string | null): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("strategy_targets")
    .upsert({ project_id: projectId, scenario_id: scenarioId, chosen_by: chosenBy, chosen_at: new Date().toISOString() }, { onConflict: "project_id" });
  if (error) throw error;
}

// Accept/defer/dismiss an action card. Accepting applies effect.move_id -> effect.status in
// the same transaction-ish sequence (two awaited calls, not a single DB transaction — matches
// this repo's existing convention of plain sequential supabase-js calls rather than a
// PL/pgSQL wrapper, used wherever the two writes aren't racy enough to need DB-level atomicity;
// see set_primary_strategic_option for the one case here that does). Setting a card back to
// 'pending' (Undo) restores the move's effect.previous_status, captured when the card was
// created — see decision-scan.ts's raiseActionCards.
export async function actOnActionCard(
  cardId: string,
  status: "accepted" | "deferred" | "dismissed" | "pending",
  decidedBy: string | null,
  // Strategy's Accept popover (design/2026-10-05/03-strategy/PROMPTS.md Prompt 1: "Accepting
  // should also let the user set an optional owner and due date... isn't in the reference").
  // Only meaningful on acceptance; ignored otherwise.
  options?: { ownerId?: string | null; dueOn?: string | null }
): Promise<void> {
  const supabase = createClient();

  const { data: card, error: cardError } = await supabase.from("action_cards").select("effect").eq("id", cardId).single();
  if (cardError) throw cardError;

  const { error: updateError } = await supabase
    .from("action_cards")
    .update({
      status,
      decided_by: status === "pending" ? null : decidedBy,
      decided_at: status === "pending" ? null : new Date().toISOString(),
      ...(status === "accepted" ? { owner_id: options?.ownerId ?? null, due_on: options?.dueOn ?? null } : {}),
    })
    .eq("id", cardId);
  if (updateError) throw updateError;

  type RouteMoveStatus = Database["public"]["Tables"]["route_moves"]["Row"]["status"];
  const effect = card.effect as { move_id?: string; status?: RouteMoveStatus; previous_status?: RouteMoveStatus; navigate?: string } | null;
  if (effect?.move_id) {
    const nextStatus = status === "accepted" ? effect.status : status === "pending" ? effect.previous_status : undefined;
    if (nextStatus) {
      const { error: moveError } = await supabase.from("route_moves").update({ status: nextStatus, updated_at: new Date().toISOString() }).eq("id", effect.move_id);
      if (moveError) throw moveError;
    }
  }
}

// `confirmed` inserts the event, its force link, and its scenario links (one per
// proposed_scenarios entry, phase defaulted to 'precursors' — the earliest phase, since a
// freshly discovered event has no storyline placement yet; a human can move it once Storyline
// picks it up). `rejected`/`sent_to_signals` are a plain status update, no new rows.
export async function reviewDiscoveredEvent(discoveryId: string, status: "confirmed" | "sent_to_signals" | "rejected", reviewedBy: string | null): Promise<void> {
  const supabase = createClient();

  const { data: discovery, error: discoveryError } = await supabase.from("discovered_events").select("*").eq("id", discoveryId).single();
  if (discoveryError) throw discoveryError;

  if (status === "confirmed") {
    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert({
        project_id: discovery.project_id,
        title: discovery.title,
        description: discovery.body,
        status: discovery.status,
        likelihood: discovery.likelihood,
        source: discovery.source_name,
        created_via: "news_match",
      })
      .select("id")
      .single();
    if (eventError) throw eventError;

    if (discovery.fits && discovery.proposed_force_id) {
      const { error: linkError } = await supabase.from("event_signal_links").insert({
        project_id: discovery.project_id,
        event_id: event.id,
        signal_id: discovery.proposed_force_id,
        side: discovery.proposed_side,
      });
      if (linkError) throw linkError;
    }

    if (discovery.proposed_scenarios.length > 0) {
      const { error: scenarioLinksError } = await supabase.from("event_scenario_links").insert(
        discovery.proposed_scenarios.map((scenarioId) => ({
          project_id: discovery.project_id,
          event_id: event.id,
          scenario_id: scenarioId,
          phase: "precursors" as const,
        }))
      );
      if (scenarioLinksError) throw scenarioLinksError;
    }
  }

  const { error: updateError } = await supabase
    .from("discovered_events")
    .update({ dc_status: status, reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("id", discoveryId);
  if (updateError) throw updateError;
}

export async function setStrategyRevisionStatus(revisionId: string, status: "applied" | "dismissed"): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("strategy_revisions").update({ status }).eq("id", revisionId);
  if (error) throw error;
}

export type RouteMoveDraft = Pick<
  Database["public"]["Tables"]["route_moves"]["Insert"],
  "lane" | "horizon" | "title" | "link_kind" | "link_id" | "pushes"
>;

// Inserts a reviewed "Draft route" (src/lib/actions/ai-strategy-route.ts) wholesale — the
// draft itself is never persisted mid-review (no staging table), it's held in the Strategy
// page's own state until the user confirms, same spirit as this app's other
// AI-proposes/human-confirms flows but without a DB round-trip for something this
// short-lived and single-user.
export async function createRouteMoves(projectId: string, scenarioId: string, moves: RouteMoveDraft[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("route_moves").insert(
    moves.map((m) => ({ ...m, project_id: projectId, scenario_id: scenarioId, status: "planned" as const }))
  );
  if (error) throw error;
}
