"use client";

// Futures + Event chains (design/futures_chains_handoff/) client hooks. Same ad hoc
// useEffect+useState+server-action-call pattern as use-decisions.ts (this codebase's closest
// analog — one project-scoped aggregate read plus several mutations, no useSWR/useQuery
// anywhere in this repo) and the same same-tab fm:*-updated CustomEvent convention for
// cross-component refresh. Lives flat under src/lib/, not a hooks/ directory, matching
// use-decisions.ts and use-navigate.ts — this codebase has no such directory.
//
// Two hooks, not one: useFutures loads the whole project's 4 scenarios (postcards, narratives,
// ratings) — what the Futures page needs. useEventChain loads one scenario's chain for one
// target year on demand — Futures never needs any scenario's chain loaded, so it isn't fetched
// until the Chains page actually asks.
import * as React from "react";
import { getFuturesData, updateFuturesState, updatePostcard, updateNarrativeStory, rateScenario, getChainEvents, saveChainEvents, type FuturesData } from "@/lib/actions/futures";
import { generateFutures, generatePostcard, generateNarrative, generateChain, type ChainEventResult } from "@/lib/actions/ai-futures";

const EVENT_NAME = "fm:futures-updated";
function dispatchUpdated(projectId: string) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { projectId } }));
}

export interface UseFuturesResult {
  data: FuturesData | null;
  loading: boolean;
  generating: boolean;
  refresh: () => Promise<void>;
  regenerateAll: () => Promise<void>;
  setTargetYear: (year: number) => Promise<void>;
  setChainScenario: (scenarioId: string) => Promise<void>;
  rate: (scenarioId: string, desirability: number) => Promise<void>;
  regeneratePostcard: (scenarioId: string) => Promise<void>;
  regenerateNarrative: (scenarioId: string) => Promise<void>;
  saveNarrativeStory: (scenarioId: string, story: string[]) => Promise<void>;
  savePostcard: (scenarioId: string, patch: { headline: string; story: string; day: string; us: string }) => Promise<void>;
}

export function useFutures(projectId: string | null): UseFuturesResult {
  const [data, setData] = React.useState<FuturesData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  // Guards against a project switch while a fetch is in flight — same reasoning as
  // use-decisions.ts's projectIdRef.
  const projectIdRef = React.useRef(projectId);
  React.useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const refreshFor = React.useCallback(async (id: string) => {
    setLoading(true);
    try {
      const result = await getFuturesData(id);
      if (projectIdRef.current !== id) return;
      setData(result);
    } catch (err) {
      console.error("[use-futures] failed to load futures data", err);
    } finally {
      if (projectIdRef.current === id) setLoading(false);
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

  const regenerateAll = React.useCallback(async () => {
    if (!projectId) return;
    setGenerating(true);
    try {
      await generateFutures(projectId);
      dispatchUpdated(projectId);
    } finally {
      setGenerating(false);
    }
  }, [projectId]);

  const setTargetYear = React.useCallback(
    async (year: number) => {
      if (!projectId) return;
      await updateFuturesState(projectId, { targetYear: year });
      dispatchUpdated(projectId);
    },
    [projectId]
  );

  const setChainScenario = React.useCallback(
    async (scenarioId: string) => {
      if (!projectId) return;
      await updateFuturesState(projectId, { chainScenarioId: scenarioId });
      dispatchUpdated(projectId);
    },
    [projectId]
  );

  const rate = React.useCallback(
    async (scenarioId: string, desirability: number) => {
      if (!projectId) return;
      await rateScenario(scenarioId, desirability);
      dispatchUpdated(projectId);
    },
    [projectId]
  );

  const regeneratePostcard = React.useCallback(
    async (scenarioId: string) => {
      if (!projectId || !data) return;
      await generatePostcard(scenarioId, data.targetYear);
      dispatchUpdated(projectId);
    },
    [projectId, data]
  );

  const regenerateNarrative = React.useCallback(
    async (scenarioId: string) => {
      if (!projectId || !data) return;
      await generateNarrative(scenarioId, data.targetYear);
      dispatchUpdated(projectId);
    },
    [projectId, data]
  );

  const saveNarrativeStory = React.useCallback(
    async (scenarioId: string, story: string[]) => {
      if (!projectId) return;
      await updateNarrativeStory(scenarioId, story);
      dispatchUpdated(projectId);
    },
    [projectId]
  );

  const savePostcard = React.useCallback(
    async (scenarioId: string, patch: { headline: string; story: string; day: string; us: string }) => {
      if (!projectId) return;
      await updatePostcard(scenarioId, patch);
      dispatchUpdated(projectId);
    },
    [projectId]
  );

  return { data, loading, generating, refresh, regenerateAll, setTargetYear, setChainScenario, rate, regeneratePostcard, regenerateNarrative, saveNarrativeStory, savePostcard };
}

export interface UseEventChainResult {
  events: ChainEventResult[] | null;
  loading: boolean;
  generating: boolean;
  regenerate: () => Promise<void>;
  save: (events: ChainEventResult[]) => Promise<void>;
  // Debounced (400ms per event) — for likelihood/impact clicks only. Drag/insert/remove/
  // link/edit go through `save` directly and persist immediately, per the Storyline handoff.
  rate: (eventId: string, patch: { likelihood?: number; impact?: number }) => void;
}

export function useEventChain(scenarioId: string | null, startYear: number, targetYear: number): UseEventChainResult {
  const [events, setEvents] = React.useState<ChainEventResult[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!scenarioId) {
      setEvents(null);
      return;
    }
    setLoading(true);
    try {
      const rows = await getChainEvents(scenarioId, targetYear);
      if (rows.length === 0) {
        // No chain yet for this (scenario, target year) — generate once. Never falls back to
        // a local placeholder chain, per the handoff's own Prompt 5 override of the standalone
        // demo's BC.buildChain fallback.
        setLoading(false);
        setGenerating(true);
        try {
          setEvents(await generateChain(scenarioId, targetYear));
        } finally {
          setGenerating(false);
        }
      } else {
        setEvents(rows);
        setLoading(false);
      }
    } catch (err) {
      console.error("[use-futures] failed to load event chain", err);
      setLoading(false);
    }
  }, [scenarioId, targetYear]);

  React.useEffect(() => {
    load();
  }, [load]);

  const regenerate = React.useCallback(async () => {
    if (!scenarioId) return;
    setGenerating(true);
    try {
      setEvents(await generateChain(scenarioId, targetYear));
    } finally {
      setGenerating(false);
    }
  }, [scenarioId, targetYear]);

  const save = React.useCallback(
    async (next: ChainEventResult[]) => {
      if (!scenarioId) return;
      setEvents(await saveChainEvents(scenarioId, startYear, targetYear, next));
    },
    [scenarioId, startYear, targetYear]
  );

  const rateTimers = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  React.useEffect(() => {
    // Switching scenario/year cancels any pending debounced rating save rather than letting
    // it fire against state that's since moved on — same guard as projectIdRef in useFutures.
    const timers = rateTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, [scenarioId, targetYear]);

  const rate = React.useCallback(
    (eventId: string, patch: { likelihood?: number; impact?: number }) => {
      if (!scenarioId) return;
      setEvents((prev) => {
        if (!prev) return prev;
        const next = prev.map((e) => (e.id === eventId ? { ...e, ...patch } : e));
        const existing = rateTimers.current.get(eventId);
        if (existing) clearTimeout(existing);
        rateTimers.current.set(
          eventId,
          setTimeout(() => {
            rateTimers.current.delete(eventId);
            saveChainEvents(scenarioId, startYear, targetYear, next)
              .then(setEvents)
              .catch((err) => console.error("[use-futures] failed to save rating", err));
          }, 400)
        );
        return next;
      });
    },
    [scenarioId, startYear, targetYear]
  );

  return { events, loading, generating, regenerate, save, rate };
}
