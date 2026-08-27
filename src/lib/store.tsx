"use client";

// Scenaric.ai global store — React Context replacing the prototype's StoreProvider.
// Backend build order §14 item 1: `authed`/`user` and `projects`/`project` are now
// Supabase-backed (real auth + the projects table); everything else in this store is
// still localStorage-simulated, to be migrated in later build-order steps.

import * as React from "react";
import { FM_DATA } from "./data";
import { createClient } from "./supabase/client";
import type { CurrentUser } from "./actions/me";
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
import type { MatrixBucket } from "./matrix-mapping";
import { buildScenarios as buildScenariosAction, type AxisInput } from "./actions/ai-scenarios";
import { getScenarios, setScenarioArchived, type ScenarioWithAxes } from "./actions/scenarios";
import type {
  ScenaricData,
  Project,
  ProjectSummary,
  Signal,
  SteepCategory,
  Quadrant,
  MatrixDot,
  Scenario,
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
  id: string;
  name: string;
  email: string;
  role: string;
  initials: string;
  avatarColor: string;
}
type FocalInterviewBlockStatus = "pending" | "active" | "answered" | "skipped";

interface FocalInterviewBlockA {
  keepsAwake: string;
  decision5to10yr: string;
  ownerAndDeadline: string;
  ifWrongBreaks: string;
}
interface FocalInterviewBlockB {
  oracleQ1: string;
  oracleQ2: string;
  oracleQ3: string;
}
interface FocalInterviewBlockC {
  bestCaseAndPath: string;
  worstCaseAndPivots: string;
  turningPoints: string;
}
interface FocalInterviewBlockD {
  inevitable: string;
  genuinelyUncertain: string;
  dependencies: string;
}

interface OnboardingResearchState {
  status: "idle" | "loading" | "ready" | "error";
  data: {
    competitors: string | null;
    regulatory: string | null;
    market: string | null;
    macro: string | null;
    recentNews: string | null;
    citations: { title: string; url: string }[];
  } | null;
  error: string | null;
}

interface FocalQuestionCandidateState {
  question: string;
  criteria: { id: string; label: string; ok: boolean; reason: string }[];
}

interface OnboardingState {
  step: number;
  // Step 1a — interview intro card.
  companyName: string;
  industry: string;
  companySubmitted: boolean;
  // Step 1b — research panel (onboarding.research_context, ai-focal-question.ts).
  research: OnboardingResearchState;
  // Step 1c — the 4-block interview.
  blockStatus: { A: FocalInterviewBlockStatus; B: FocalInterviewBlockStatus; C: FocalInterviewBlockStatus; D: FocalInterviewBlockStatus };
  activeBlock: "A" | "B" | "C" | "D" | null;
  blockA: FocalInterviewBlockA;
  blockB: FocalInterviewBlockB;
  blockC: FocalInterviewBlockC;
  blockD: FocalInterviewBlockD;
  // Step 1d/1e — AI-drafted candidates + the picked one.
  candidates: FocalQuestionCandidateState[] | null;
  candidatesGap: string | null;
  pickedFocal: string | null;
  // Feeds Step 2/3 exactly as before the interview rebuild.
  focal: string;
  refined: string | null; // no longer set by the new flow — always null; kept only because
  // launch()'s createProject({refined_focal_question: refined}) call still passes it through.
  horizon: string;
  name: string;
  summary: string;
  complete: boolean;
  suggestedHorizon: { horizon: string; rationale: string } | null;
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  step: 1,
  companyName: "",
  industry: "Technology",
  companySubmitted: false,
  research: { status: "idle", data: null, error: null },
  blockStatus: { A: "active", B: "pending", C: "pending", D: "pending" },
  activeBlock: "A",
  blockA: { keepsAwake: "", decision5to10yr: "", ownerAndDeadline: "", ifWrongBreaks: "" },
  blockB: { oracleQ1: "", oracleQ2: "", oracleQ3: "" },
  blockC: { bestCaseAndPath: "", worstCaseAndPivots: "", turningPoints: "" },
  blockD: { inevitable: "", genuinelyUncertain: "", dependencies: "" },
  candidates: null,
  candidatesGap: null,
  pickedFocal: null,
  focal: "",
  refined: null,
  horizon: "5-10 years",
  name: "",
  summary: "",
  complete: false,
  suggestedHorizon: null,
};

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

function toScenario(row: ScenarioWithAxes): Scenario {
  return {
    id: row.id,
    name: row.name,
    quadrant: row.quadrant,
    color: row.color || "#9CA3AF",
    tagline: row.tagline || "",
    summary: row.summary || "",
    narrative: row.narrative || "",
    archived: row.archived,
    reaxedAt: row.reaxedAt ? new Date(row.reaxedAt).getTime() : undefined,
    narrativeEditedByUser: row.narrativeEditedByUser,
    logic: row.logic || undefined,
    plausible: row.plausible ?? undefined,
    implausibilityNote: row.implausibilityNote || undefined,
    axisA: row.axisA,
    axisB: row.axisB,
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
  // Resets to DEFAULT_ONBOARDING_STATE — called before starting a genuinely new attempt (a
  // prior one's `complete: true`) rather than resuming an in-progress one. See
  // onboarding/page.tsx's mount-time self-heal and page-projects.tsx's "+ New Project".
  resetOnboarding: () => void;
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
  // Storyline's Ask AI drawer (ask-ai.tsx, context="storyline") lives in AppShell, a sibling
  // of the page content — this is how it learns which scenario + highlighted path (the
  // currently-selected node's ancestors/descendants) page-storyline.tsx currently has, for
  // the "Validate this chain"/"Explain this chain" tasks. nodeTitleById covers every node in
  // the current chain (not just the highlighted subset) so task results can show real titles
  // instead of raw node ids.
  storylineAskAiContext: { scenarioId: string; nodeIds: string[]; nodeTitleById: Record<string, string> } | null;
  setStorylineAskAiContext: (v: { scenarioId: string; nodeIds: string[]; nodeTitleById: Record<string, string> } | null) => void;
  // Narrative's own Ask AI scoping — simpler than Storyline's (no node-highlight concept on
  // this page), kept as its own context rather than overloading storylineAskAiContext's
  // nodeIds/nodeTitleById shape, which is specifically about chain-path highlighting.
  narrativeAskAiContext: { scenarioId: string } | null;
  setNarrativeAskAiContext: (v: { scenarioId: string } | null) => void;
  // Strategy's own Ask AI scoping — "Stress-test this option" needs selectedOption (set while
  // the detail modal is open), "Why is this not robust here?" needs selectedCell (set by
  // clicking one option x scenario robustness dot in the grid); "Suggest a hedge" needs
  // neither, just store.activeProjectId. Both null (or the whole context null, off the
  // Strategy page) simply disables the tasks that need them, same convention as Storyline's
  // needsPath/pathEmpty gating.
  strategyAskAiContext: {
    selectedOption: { id: string; name: string } | null;
    selectedCell: { optionId: string; optionName: string; scenarioId: string; scenarioName: string } | null;
  } | null;
  setStrategyAskAiContext: (
    v: {
      selectedOption: { id: string; name: string } | null;
      selectedCell: { optionId: string; optionName: string; scenarioId: string; scenarioName: string } | null;
    } | null
  ) => void;
  // Monitoring's own Ask AI scoping — "Explain this indicator's status" needs
  // selectedIndicator, set by clicking one indicator row on the Monitoring page (toggle:
  // clicking the same row again deselects). The other three tasks need nothing but
  // store.activeProjectId, same convention as Strategy's "Suggest a hedge".
  monitoringAskAiContext: { selectedIndicator: { id: string; name: string } | null } | null;
  setMonitoringAskAiContext: (v: { selectedIndicator: { id: string; name: string } | null } | null) => void;
  // Matrix's own Ask AI scoping — "Why is this signal a critical uncertainty?" needs
  // selectedDot (the currently-selected dot's signal id/title/bucket); "Are my two selected
  // axes truly independent?" needs topAxisPair to have exactly 2 entries. The other four tasks
  // need neither, just store.activeProjectId, same convention as Strategy's "Suggest a hedge".
  matrixAskAiContext: {
    selectedDot: { signalId: string; title: string; bucket: MatrixBucket | null } | null;
    topAxisPair: { signalId: string; title: string }[];
    axesLocked: boolean;
  } | null;
  setMatrixAskAiContext: (
    v: {
      selectedDot: { signalId: string; title: string; bucket: MatrixBucket | null } | null;
      topAxisPair: { signalId: string; title: string }[];
      axesLocked: boolean;
    } | null
  ) => void;
  scenarios: Scenario[];
  scenariosLoading: boolean;
  setScenarios: (v: Scenario[]) => void;
  refreshScenarios: (projectId: string) => Promise<void>;
  archiveScenario: (scenarioId: string, archived: boolean) => Promise<void>;
  buildScenarios: (input: {
    projectId: string;
    axisA: AxisInput;
    axisB: AxisInput;
    independenceState: "independent" | "correlated" | "uncertain";
    independenceRationale?: string[];
    requestedNames?: Partial<Record<Quadrant, string>>;
  }) => Promise<void>;
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
  const [user, setUserState] = useState<User>({ id: "", name: "", email: "", role: "", initials: "?", avatarColor: "" });

  useEffect(() => {
    let cancelled = false;

    // GET /me (src/app/api/me/route.ts) is the single place that turns a session into a
    // display-ready user (id/name/email/role/initials/avatar_color) — this hydration just
    // consumes it, rather than deriving those fields itself, so there's one source of truth.
    const hydrateFromSession = async (sessionUserId: string | null) => {
      if (!sessionUserId) {
        if (!cancelled) {
          setAuthed(false);
          setUserState({ id: "", name: "", email: "", role: "", initials: "?", avatarColor: "" });
        }
        return;
      }
      try {
        const res = await fetch("/api/me");
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        const me: CurrentUser = await res.json();
        if (cancelled) return;
        setAuthed(true);
        setUserState({ id: me.id, name: me.name, email: me.email, role: me.role, initials: me.initials, avatarColor: me.avatar_color });
      } catch (err) {
        if (cancelled) return;
        console.error("[store] failed to load current user", err);
        // The session itself is real (sessionUserId is set) even though the profile fetch
        // failed — stay authed rather than bouncing the user out over a transient error.
        setAuthed(true);
      }
    };

    supabase.auth.getUser().then(({ data }) => {
      hydrateFromSession(data.user?.id ?? null).finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateFromSession(session?.user.id ?? null);
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

  // Onboarding — "fm.onb.v2" (not "fm.onb"): the interview rebuild changed this shape
  // entirely, and usePersistentState does zero shape validation on load, so a returning
  // browser's old-shape blob under the old key would crash the new interview reading
  // e.g. onboarding.blockA.keepsAwake off an object that never had a blockA key. Renaming the
  // key orphans old data harmlessly rather than needing real migration logic for what's
  // inherently short-lived, in-progress-wizard scratch state.
  //
  // DEFAULT_ONBOARDING_STATE is also resetOnboarding()'s target — "+ New Project"
  // (page-projects.tsx) and onboarding/page.tsx's own mount-time self-heal both reset back to
  // this exact shape once a prior attempt's `complete: true` blob is stale, now that
  // /onboarding is reachable repeatedly (not just once, right after signup).
  const [onboarding, setOnboarding] = usePersistentState<OnboardingState>("fm.onb.v2", DEFAULT_ONBOARDING_STATE);
  const resetOnboarding = useCallback(() => setOnboarding(DEFAULT_ONBOARDING_STATE), [setOnboarding]);

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
  const setProject = useCallback((_v: Project) => {
    void _v;
  }, []);

  // ---- Matrix (real, Supabase) — Matrix backend build, Step 4 (§7) ----
  // Declared before Signals below so createSignal/updateSignal/scoreUnscoredSignals can call
  // refreshMatrixData (which classifies buckets) right after their scoring completes, mirroring
  // the on-demand scoreSignal path further down — the Matrix page should never show a scored,
  // dot-positioned signal that's still bucket-null just because the user never revisited it.
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
      // "Suggest signals" already chains suggest -> score non-blocking). Refreshes signals
      // and matrix data once scoring lands, so the card updates off "Not yet scored" and the
      // new dot gets classified without waiting for the user to revisit the Matrix page.
      scoreOneSignal(input.projectId, row.id)
        .then(() => Promise.all([refreshSignals(input.projectId), refreshMatrixData(input.projectId)]))
        .catch((err) => console.error("[store] auto-score failed for new signal", err));
      return toSignal(row);
    },
    [refreshSignals, refreshMatrixData]
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
      // creation time) — mirrors createSignal's fire-and-forget scoring above, including the
      // matrix-data refresh so the dot gets classified as soon as scoring lands.
      if (activeProjectId && (row.impact == null || row.uncertainty == null)) {
        scoreOneSignal(activeProjectId, row.id)
          .then(() => Promise.all([refreshSignals(activeProjectId), refreshMatrixData(activeProjectId)]))
          .catch((err) => console.error("[store] auto-score failed for edited signal", err));
      }
      return toSignal(row);
    },
    [activeProjectId, refreshSignals, refreshMatrixData]
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
      // Batch scoring (the Build Plan's POST /signals/score) needs to trigger classification
      // the same way the on-demand scoreSignal path already does below — otherwise a batch of
      // newly-scored signals sits dot-positioned but bucket-null until the user happens to
      // revisit the Matrix page.
      await Promise.all([refreshSignals(projectId), refreshMatrixData(projectId)]);
      return result;
    },
    [refreshSignals, refreshMatrixData]
  );

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

  // ---- Scenarios (real, Supabase) — Canvas backend build, Step 5 (§8) ----
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenariosLoading, setScenariosLoading] = useState(true);

  const refreshScenarios = useCallback(async (projectId: string) => {
    const rows = await getScenarios(projectId);
    setScenarios(rows.map(toScenario));
  }, []);

  useEffect(() => {
    if (!activeProjectId) {
      setScenarios([]);
      setScenariosLoading(false);
      return;
    }
    setScenariosLoading(true);
    refreshScenarios(activeProjectId)
      .catch((err) => console.error("[store] failed to load scenarios", err))
      .finally(() => setScenariosLoading(false));
  }, [activeProjectId, refreshScenarios]);

  // PATCH .../scenarios/:id restore/archive toggle — used by Canvas's "Past scenarios"
  // restore action. No AI call, just a persisted field flip + refetch.
  const archiveScenario = useCallback(
    async (scenarioId: string, archived: boolean) => {
      await setScenarioArchived(scenarioId, archived);
      if (activeProjectId) await refreshScenarios(activeProjectId);
    },
    [activeProjectId, refreshScenarios]
  );

  // ---- Everything below this line is still localStorage-simulated (later build-order steps) ----
  const [selectedDot, setSelectedDot] = useState("d2");
  const [storylineAskAiContext, setStorylineAskAiContext] = useState<{
    scenarioId: string;
    nodeIds: string[];
    nodeTitleById: Record<string, string>;
  } | null>(null);
  const [narrativeAskAiContext, setNarrativeAskAiContext] = useState<{ scenarioId: string } | null>(null);
  const [strategyAskAiContext, setStrategyAskAiContext] = useState<{
    selectedOption: { id: string; name: string } | null;
    selectedCell: { optionId: string; optionName: string; scenarioId: string; scenarioName: string } | null;
  } | null>(null);
  const [monitoringAskAiContext, setMonitoringAskAiContext] = useState<{ selectedIndicator: { id: string; name: string } | null } | null>(null);
  const [matrixAskAiContext, setMatrixAskAiContext] = useState<{
    selectedDot: { signalId: string; title: string; bucket: MatrixBucket | null } | null;
    topAxisPair: { signalId: string; title: string }[];
    axesLocked: boolean;
  } | null>(null);
  const [strategies, setStrategies] = usePersistentState("fm.strategies", seed.strategies);
  const [criticalUncertainties, setCriticalUncertainties] = usePersistentState<string[]>(
    "fm.cu",
    ["sg2", "sg4"] // AI Adoption, US-China decoupling
  );
  const [navCollapsed, setNavCollapsed] = usePersistentState("fm.navCollapsed", false);

  // buildScenarios ("Build Scenarios" confirm) is real, Supabase-backed (Step 5, §8) —
  // criticalUncertainties above stays a local-state container so the Re-axis flow (its real
  // commit/migration is out of scope for this build) needs zero changes. Refetches through
  // the canonical GET path (refreshScenarios) rather than hand-mapping the build response, so
  // the newly-built scenarios pick up their axisA/axisB snapshot the same way any other read
  // does.
  const buildScenarios = useCallback(
    async (input: {
      projectId: string;
      axisA: AxisInput;
      axisB: AxisInput;
      independenceState: "independent" | "correlated" | "uncertain";
      independenceRationale?: string[];
      requestedNames?: Partial<Record<Quadrant, string>>;
    }) => {
      await buildScenariosAction(input);
      setCriticalUncertainties([input.axisA.signalId, input.axisB.signalId]);
      await Promise.all([refreshMatrixData(input.projectId), refreshScenarios(input.projectId)]);
    },
    [setCriticalUncertainties, refreshMatrixData, refreshScenarios]
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
    resetOnboarding,
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
    storylineAskAiContext,
    setStorylineAskAiContext,
    narrativeAskAiContext,
    setNarrativeAskAiContext,
    strategyAskAiContext,
    setStrategyAskAiContext,
    monitoringAskAiContext,
    setMonitoringAskAiContext,
    matrixAskAiContext,
    setMatrixAskAiContext,
    scenarios,
    scenariosLoading,
    setScenarios,
    refreshScenarios,
    archiveScenario,
    buildScenarios,
    strategies,
    setStrategies,
    criticalUncertainties,
    setCriticalUncertainties,
    navCollapsed,
    setNavCollapsed,
    reset: () => {
      ["fm.accountType", "fm.onb.v2", "fm.scenarios", "fm.strategies", "fm.cu"].forEach((k) =>
        window.localStorage.removeItem(k)
      );
      supabase.auth.signOut().finally(() => {
        window.location.href = "/";
      });
    },
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
