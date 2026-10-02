"use client";

// Matrix v2 (design/handoff/2026-10-01/CLAUDE_CODE_MATRIX_V2_PROMPTS.md, Prompts 4-5) — thin
// host around the verbatim-ported MatrixV2. Replaces the old drag-to-place/star-rating UI
// (DndContext, Dot, dotState, BucketRail, CriticalUncertaintyRow, IndependenceAssessment,
// ScenarioPreview, MethodologyInfo — all removed) with the real two-question placement flow,
// backed by store.tsx's matrixPlacements/scenarioAxisIds/axisHeadlines (place_force/set_axes,
// 0040_matrix_v2_placement_and_axis_functions.sql) — no more temporary in-memory `api`.
//
// lockAxes/onReaxis/onBuildScenarios route to the EXISTING ReAxisModal/BuildScenariosModal
// unchanged (neither modal's own code changes here) — both read store.criticalUncertainties
// directly, so this host keeps that field synced to the live `scenarioAxisIds` pick exactly as
// the old page-matrix.tsx did, and keeps running the same real checkAxisIndependence AI check
// (feeding BuildScenariosModal's `independence` prop) rather than inventing a new gate.
//
// MatrixV2 got one small addition on top of the verbatim port: an `initialSelected` prop, so
// the `/matrix?focus=<id>` deep link (Signals page's "+ Add to Matrix") still pre-selects that
// force — see MatrixV2.tsx's own comment on that prop.
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Navigate } from "@/lib/use-navigate";
import { checkAxisIndependence, type IndependenceResult } from "@/lib/actions/ai-matrix";
import { AXES_LOCKED } from "@/lib/matrix-mapping";
import { eventCategory } from "@/components/signals/pole";
import { MatrixV2, type MxForce, type MxEvent, type MxPlacement, type MxApi } from "./MatrixV2";
import { BuildScenariosModal, ReAxisModal } from "./modals";
import { ScenarioContextHeader } from "../storyline/scenario-context-header";

export function PageMatrix({ navigate }: { navigate: Navigate }) {
  const store = useStore();
  const searchParams = useSearchParams();
  // Dot id *is* the signal id (see store.tsx's toMatrixDot), so this matches MxForce ids directly.
  const focusId = searchParams.get("focus");

  const signals: MxForce[] = React.useMemo(
    () => store.signals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category, poles: [s.poleA, s.poleB] as [string, string] })),
    [store.signals]
  );
  const events: MxEvent[] = React.useMemo(
    () =>
      store.events.map((e) => ({
        id: e.id,
        title: e.title,
        body: e.body,
        category: eventCategory(e, store.signals),
        status: e.status,
        date: e.date,
        likelihood: e.likelihood,
        impact: e.impact,
        wildcard: e.wildcard,
        precursor: e.precursor,
        source: e.source,
        indicatorId: e.indicatorId,
        links: e.links.map((l) => ({ sigId: l.signalId, side: l.side })),
      })),
    [store.events, store.signals]
  );

  // store.matrixPlacements already covers both real (confirmed) placements and the migration
  // backfill (confirmed=false, at the old matrix_dots position) — matrix_placements_v is the
  // single source of truth now, nothing to merge in from store.matrixDots here.
  const placements: MxPlacement[] = React.useMemo(
    () => store.matrixPlacements.map((p) => ({ sigId: p.signalId, x: p.x, y: p.y, impactAns: p.impactAnswer, plausible: p.plausible, confirmed: p.confirmed })),
    [store.matrixPlacements]
  );

  const [reaxisOpen, setReaxisOpen] = React.useState(false);
  const [buildOpen, setBuildOpen] = React.useState(false);

  const api: MxApi = React.useMemo(
    () => ({
      setPlacement: async (sigId, p, assessedEventIds) => {
        if (!store.activeProjectId || !p.impactAns || !p.plausible) return;
        await store.setMatrixPlacement(store.activeProjectId, sigId, p.impactAns, p.plausible, assessedEventIds ?? []);
      },
      setAxes: async (ids) => {
        if (!store.activeProjectId) return;
        try {
          await store.setMatrixAxes(store.activeProjectId, ids);
        } catch (err) {
          if (err instanceof Error && err.message === AXES_LOCKED) {
            setReaxisOpen(true);
            return;
          }
          console.error("[matrix] failed to set axes", err);
        }
      },
      setHeadline: async (sigId, side, eventId) => {
        if (!store.activeProjectId) return;
        await store.setMatrixHeadline(store.activeProjectId, sigId, side, eventId);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `store` itself isn't reference-stable across renders; the specific fields used are already listed
    [store.activeProjectId, store.setMatrixPlacement, store.setMatrixAxes, store.setMatrixHeadline]
  );

  // Keep the legacy field in sync so the existing Build/Re-axis modals (which read
  // store.criticalUncertainties directly, not a prop) see the current pick.
  React.useEffect(() => {
    store.setCriticalUncertainties(store.scenarioAxisIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.scenarioAxisIds.join()]);

  // Same real AI content-correlation check as before (ai-matrix.ts), just keyed on
  // scenarioAxisIds instead of the old `critical` state — feeds BuildScenariosModal unchanged.
  const [independence, setIndependence] = React.useState<IndependenceResult | null>(null);
  React.useEffect(() => {
    const [a, b] = store.scenarioAxisIds;
    if (!a || !b || !store.activeProjectId) {
      setIndependence(null);
      return;
    }
    let cancelled = false;
    checkAxisIndependence({ projectId: store.activeProjectId, axisASignalId: a, axisBSignalId: b })
      .then((result) => {
        if (!cancelled) setIndependence(result);
      })
      .catch((err) => {
        console.error("[matrix] independence check failed", err);
        if (!cancelled) setIndependence(null);
      });
    return () => {
      cancelled = true;
    };
    // store.scenarioAxisIds is a fresh array reference on every matrix-v2 realtime tick
    // (matrix_placements/axes/axis_headlines changes) even when the actual pair of ids hasn't
    // changed — depending on the array itself re-fired this on every placement a user made
    // while the Matrix page was open, not just on an actual axis-pair change. .join() depends
    // on the ids' VALUES instead, matching the sibling effect right above this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.scenarioAxisIds.join(), store.activeProjectId]);

  const hasScenarios = (store.scenarios || []).some((s) => !s.archived);
  // Ground truth for "what the live scenarios were actually built from" — same derivation as
  // the old page-matrix.tsx's builtAxisIds.
  const builtAxisIds = React.useMemo(() => {
    const built = (store.scenarios || []).find((s) => !s.archived && s.axisA?.signalId && s.axisB?.signalId);
    return built ? [built.axisA!.signalId as string, built.axisB!.signalId as string] : null;
  }, [store.scenarios]);
  // Once scenarios exist, the matrix displays the axes they were actually built from (and
  // routes any change through Re-axis) rather than whatever's currently staged in `axes`.
  const displayedAxes = hasScenarios && builtAxisIds ? builtAxisIds : store.scenarioAxisIds;

  const effectiveFocal = store.project.focal_question;

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-5">
      <div className="scroll-y flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card p-[18px] shadow-card">
        <ScenarioContextHeader view="matrix" className="mb-3.5 flex-shrink-0 p-0" />
        <MatrixV2
          signals={signals}
          events={events}
          placements={placements}
          axes={displayedAxes}
          headlines={store.axisHeadlines}
          focal={effectiveFocal}
          horizon={store.project.horizon}
          api={api}
          lockAxes={hasScenarios}
          onReaxis={() => setReaxisOpen(true)}
          onBuildScenarios={() => (hasScenarios ? navigate("/canvas") : setBuildOpen(true))}
          buildLabel={hasScenarios ? "View Scenarios →" : undefined}
          onNavigate={navigate}
          initialSelected={focusId ?? undefined}
        />
      </div>

      <ReAxisModal open={reaxisOpen} onClose={() => setReaxisOpen(false)} navigate={navigate} builtAxes={builtAxisIds} />
      <BuildScenariosModal open={buildOpen} onClose={() => setBuildOpen(false)} navigate={navigate} independence={independence} />
    </div>
  );
}
