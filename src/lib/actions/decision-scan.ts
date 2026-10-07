"use server";

// Daily decision-scan job (design/2026-10-05/01-shared-decision-layer/PROMPTS.md, Prompt 3).
// Triggered by Vercel Cron once every 24h (src/app/api/cron/decision-scan/route.ts), never by
// a user session — every read/write here goes through createAdminClient(), same reason
// indicators-monitoring.ts does (a cron invocation has no session to resolve
// current_org_id() from, so RLS would silently match zero rows under the cookie-based client,
// not throw).
//
// Supersedes indicators-monitoring.ts's daily run for any project once Monitoring v2 ships
// (see 0042_decision_layer.sql's header comment) — this file is new, that one is left
// untouched and still wired into vercel.json during the grace period.
import { createAdminClient } from "@/lib/supabase/admin";
import { pullNewsFeed } from "./ai-news-feed";
import { evaluateNewsForDecisionScan, type ForceForEvaluation, type TrackedEventForEvaluation } from "./ai-decision-scan-evaluation";
import { draftActionCard } from "./ai-decision-scan-cards";
import { momentum, progress, windowPoints, type LikelihoodLevel } from "@/lib/decision-model";
import { fetchTrackedEvents, seedMissingHistory, toTrackedEvent, type TrackedEventRow } from "@/lib/decision-tracking";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface DecisionScanProjectResult {
  projectId: string;
  trackedEvents: number;
  sourcesScanned: number;
  changes: number;
  cardsCreated: number;
}

export async function runDecisionScanForProject(projectId: string, batchId: string): Promise<DecisionScanProjectResult> {
  const supabase = createAdminClient();

  let tracked = await fetchTrackedEvents(supabase, projectId);
  if (tracked.length === 0) {
    return { projectId, trackedEvents: 0, sourcesScanned: 0, changes: 0, cardsCreated: 0 };
  }
  await seedMissingHistory(supabase, projectId, tracked);

  const newsResult = await pullNewsFeed(projectId, {
    supabaseClient: supabase,
    uploadedBy: null,
    focusTopics: tracked.map((t) => ({ name: t.title, triggerCondition: null })),
    batchId,
  });

  let changes = 0;
  let cardsCreated = 0;

  if (newsResult.sufficientEvidence && newsResult.sources.length > 0) {
    const { data: forceRows, error: forcesError } = await supabase.from("signals").select("id, title, pole_a, pole_b").eq("project_id", projectId);
    if (forcesError) throw forcesError;
    const forces: ForceForEvaluation[] = forceRows.map((f) => ({ id: f.id, title: f.title, poleA: f.pole_a ?? "", poleB: f.pole_b ?? f.title }));

    const trackedForEval: TrackedEventForEvaluation[] = tracked.map((t) => ({
      id: t.eventId,
      title: t.title,
      currentLevel: t.currentLevel,
      forceTitle: t.forceTitle,
      pole: t.pole,
      impact: t.impact,
    }));

    const evaluation = await evaluateNewsForDecisionScan(
      projectId,
      trackedForEval,
      forces,
      newsResult.sources.map((s) => ({ id: s.id, title: s.title, publishedDate: s.publishedDate, summary: s.summary })),
      batchId
    );

    const sourceById = new Map(newsResult.sources.map((s) => [s.id, s]));
    const trackedById = new Map(tracked.map((t) => [t.eventId, t]));
    const previousLevelByEvent = new Map(tracked.map((t) => [t.eventId, t.currentLevel]));

    for (const update of evaluation.eventUpdates) {
      const row = trackedById.get(update.eventId);
      if (!row || update.newLevel === row.currentLevel) continue; // write a history row only when the level actually changes
      const source = sourceById.get(update.groundedIn);
      const { error } = await supabase.from("event_likelihood_history").insert({
        project_id: projectId,
        event_id: update.eventId,
        level: update.newLevel,
        cite: update.cite,
        source_title: source?.title ?? null,
        source_name: null,
        source_url: source?.url ?? null,
        changed_by: "scan",
      });
      if (error) throw error;
      row.currentLevel = update.newLevel as LikelihoodLevel;
      row.history.push({
        level: update.newLevel,
        observedAt: new Date().toISOString(),
        cite: update.cite,
        sourceTitle: source?.title ?? null,
        sourceUrl: source?.url ?? null,
        changedBy: "scan",
      });
      changes += 1;
    }
    // Refresh `tracked` so the roll-up below reflects this scan's own changes.
    tracked = Array.from(trackedById.values());

    // Discoveries — nothing joins the project automatically (methodology guardrail #4). Skip
    // a duplicate if an equivalent pending discovery (same title) already exists, same "skip
    // if an equivalent pending card already exists" convention the handoff specifies for
    // action cards.
    if (evaluation.discoveries.length > 0) {
      const { data: existingPending, error: existingError } = await supabase
        .from("discovered_events")
        .select("title")
        .eq("project_id", projectId)
        .eq("dc_status", "pending");
      if (existingError) throw existingError;
      const existingTitles = new Set(existingPending.map((d) => d.title));

      const toInsert = evaluation.discoveries.filter((d) => !existingTitles.has(d.title));
      if (toInsert.length > 0) {
        const { error } = await supabase.from("discovered_events").insert(
          toInsert.map((d) => ({
            project_id: projectId,
            title: d.title,
            source_name: sourceById.get(d.newsItemId)?.title ?? null,
            source_url: sourceById.get(d.newsItemId)?.url ?? null,
            status: "possible" as const,
            fits: d.fits,
            proposed_force_id: d.proposedForceId,
            proposed_side: d.proposedSide,
            proposal: d.proposal,
            dc_status: "pending" as const,
          }))
        );
        if (error) throw error;
      }
    }

    cardsCreated += await raiseActionCards(supabase, projectId, tracked, previousLevelByEvent, batchId);
  }

  // Roll-up — momentum snapshots, signpost state, run regardless of whether news came in
  // today, so a quiet day still gets a snapshot row (flat momentum is real information, not a
  // gap).
  const { data: scenarioRows, error: scenariosError } = await supabase.from("scenarios").select("id").eq("project_id", projectId).eq("is_archived", false);
  if (scenariosError) throw scenariosError;
  const allScenarioIds = scenarioRows.map((s) => s.id);
  const points = windowPoints();
  const trackedForModel = tracked.map((t) => toTrackedEvent(t, points));

  if (allScenarioIds.length > 0) {
    const snapshotRows = allScenarioIds.map((scenarioId) => {
      const m = momentum(scenarioId, trackedForModel);
      return { project_id: projectId, scenario_id: scenarioId, score: m.score, label: m.label, progress: progress(scenarioId, trackedForModel) };
    });
    const { error } = await supabase.from("momentum_snapshots").insert(snapshotRows);
    if (error) throw error;
  }

  await updateSignposts(supabase, projectId, tracked);

  const { error: scanRunError } = await supabase.from("scan_runs").insert({
    project_id: projectId,
    sources_scanned: newsResult.sourcesCreated,
    changes,
    cards_created: cardsCreated,
  });
  if (scanRunError) throw scanRunError;

  return { projectId, trackedEvents: tracked.length, sourcesScanned: newsResult.sourcesCreated, changes, cardsCreated };
}

// A signpost whose source_event_id is set tracks that event's current level: Occurred (4) ->
// hit (sticky — never downgraded once hit), High (3) -> approaching (unless already hit),
// anything else -> not_yet.
async function updateSignposts(supabase: AdminClient, projectId: string, tracked: TrackedEventRow[]): Promise<void> {
  const { data: signposts, error } = await supabase
    .from("signposts")
    .select("id, state, source_event_id")
    .eq("project_id", projectId)
    .not("source_event_id", "is", null);
  if (error) throw error;
  if (signposts.length === 0) return;

  const levelByEvent = new Map(tracked.map((t) => [t.eventId, t.currentLevel]));
  for (const sp of signposts) {
    if (sp.state === "hit") continue; // sticky
    const level = sp.source_event_id ? levelByEvent.get(sp.source_event_id) : undefined;
    if (level === undefined) continue;
    const nextState = level === 4 ? "hit" : level === 3 ? "approaching" : "not_yet";
    if (nextState === sp.state) continue;
    const { error: updateError } = await supabase
      .from("signposts")
      .update({ state: nextState, hit_at: nextState === "hit" ? new Date().toISOString() : null })
      .eq("id", sp.id);
    if (updateError) throw updateError;
  }
}

// Deterministic threshold -> action-card creation (design/2026-10-05's Prompt 3 step 5). WHICH
// threshold fired and WHICH route move it affects are decided here, from real rows — the AI
// (draftActionCard) only writes the explanation prose once that's settled, never the facts.
async function raiseActionCards(
  supabase: AdminClient,
  projectId: string,
  tracked: TrackedEventRow[],
  previousLevelByEvent: Map<string, LikelihoodLevel>,
  batchId: string
): Promise<number> {
  const { data: target } = await supabase.from("strategy_targets").select("scenario_id").eq("project_id", projectId).maybeSingle();
  const targetScenarioId = target?.scenario_id ?? null;
  let targetScenarioName: string | null = null;
  if (targetScenarioId) {
    const { data: scenario } = await supabase.from("scenarios").select("name").eq("id", targetScenarioId).maybeSingle();
    targetScenarioName = scenario?.name ?? null;
  }

  const { data: existingPendingCards, error: existingCardsError } = await supabase
    .from("action_cards")
    .select("trigger_kind, evidence_event_id, evidence_discovery_id")
    .eq("project_id", projectId)
    .eq("status", "pending");
  if (existingCardsError) throw existingCardsError;
  const hasExisting = (kind: string, eventId: string | null) =>
    existingPendingCards.some((c) => c.trigger_kind === kind && c.evidence_event_id === eventId);

  let created = 0;
  for (const row of tracked) {
    const previous = previousLevelByEvent.get(row.eventId);
    if (previous === undefined || previous === row.currentLevel) continue;
    const rising = row.currentLevel > previous;
    const supportsTarget = targetScenarioId ? row.supports.includes(targetScenarioId) : false;

    let triggerKind: "target_catalyst_weakening" | "blocker_rising" | "influenceable_gaining" | "event_threshold" | null = null;
    let urgency: "urgent" | "high" | "medium" = "medium";
    let audience: "ceo" | "cso" = "ceo";
    let newMoveStatus: "paused" | "armed" | "active" | null = null;

    if (targetScenarioId && supportsTarget && !rising && row.impact >= 4) {
      triggerKind = "target_catalyst_weakening";
      urgency = "urgent";
      audience = "ceo";
      newMoveStatus = "paused";
    } else if (targetScenarioId && !supportsTarget && rising && row.currentLevel < 4) {
      triggerKind = "blocker_rising";
      urgency = "high";
      audience = "ceo";
      newMoveStatus = "armed";
    } else if (targetScenarioId && supportsTarget && rising && row.lever === "influence") {
      triggerKind = "influenceable_gaining";
      urgency = "medium";
      audience = "cso";
      newMoveStatus = "active";
    } else if (row.currentLevel >= 3 && rising) {
      triggerKind = "event_threshold";
      urgency = row.currentLevel === 4 ? "high" : "medium";
      audience = "ceo";
    }
    if (!triggerKind || hasExisting(triggerKind, row.eventId)) continue;

    const move = targetScenarioId
      ? (await supabase.from("route_moves").select("id, title, status").eq("project_id", projectId).eq("scenario_id", targetScenarioId).eq("link_kind", "event").eq("link_id", row.eventId).maybeSingle()).data
      : null;

    const draft = await draftActionCard(
      projectId,
      {
        triggerKind,
        targetScenarioName,
        evidenceTitle: row.title,
        evidenceDetail: `Likelihood moved from level ${previous} to level ${row.currentLevel}.`,
        affectedMoveTitle: move?.title ?? null,
        affectedMoveNewStatus: move && newMoveStatus ? newMoveStatus : null,
      },
      batchId
    );

    const { error } = await supabase.from("action_cards").insert({
      project_id: projectId,
      urgency,
      audience,
      scenario_id: targetScenarioId,
      trigger_kind: triggerKind,
      evidence_event_id: row.eventId,
      title: draft.title,
      body: draft.body,
      // previous_status lets a later Undo (actOnActionCard in decisions.ts) restore the move
      // exactly, instead of guessing what it was before.
      effect: move && newMoveStatus ? { move_id: move.id, status: newMoveStatus, previous_status: move.status } : {},
      status: "pending",
    });
    if (error) throw error;
    created += 1;
  }

  // frame_check: >=2 pending discoveries with fits = false.
  const { data: unfit, error: unfitError } = await supabase
    .from("discovered_events")
    .select("id, title")
    .eq("project_id", projectId)
    .eq("dc_status", "pending")
    .eq("fits", false)
    .order("created_at", { ascending: false });
  if (unfitError) throw unfitError;
  if (unfit.length >= 2 && !hasFrameCheckCard(existingPendingCards)) {
    const draft = await draftActionCard(
      projectId,
      {
        triggerKind: "frame_check",
        targetScenarioName,
        evidenceTitle: unfit[0].title,
        evidenceDetail: `${unfit.length} recent discoveries fit no existing force.`,
        affectedMoveTitle: null,
        affectedMoveNewStatus: null,
      },
      batchId
    );
    const { error } = await supabase.from("action_cards").insert({
      project_id: projectId,
      urgency: "medium",
      audience: "cso",
      scenario_id: null,
      trigger_kind: "frame_check",
      evidence_discovery_id: unfit[0].id,
      title: draft.title,
      body: draft.body,
      effect: { navigate: "/app/signals" },
      status: "pending",
    });
    if (error) throw error;
    created += 1;
  }

  return created;
}

function hasFrameCheckCard(existing: { trigger_kind: string }[]): boolean {
  return existing.some((c) => c.trigger_kind === "frame_check");
}

export interface DecisionScanSummary {
  batchId: string;
  projectsProcessed: number;
  projectsSkipped: number;
  errors: { projectId: string; message: string }[];
}

export async function runDecisionScanForAllProjects(): Promise<DecisionScanSummary> {
  const batchId = crypto.randomUUID();
  const supabase = createAdminClient();

  const { data: projects, error } = await supabase.from("projects").select("id").eq("archived", false);
  if (error) throw error;

  let projectsProcessed = 0;
  let projectsSkipped = 0;
  const errors: { projectId: string; message: string }[] = [];

  for (const project of projects) {
    try {
      const result = await runDecisionScanForProject(project.id, batchId);
      if (result.trackedEvents === 0) projectsSkipped += 1;
      else projectsProcessed += 1;
    } catch (err) {
      errors.push({ projectId: project.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { batchId, projectsProcessed, projectsSkipped, errors };
}
