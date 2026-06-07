// Scenaric.ai — main router & state context
const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;

const StoreContext = createContext(null);
const useStore = () => useContext(StoreContext);

function useRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const path = hash.replace(/^#/, "") || "/";
  const navigate = useCallback((p) => { window.location.hash = p.startsWith("#") ? p : "#" + p; }, []);
  return [path, navigate];
}

function usePersistentState(key, initial) {
  const [val, setVal] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch {}
    return initial;
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
    // Broadcast so other hook instances bound to the same key stay in sync.
    try { window.dispatchEvent(new CustomEvent("fm:persist", { detail: { key, val } })); } catch {}
  }, [key, val]);
  useEffect(() => {
    const onSync = (e) => {
      if (!e.detail || e.detail.key !== key) return;
      setVal(prev => {
        const next = e.detail.val;
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
    };
    window.addEventListener("fm:persist", onSync);
    return () => window.removeEventListener("fm:persist", onSync);
  }, [key]);
  return [val, setVal];
}

function StoreProvider({ children }) {
  const seed = window.FM_DATA;

  // Auth (simulated)
  const [authed, setAuthed] = usePersistentState("fm.authed", false);
  const [accountType, setAccountType] = usePersistentState("fm.accountType", "self");
  const [user, setUser] = usePersistentState("fm.user", { name: "John Doe", email: "john@acme.co", initials: "JD" });

  // Onboarding
  const [onboarding, setOnboarding] = usePersistentState("fm.onb", {
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
  const [sources, setSources] = usePersistentState("fm.sources", seed.sources);
  const [signals, setSignals] = usePersistentState("fm.signals", seed.signals);
  const [matrixDots, setMatrixDots] = usePersistentState("fm.matrix", seed.matrix_dots);
  const [selectedDot, setSelectedDot] = useState("d2");
  const [scenarios, setScenarios] = usePersistentState("fm.scenarios", seed.scenarios);
  const [indicators, setIndicators] = usePersistentState("fm.indicators", seed.indicators);
  const [strategies, setStrategies] = usePersistentState("fm.strategies", seed.strategies);
  const [criticalUncertainties, setCriticalUncertainties] = usePersistentState("fm.cu", ["sg2", "sg4"]); // AI Adoption, US-China decoupling
  const [navCollapsed, setNavCollapsed] = usePersistentState("fm.navCollapsed", false);

  const store = {
    seed,
    authed, setAuthed,
    accountType, setAccountType,
    user, setUser,
    onboarding, setOnboarding,
    project, setProject,
    sources, setSources,
    signals, setSignals,
    matrixDots, setMatrixDots,
    selectedDot, setSelectedDot,
    scenarios, setScenarios,
    indicators, setIndicators,
    strategies, setStrategies,
    criticalUncertainties, setCriticalUncertainties,
    navCollapsed, setNavCollapsed,
    reset: () => {
      ["fm.authed","fm.accountType","fm.user","fm.onb","fm.project","fm.sources","fm.signals","fm.matrix","fm.scenarios","fm.indicators","fm.strategies","fm.cu"].forEach(k => localStorage.removeItem(k));
      window.location.hash = "#/";
      window.location.reload();
    },
  };
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

function App() {
  const [path, navigate] = useRoute();

  // Decide which screen — read components from window (they live in other Babel scripts)
  let screen;
  const inApp = path.startsWith("/app");
  if (path === "/" || path === "") {
    screen = <window.Landing navigate={navigate} />;
  } else if (path === "/login" || path === "/signup") {
    screen = <window.Auth navigate={navigate} mode={path.replace("/","")} />;
  } else if (path.startsWith("/onboarding")) {
    screen = <window.Onboarding navigate={navigate} />;
  } else if (inApp) {
    screen = <window.AppShell navigate={navigate} path={path} />;
  } else {
    screen = <window.Landing navigate={navigate} />;
  }

  return screen;
}

// Expose for sub-modules — must happen before mount
window.FM = {
  useStore, usePersistentState, StoreContext, StoreProvider, App,
  useRoute,
  // Re-export react hooks for sub-files that need them via window.FM
  React, useState, useEffect, useRef, useMemo, useCallback,
};

// Defer mount until next tick so any later-attached components register first.
// (Babel-standalone runs type="text/babel" in document order; app.jsx must be LAST.)
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <StoreProvider>
    <App />
  </StoreProvider>
);
