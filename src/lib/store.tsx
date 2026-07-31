"use client";

// Scenaric.ai global store — React Context replacing the prototype's StoreProvider.
// Backend build order §14 item 1: `authed`/`user` and `projects`/`project` are now
// Supabase-backed (real auth + the projects table); everything else in this store is
// still localStorage-simulated, to be migrated in later build-order steps.

import * as React from "react";
import { FM_DATA } from "./data";
import { createClient } from "./supabase/client";
import {
  listProjects,
  createProject as createProjectAction,
  renameProject as renameProjectAction,
  duplicateProject as duplicateProjectAction,
  setProjectArchived,
  deleteProject as deleteProjectAction,
  type ProjectRow,
} from "./actions/projects";
import {
  listSignals,
  createSignal as createSignalAction,
  updateSignal as updateSignalAction,
  deleteSignal as deleteSignalAction,
  type SignalRow,
  type SignalOrigin,
} from "./actions/signals";
import {
  suggestSignals as suggestSignalsAction,
  scoreUnscoredSignals as scoreUnscoredSignalsAction,
  scoreOneSignal,
  type SuggestSignalsResult,
  type ScoreSignalsResult,
} from "./actions/ai-signals";
import { getMatrixData, updateMatrixDotPosition as updateMatrixDotPositionAction, type MatrixDotData } from "./actions/matrix";
import { classifyMatrixBuckets, reclassifySignal } from "./actions/ai-matrix";
import { buildScenarios as buildScenariosAction, type AxisInput, type BuildScenariosResult } from "./actions/ai-scenarios";
import type {
  ScenaricData,
  Project,
  ProjectSummary,
  Signal,
  SteepCategory,
  Quadrant,
  MatrixDot,
  Scenario,
  Indicator,
  Strategy,
} from "./types";

const { useState, useEffect, useCallback, useMemo, createContext, useContext } = React;

export function usePersistentState<T>(key: string, initial: T) {
  const [val, setVal] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  // Read persisted value once, after mount (keeps SSR/first-render output stable).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) setVal(JSON.parse(stored));
    } catch {}
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist + broadcast on change (only once hydrated, to avoid clobbering storage
  // with the initial value before we've read it).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(val));
      window.dispatchEvent(new CustomEvent("fm:persist", { detail: { key, val } }));
    } catch {}
  }, [key, val, hydrated]);

  // Stay in sync with other hook instances bound to the same key.
  useEffect(() => {
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.key !== key) return;
      setVal((prev) => (JSON.stringify(prev) === JSON.stringify(detail.val) ? prev : detail.val));
    };
    window.addEventListener("fm:persist", onSync);
    return () => window.removeEventListener("fm:persist", onSync);
  }, [key]);

  return [val, setVal] as const;
}

interface User {
  name: string;
  email: string;
  initials: string;
}
interface OnboardingState {
  step: number;
  focal: string;
  refined: string | null;
  horizon: string;
  name: string;
  summary: string;
  industry: string;
  complete: boolean;
}

export function initialsFor(name: string | null | undefined, email: string): string {
  const source = (name || email || "").trim();
  if (!source) return "?";
  const parts = source.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function toProjectSummary(row: ProjectRow): ProjectSummary {
  return {
    id: row.id,
    name: row.name,
    focal_question: row.focal_question,
    horizon: row.horizon,
    industry: row.industry,
    summary: row.summary,
    created: row.created_at,
    stepsComplete: row.steps_complete,
    lastEdited: row.updated_at,
    archived: row.archived,
  };
}

function toSignal(row: SignalRow): Signal {
  return {
    id: row.id,
    category: row.category,
    source: row.source,
    title: row.title,
    body: row.body,
    impact: row.impact,
    uncertainty: row.uncertainty,
    createdAt: row.created_at,
  };
}

function toMatrixDot(d: MatrixDotData): MatrixDot {
  return {
    id: d.signalId,
    sigId: d.signalId,
    x: d.x,
    y: d.y,
    label: d.label,
    color: d.color,
    category: d.signal.category,
    bucket: d.bucket,
  };
}

function toScenario(row: BuildScenariosResult["scenarios"][number]): Scenario {
  return {
    id: row.id,
    name: row.name,
    quadrant: row.quadrant,
    color: row.color || "#9CA3AF",
    tagline: row.tagline || "",
    summary: row.summary || "",
    narrative: row.narrative || "",
    archived: row.is_archived,
  };
}

export interface Store {
  seed: ScenaricData;
  authed: boolean;
  authLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  accountType: string;
  setAccountType: (v: string) => void;
  user: User;
  onboarding: OnboardingState;
  setOnboarding: (v: OnboardingState) => void;
  project: Project;
  setProject: (v: Project) => void;
  projects: ProjectSummary[];
  projectsLoading: boolean;
  createProject: (input: {
    name: string;
    focal_question?: string;
    refined_focal_question?: string | null;
    horizon?: string;
    industry?: string;
    summary?: string;
  }) => Promise<ProjectSummary>;
  renameProject: (id: string, name: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<void>;
  archiveProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  activeProjectId: string | null;
  setActiveProjectId: (v: string | null) => void;
  signals: Signal[];
  signalsLoading: boolean;
  createSignal: (input: {
    projectId: string;
    category: SteepCategory;
    source: string;
    title: string;
    body?: string;
    impact?: number | null;
    uncertainty?: "Low" | "Medium" | "High" | null;
    origin?: SignalOrigin;
    groundedInsightIds?: string[];
  }) => Promise<Signal>;
  updateSignal: (input: {
    id: string;
    title?: string;
    body?: string;
    category?: SteepCategory;
    source?: string;
    impact?: number | null;
    uncertainty?: "Low" | "Medium" | "High" | null;
  }) => Promise<Signal>;
  deleteSignal: (id: string) => Promise<void>;
  suggestSignals: (projectId: string) => Promise<SuggestSignalsResult>;
  scoreUnscoredSignals: (projectId: string) => Promise<ScoreSignalsResult>;
  scoreSignal: (projectId: string, signalId: string) => Promise<void>;
  matrixDots: MatrixDot[];
  setMatrixDots: (v: MatrixDot[]) => void;
  matrixDotsLoading: boolean;
  pendingScoringCount: number;
  pendingScoringIds: string[];
  refreshMatrixData: (projectId: string) => Promise<void>;
  updateMatrixDotPosition: (projectId: string, signalId: string, x: number, y: number) => Promise<void>;
  selectedDot: string;
  setSelectedDot: (v: string) => void;
  scenarios: Scenario[];
  setScenarios: (v: Scenario[]) => void;
  buildScenarios: (input: {
    projectId: string;
    axisA: AxisInput;
    axisB: AxisInput;
    independenceState: "independent" | "correlated" | "uncertain";
    independenceRationale?: string[];
    requestedNames?: Partial<Record<Quadrant, string>>;
  }) => Promise<{ scenarios: Scenario[] }>;
  indicators: Indicator[];
  setIndicators: (v: Indicator[]) => void;
  strategies: Strategy[];
  setStrategies: (v: Strategy[]) => void;
  criticalUncertainties: string[];
  setCriticalUncertainties: (v: string[]) => void;
  navCollapsed: boolean;
  setNavCollapsed: (v: boolean) => void;
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

export const useStore = () => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within a StoreProvider");
  return ctx;
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const seed = FM_DATA;
  const supabase = useMemo(() => createClient(), []);

  // ---- Auth (real, Supabase) ----
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUserState] = useState<User>({ name: "", email: "", initials: "?" });

  useEffect(() => {
    let cancelled = false;

    const hydrateFromSession = async (sessionUserId: string | null, sessionEmail: string | null) => {
      if (!sessionUserId) {
        if (!cancelled) {
          setAuthed(false);
          setUserState({ name: "", email: "", initials: "?" });
        }
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("name, email").eq("id", sessionUserId).single();
      if (cancelled) return;
      const email = profile?.email || sessionEmail || "";
      setAuthed(true);
      setUserState({ name: profile?.name || "", email, initials: initialsFor(profile?.name, email) });
    };

    supabase.auth.getUser().then(({ data }) => {
      hydrateFromSession(data.user?.id ?? null, data.user?.email ?? null).finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateFromSession(session?.user.id ?? null, session?.user.email ?? null);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message || null };
    },
    [supabase]
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      // Email confirmation is on: signUp succeeds but returns no session until the
      // user clicks the confirmation link (see src/app/auth/callback/route.ts).
      const needsEmailConfirmation = !error && !data.session;
      return { error: error?.message || null, needsEmailConfirmation };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const [accountType, setAccountType] = usePersistentState("fm.accountType", "self");

  // Onboarding
  const [onboarding, setOnboarding] = usePersistentState<OnboardingState>("fm.onb", {
    step: 1,
    focal: seed.project.focal_question,
    refined: null,
    horizon: "5-10 years",
    name: seed.project.name,
    summary: seed.project.summary,
    industry: "Technology",
    complete: false,
  });

  // ---- Projects (real, Supabase) ----
  const [projects, setProjectsState] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    const rows = await listProjects();
    const summaries = rows.map(toProjectSummary);
    setProjectsState(summaries);
    return summaries;
  }, []);

  useEffect(() => {
    if (!authed) {
      setProjectsState([]);
      setProjectsLoading(false);
      return;
    }
    setProjectsLoading(true);
    refreshProjects()
      .then((summaries) => {
        setActiveProjectId((prev) => prev || (summaries.find((p) => !p.archived) || summaries[0])?.id || null);
      })
      .catch((err) => console.error("[store] failed to load projects", err))
      .finally(() => setProjectsLoading(false));
  }, [authed, refreshProjects]);

  const createProject = useCallback(
    async (input: {
      name: string;
      focal_question?: string;
      refined_focal_question?: string | null;
      horizon?: string;
      industry?: string;
      summary?: string;
    }) => {
      const row = await createProjectAction(input);
      const summary = toProjectSummary(row);
      await refreshProjects();
      return summary;
    },
    [refreshProjects]
  );
  const renameProject = useCallback(
    async (id: string, name: string) => {
      await renameProjectAction(id, name);
      await refreshProjects();
    },
    [refreshProjects]
  );
  const duplicateProject = useCallback(
    async (id: string) => {
      await duplicateProjectAction(id);
      await refreshProjects();
    },
    [refreshProjects]
  );
  const archiveProject = useCallback(
    async (id: string) => {
      await setProjectArchived(id, true);
      await refreshProjects();
    },
    [refreshProjects]
  );
  const restoreProject = useCallback(
    async (id: string) => {
      await setProjectArchived(id, false);
      await refreshProjects();
    },
    [refreshProjects]
  );
  const deleteProject = useCallback(
    async (id: string) => {
      await deleteProjectAction(id);
      await refreshProjects();
    },
    [refreshProjects]
  );

  // `project` (legacy singular) derives from the active project row so every existing
  // methodology page keeps reading the same shape it always has.
  const project: Project = useMemo(() => {
    const active = projects.find((p) => p.id === activeProjectId);
    if (!active) return seed.project;
    return {
      name: active.name,
      role: "Owner",
      focal_question: active.focal_question,
      horizon: active.horizon,
      industry: active.industry,
      summary: active.summary || "",
      created: active.created || active.lastEdited,
    };
  }, [projects, activeProjectId, seed.project]);
  // The real state transition happens via setActiveProjectId; kept only so existing
  // call sites (page-projects.tsx's openProject) that pass a full Project object don't
  // need to change — `project` above already re-derives from activeProjectId.
  const setProject = useCallback((_v: Project) => {}, []);

  // ---- Signals (real, Supabase) ----
  const [signals, setSignalsState] = useState<Signal[]>([]);
  const [signalsLoading, setSignalsLoading] = useState(true);

  const refreshSignals = useCallback(async (projectId: string) => {
    const rows = await listSignals(projectId);
    setSignalsState(rows.map(toSignal));
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      setSignalsState([]);
      setSignalsLoading(false);
      return;
    }
    setSignalsLoading(true);
    refreshSignals(activeProjectId)
      .catch((err) => console.error("[store] failed to load signals", err))
      .finally(() => setSignalsLoading(false));
  }, [activeProjectId, refreshSignals]);

  const createSignal = useCallback(
    async (input: {
      projectId: string;
      category: SteepCategory;
      source: string;
      title: string;
      body?: string;
      impact?: number | null;
      uncertainty?: "Low" | "Medium" | "High" | null;
      origin?: SignalOrigin;
      groundedInsightIds?: string[];
    }) => {
      const row = await createSignalAction(input);
      await refreshSignals(input.projectId);
      // Fire-and-forget: don't block signal creation on scoring latency (mirrors how
      // "Suggest signals" already chains suggest -> score non-blocking). Refreshes again
      // once scoring lands so the card updates off "Not yet scored" on its own.
      scoreOneSignal(input.projectId, row.id)
        .then(() => refreshSignals(input.projectId))
        .catch((err) => console.error("[store] auto-score failed for new signal", err));
      return toSignal(row);
    },
    [refreshSignals]
  );

  const updateSignal = useCallback(
    async (input: {
      id: string;
      title?: string;
      body?: string;
      category?: SteepCategory;
      source?: string;
      impact?: number | null;
      uncertainty?: "Low" | "Medium" | "High" | null;
    }) => {
      const row = await updateSignalAction(input);
      if (activeProjectId) await refreshSignals(activeProjectId);
      // Self-heals a signal left unscored (e.g. a swallowed AIGenerationFailedError at
      // creation time) — mirrors createSignal's fire-and-forget scoring above.
      if (activeProjectId && (row.impact == null || row.uncertainty == null)) {
        scoreOneSignal(activeProjectId, row.id)
          .then(() => refreshSignals(activeProjectId))
          .catch((err) => console.error("[store] auto-score failed for edited signal", err));
      }
      return toSignal(row);
    },
    [activeProjectId, refreshSignals]
  );

  const deleteSignal = useCallback(
    async (id: string) => {
      await deleteSignalAction(id);
      if (activeProjectId) await refreshSignals(activeProjectId);
    },
    [activeProjectId, refreshSignals]
  );

  const suggestSignals = useCallback(
    async (projectId: string) => {
      const result = await suggestSignalsAction(projectId);
      await refreshSignals(projectId);
      return result;
    },
    [refreshSignals]
  );

  const scoreUnscoredSignals = useCallback(
    async (projectId: string) => {
      const result = await scoreUnscoredSignalsAction(projectId);
      await refreshSignals(projectId);
      return result;
    },
    [refreshSignals]
  );

  // ---- Matrix (real, Supabase) — Matrix backend build, Step 4 (§7) ----
  const [matrixDots, setMatrixDots] = useState<MatrixDot[]>([]);
  const [matrixDotsLoading, setMatrixDotsLoading] = useState(true);
  const [pendingScoringCount, setPendingScoringCount] = useState(0);
  const [pendingScoringIds, setPendingScoringIds] = useState<string[]>([]);

  const refreshMatrixData = useCallback(async (projectId: string) => {
    // getMatrixData first — it auto-positions any newly-scored signal, which classification
    // depends on (classifyMatrixBuckets only ever UPDATEs an existing matrix_dots row, never
    // inserts one). Classify is best-effort: a failed classification leaves that signal's
    // bucket null (an honest, valid "not yet classified" state) rather than blocking the
    // whole page load — matches classifyMatrixBuckets' own per-signal failure tolerance.
    await getMatrixData(projectId);
    await classifyMatrixBuckets(projectId).catch((err) => console.error("[store] bucket classification failed", err));
    const result = await getMatrixData(projectId);
    setMatrixDots(result.dots.map(toMatrixDot));
    setPendingScoringCount(result.pendingScoringCount);
    setPendingScoringIds(result.pendingScoringIds);
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      setMatrixDots([]);
      setPendingScoringCount(0);
      setPendingScoringIds([]);
      setMatrixDotsLoading(false);
      return;
    }
    setMatrixDotsLoading(true);
    refreshMatrixData(activeProjectId)
      .catch((err) => console.error("[store] failed to load matrix data", err))
      .finally(() => setMatrixDotsLoading(false));
  }, [activeProjectId, refreshMatrixData]);

  // On-demand single-signal scoring — Signals Library's "Add to Matrix" on an unscored
  // signal. Unlike createSignal/updateSignal's fire-and-forget scoring, this awaits and lets
  // AIGenerationFailedError propagate: the caller navigates to the Matrix only on success, so
  // it needs to know whether scoring actually landed. Also refreshes matrixDots (not just
  // signals) — matrixDots only auto-refreshes on activeProjectId changes, not on route
  // navigation, so without this a signal scored here wouldn't have a dot yet by the time the
  // Matrix page reads store.matrixDots if that state had already been loaded earlier.
  const scoreSignal = useCallback(
    async (projectId: string, signalId: string) => {
      await scoreOneSignal(projectId, signalId);
      await Promise.all([refreshSignals(projectId), refreshMatrixData(projectId)]);
    },
    [refreshSignals, refreshMatrixData]
  );

  const updateMatrixDotPosition = useCallback(
    async (projectId: string, signalId: string, x: number, y: number) => {
      await updateMatrixDotPositionAction(projectId, signalId, x, y);
      // The position update already cleared the now-stale bucket to null (matrix.ts can't
      // determine Wildcard membership itself — that's a content judgment). Reclassify this
      // one signal immediately rather than waiting for the next full-page classify sweep, so
      // the dot doesn't sit bucket-less after a drag the user just watched happen.
      // Best-effort: on failure it's left null, same honest "not yet classified" state as
      // any other unclassified signal, not a broken drag interaction.
      await reclassifySignal(projectId, signalId).catch((err) => console.error("[store] reclassify after drag failed", err));
      await refreshMatrixData(projectId);
    },
    [refreshMatrixData]
  );

  // ---- Everything below this line is still localStorage-simulated (later build-order steps) ----
  const [selectedDot, setSelectedDot] = useState("d2");
  const [scenarios, setScenarios] = usePersistentState("fm.scenarios", seed.scenarios);
  const [indicators, setIndicators] = usePersistentState("fm.indicators", seed.indicators);
  const [strategies, setStrategies] = usePersistentState("fm.strategies", seed.strategies);
  const [criticalUncertainties, setCriticalUncertainties] = usePersistentState<string[]>(
    "fm.cu",
    ["sg2", "sg4"] // AI Adoption, US-China decoupling
  );
  const [navCollapsed, setNavCollapsed] = usePersistentState("fm.navCollapsed", false);

  // buildScenarios ("Build Scenario Matrix" confirm) is real, Supabase-backed (Step 5, §8) —
  // scenarios/criticalUncertainties above stay local-state containers so Canvas and the
  // Re-axis flow (out of scope for this build) need zero changes; this just feeds them real
  // data instead of the modal's previous 100%-client fabrication.
  const buildScenarios = useCallback(
    async (input: {
      projectId: string;
      axisA: AxisInput;
      axisB: AxisInput;
      independenceState: "independent" | "correlated" | "uncertain";
      independenceRationale?: string[];
      requestedNames?: Partial<Record<Quadrant, string>>;
    }) => {
      const result = await buildScenariosAction(input);
      const mapped = result.scenarios.map(toScenario);
      setScenarios(mapped);
      setCriticalUncertainties([input.axisA.signalId, input.axisB.signalId]);
      await refreshMatrixData(input.projectId);
      return { scenarios: mapped };
    },
    [setScenarios, setCriticalUncertainties, refreshMatrixData]
  );

  const store: Store = {
    seed,
    authed,
    authLoading,
    signIn,
    signUp,
    signOut,
    accountType,
    setAccountType,
    user,
    onboarding,
    setOnboarding,
    project,
    setProject,
    projects,
    projectsLoading,
    createProject,
    renameProject,
    duplicateProject,
    archiveProject,
    restoreProject,
    deleteProject,
    activeProjectId,
    setActiveProjectId,
    signals,
    signalsLoading,
    createSignal,
    updateSignal,
    deleteSignal,
    suggestSignals,
    scoreUnscoredSignals,
    scoreSignal,
    matrixDots,
    setMatrixDots,
    matrixDotsLoading,
    pendingScoringCount,
    pendingScoringIds,
    refreshMatrixData,
    updateMatrixDotPosition,
    selectedDot,
    setSelectedDot,
    scenarios,
    setScenarios,
    buildScenarios,
    indicators,
    setIndicators,
    strategies,
    setStrategies,
    criticalUncertainties,
    setCriticalUncertainties,
    navCollapsed,
    setNavCollapsed,
    reset: () => {
      ["fm.accountType", "fm.onb", "fm.scenarios", "fm.indicators", "fm.strategies", "fm.cu"].forEach((k) =>
        window.localStorage.removeItem(k)
      );
      supabase.auth.signOut().finally(() => {
        window.location.href = "/";
      });
    },
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
