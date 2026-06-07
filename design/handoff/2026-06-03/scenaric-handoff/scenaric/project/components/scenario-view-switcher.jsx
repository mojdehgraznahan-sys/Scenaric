// Scenario family — shared context header for Matrix, Storyline, Narrative.
// Renders a slim header: scenario picker (dropdown) • view name, plus the
// scenario tagline. Cmd/Ctrl+1/2/3 stay wired as global shortcuts (the
// SideNav surfaces them in its tooltips).

const SCENARIO_VIEWS = [
  { id: "matrix",    label: "Matrix",    view: "Matrix view",    tooltip: "Where could the future go?",       shortcut: "1" },
  { id: "storyline", label: "Storyline", view: "Storyline view", tooltip: "How would we get there?",           shortcut: "2" },
  { id: "narrative", label: "Narrative", view: "Narrative view", tooltip: "What does that future look like?",  shortcut: "3" },
];

// Short scenario blurbs for the header's second line.
const SCENARIO_TAGLINES = {
  sc1: "How open markets + aligned geopolitics produce the best-case future for SEA expansion.",
  sc2: "Markets stay open but politics atomise — speed and modularity beat scale.",
  sc3: "Geopolitical détente but rising protectionism — local-for-local becomes mandatory.",
  sc4: "Worst case: blocs harden and decoupling accelerates — preserve optionality.",
};

function ScenarioContextHeader({ view }) {
  const store = window.FM.useStore();
  const scenarios = (store && store.scenarios) || [];
  const [scenarioId, setScenarioId] = window.FM.usePersistentState("fm.storylineScenario", scenarios[0] && scenarios[0].id);
  const scenario = scenarios.find(s => s.id === scenarioId) || scenarios[0];
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  const v = SCENARIO_VIEWS.find(x => x.id === view);
  const viewName = v ? v.view : "";

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!scenario) return null;
  const tagline = SCENARIO_TAGLINES[scenario.id] || scenario.summary || scenario.tagline || "";

  return (
    <div style={{ padding: "20px 0" }}>
      {/* Line 1 — scenario (dropdown trigger) • view */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
        <div ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 0,
              border: "none", background: "transparent", padding: 0, cursor: "pointer",
              borderRadius: 6,
            }}
            title="Switch scenario"
          >
            <span style={{ width: 10, height: 10, borderRadius: 999, background: scenario.color, marginRight: 8, flexShrink: 0 }}/>
            <span style={{ fontSize: 20, fontWeight: 600, color: "#1E1B2E", letterSpacing: "-0.015em" }}>{scenario.name}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 5 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {open && (
            <div className="slide-up" style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0,
              width: 300, background: "#fff",
              border: "1px solid #E5E7EB", borderRadius: 10,
              boxShadow: "0 12px 32px rgba(15,23,42,0.12)",
              padding: 6, zIndex: 60,
            }}>
              <div style={{
                padding: "6px 10px 8px", fontSize: 10.5, fontFamily: "var(--font-mono)",
                letterSpacing: ".08em", color: "#9CA3AF", textTransform: "uppercase", fontWeight: 600,
              }}>Switch scenario</div>
              {scenarios.map(s => (
                <button key={s.id}
                  onClick={() => { setScenarioId(s.id); setOpen(false); }}
                  style={{
                    width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 7,
                    border: "none", background: s.id === scenarioId ? "#F5F5F5" : "transparent",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  }}
                  onMouseEnter={(e) => { if (s.id !== scenarioId) e.currentTarget.style.background = "#FAFAFA"; }}
                  onMouseLeave={(e) => { if (s.id !== scenarioId) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: s.color, flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1B2E" }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.tagline}</div>
                  </div>
                  {s.id === scenarioId && <Icons.Check size={14} stroke="#F97316"/>}
                </button>
              ))}
            </div>
          )}
        </div>

        <span aria-hidden style={{ color: "#E5E7EB", margin: "0 8px", fontSize: 20 }}>•</span>
        <span style={{ fontSize: 20, fontWeight: 400, color: "#6B7280", letterSpacing: "-0.015em" }}>{viewName}</span>
      </div>

      {/* Line 2 — tagline */}
      <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 672, marginTop: 4, lineHeight: 1.5, textWrap: "pretty" }}>
        {tagline}
      </div>
    </div>
  );
}

function useScenarioShortcuts(navigate) {
  React.useEffect(() => {
    if (!navigate) return;
    const onKey = (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement && document.activeElement.isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const map = { "1": "matrix", "2": "storyline", "3": "narrative" };
      const target = map[e.key];
      if (!target) return;
      e.preventDefault();
      navigate("/app/" + target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}

window.ScenarioContextHeader = ScenarioContextHeader;
window.useScenarioShortcuts = useScenarioShortcuts;
window.SCENARIO_VIEWS = SCENARIO_VIEWS;
