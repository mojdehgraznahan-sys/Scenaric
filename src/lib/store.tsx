"use client";

// Scenaric.ai global store — React Context replacing the prototype's StoreProvider.
// Ported from app.jsx. usePersistentState mirrors the prototype: localStorage-backed
// with cross-instance sync via a window CustomEvent, but SSR-safe (reads storage only
// after mount so server and first client render agree).

import * as React from "react";
import { FM_DATA } from "./data";
import type {
  ScenaricData,
  Project,
  ProjectSummary,
  Source,
  Signal,
  MatrixDot,
  Scenario,
  Indicator,
  Strategy,
} from "./types";

const { useState, useEffect, createContext, useContext } = React;

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
      setVal((prev) =>
        JSON.stringify(prev) === JSON.stringify(detail.val) ? prev : detail.val
      );
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

export interface Store {
  seed: ScenaricData;
  authed: boolean;
  setAuthed: (v: boolean) => void;
  accountType: string;
  setAccountType: (v: string) => void;
  user: User;
  setUser: (v: User) => void;
  onboarding: OnboardingState;
  setOnboarding: (v: OnboardingState) => void;
  project: Project;
  setProject: (v: Project) => void;
  projects: ProjectSummary[];
  setProjects: (v: ProjectSummary[] | ((prev: ProjectSummary[]) => ProjectSummary[])) => void;
  activeProjectId: string | null;
  setActiveProjectId: (v: string | null) => void;
  sources: Source[];
  setSources: (v: Source[]) => void;
  signals: Signal[];
  setSignals: (v: Signal[]) => void;
  matrixDots: MatrixDot[];
  setMatrixDots: (v: MatrixDot[]) => void;
  selectedDot: string;
  setSelectedDot: (v: string) => void;
  scenarios: Scenario[];
  setScenarios: (v: Scenario[]) => void;
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

  // Auth (simulated)
  const [authed, setAuthed] = usePersistentState("fm.authed", false);
  const [accountType, setAccountType] = usePersistentState("fm.accountType", "self");
  const [user, setUser] = usePersistentState<User>("fm.user", {
    name: "John Doe",
    email: "john@acme.co",
    initials: "JD",
  });

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

  // Project state
  const [project, setProject] = usePersistentState("fm.project", seed.project);
  const [projects, setProjects] = usePersistentState<ProjectSummary[]>("fm.projects", seed.projects);
  const [activeProjectId, setActiveProjectId] = usePersistentState<string | null>(
    "fm.activeProjectId",
    (seed.projects[0] && seed.projects[0].id) || null
  );
  const [sources, setSources] = usePersistentState("fm.sources", seed.sources);
  const [signals, setSignals] = usePersistentState("fm.signals", seed.signals);
  const [matrixDots, setMatrixDots] = usePersistentState("fm.matrix", seed.matrix_dots);
  const [selectedDot, setSelectedDot] = useState("d2");
  const [scenarios, setScenarios] = usePersistentState("fm.scenarios", seed.scenarios);
  const [indicators, setIndicators] = usePersistentState("fm.indicators", seed.indicators);
  const [strategies, setStrategies] = usePersistentState("fm.strategies", seed.strategies);
  const [criticalUncertainties, setCriticalUncertainties] = usePersistentState<string[]>(
    "fm.cu",
    ["sg2", "sg4"] // AI Adoption, US-China decoupling
  );
  const [navCollapsed, setNavCollapsed] = usePersistentState("fm.navCollapsed", false);

  const store: Store = {
    seed,
    authed,
    setAuthed,
    accountType,
    setAccountType,
    user,
    setUser,
    onboarding,
    setOnboarding,
    project,
    setProject,
    projects,
    setProjects,
    activeProjectId,
    setActiveProjectId,
    sources,
    setSources,
    signals,
    setSignals,
    matrixDots,
    setMatrixDots,
    selectedDot,
    setSelectedDot,
    scenarios,
    setScenarios,
    indicators,
    setIndicators,
    strategies,
    setStrategies,
    criticalUncertainties,
    setCriticalUncertainties,
    navCollapsed,
    setNavCollapsed,
    reset: () => {
      [
        "fm.authed",
        "fm.accountType",
        "fm.user",
        "fm.onb",
        "fm.project",
        "fm.projects",
        "fm.activeProjectId",
        "fm.sources",
        "fm.signals",
        "fm.matrix",
        "fm.scenarios",
        "fm.indicators",
        "fm.strategies",
        "fm.cu",
      ].forEach((k) => window.localStorage.removeItem(k));
      window.location.href = "/";
      window.location.reload();
    },
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
