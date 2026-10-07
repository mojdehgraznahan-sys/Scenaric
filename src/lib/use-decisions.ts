"use client";

// Decision layer client hook (design/2026-10-05/01-shared-decision-layer/PROMPTS.md, Prompt 4
// — `useDecisions`). Lives flat under src/lib/ rather than a src/hooks/ directory: this
// codebase has no such directory and only one other standalone hook file
// (src/lib/use-navigate.ts) — matched here, not invented fresh. Data fetching is the same ad
// hoc useEffect+useState+server-action-call pattern every other page uses (there is no
// useSWR/useQuery-style abstraction anywhere in this codebase); cross-component invalidation
// is the same same-tab `fm:*-updated` window.CustomEvent convention store.tsx and
// page-signals.tsx already use, not the mockup's window.DecisionStore/localStorage (which has
// no real-app counterpart) and not Supabase Realtime. Realtime was added for Matrix v2 in
// 0041_matrix_v2_realtime.sql, then that migration was emptied out again (commit 457633f)
// pending verification that Postgres Realtime actually enforces each table's RLS
// per-subscriber on this project (0041's own retracted content flagged this as unverified —
// no Docker/dashboard access in that session to confirm it). Until that's resolved, adding
// action_cards/route_moves to the supabase_realtime publication would carry the same
// unverified cross-project exposure risk, so this migration (0042_decision_layer.sql)
// deliberately does not touch that publication — live updates here are same-tab only, exactly
// like every other entity in this app today. Revisit once Matrix v2's realtime question is
// resolved; the .channel()/postgres_changes shape to copy is at src/lib/store.tsx:955-963.
import * as React from "react";
import {
  actOnActionCard,
  createRouteMoves,
  getDecisionsData,
  reviewDiscoveredEvent,
  setStrategyRevisionStatus,
  setStrategyTarget,
  type DecisionsData,
  type RouteMoveDraft,
} from "@/lib/actions/decisions";

const EVENT_NAME = "fm:decisions-updated";

function dispatchUpdated(projectId: string) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { projectId } }));
}

export interface UseDecisionsResult {
  data: DecisionsData | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setTarget: (scenarioId: string, userId: string | null) => Promise<void>;
  actOnCard: (
    cardId: string,
    status: "accepted" | "deferred" | "dismissed" | "pending",
    userId: string | null,
    options?: { ownerId?: string | null; dueOn?: string | null }
  ) => Promise<void>;
  reviewDiscovery: (discoveryId: string, status: "confirmed" | "sent_to_signals" | "rejected", userId: string | null) => Promise<void>;
  setRevision: (revisionId: string, status: "applied" | "dismissed") => Promise<void>;
  createRoute: (scenarioId: string, moves: RouteMoveDraft[]) => Promise<void>;
}

export function useDecisions(projectId: string | null): UseDecisionsResult {
  const [data, setData] = React.useState<DecisionsData | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refreshFor = React.useCallback(async (id: string) => {
    setLoading(true);
    try {
      setData(await getDecisionsData(id));
    } catch (err) {
      console.error("[use-decisions] failed to load decisions data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!projectId) {
      setData(null);
      return;
    }
    refreshFor(projectId);
  }, [projectId, refreshFor]);

  React.useEffect(() => {
    if (!projectId) return;
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projectId === projectId) refreshFor(projectId);
    };
    window.addEventListener(EVENT_NAME, onUpdated);
    return () => window.removeEventListener(EVENT_NAME, onUpdated);
  }, [projectId, refreshFor]);

  const refresh = React.useCallback(async () => {
    if (projectId) await refreshFor(projectId);
  }, [projectId, refreshFor]);

  const setTarget = React.useCallback(
    async (scenarioId: string, userId: string | null) => {
      if (!projectId) return;
      await setStrategyTarget(projectId, scenarioId, userId);
      dispatchUpdated(projectId);
    },
    [projectId]
  );

  const actOnCard = React.useCallback(
    async (
      cardId: string,
      status: "accepted" | "deferred" | "dismissed" | "pending",
      userId: string | null,
      options?: { ownerId?: string | null; dueOn?: string | null }
    ) => {
      if (!projectId) return;
      await actOnActionCard(cardId, status, userId, options);
      dispatchUpdated(projectId);
    },
    [projectId]
  );

  const createRoute = React.useCallback(
    async (scenarioId: string, moves: RouteMoveDraft[]) => {
      if (!projectId) return;
      await createRouteMoves(projectId, scenarioId, moves);
      dispatchUpdated(projectId);
    },
    [projectId]
  );

  const reviewDiscovery = React.useCallback(
    async (discoveryId: string, status: "confirmed" | "sent_to_signals" | "rejected", userId: string | null) => {
      if (!projectId) return;
      await reviewDiscoveredEvent(discoveryId, status, userId);
      dispatchUpdated(projectId);
      // A confirmed discovery inserts a real event — the Signals page's own store listens for
      // this same event convention (src/lib/store.tsx's fm:events-updated handler) to pick it
      // up without a reload.
      if (status === "confirmed") window.dispatchEvent(new CustomEvent("fm:events-updated", { detail: { projectId } }));
    },
    [projectId]
  );

  const setRevision = React.useCallback(
    async (revisionId: string, status: "applied" | "dismissed") => {
      if (!projectId) return;
      await setStrategyRevisionStatus(revisionId, status);
      dispatchUpdated(projectId);
    },
    [projectId]
  );

  return { data, loading, refresh, setTarget, actOnCard, reviewDiscovery, setRevision, createRoute };
}
