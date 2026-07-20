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

function ScenarioBreadcrumbPicker({ label, scenario, scenarios, scenarioId, onSelect }) {
  const store = window.FM.useStore();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const crumbTextStyle = { fontSize: 12, color: "#9CA3AF", fontFamily: "var(--font-mono)" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
      <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em", color: "#1E1B2E" }}>{store.project.name}</span>
      <span style={crumbTextStyle}>/</span>
      <span style={crumbTextStyle}>{label}</span>
      <span style={crumbTextStyle}>/</span>
      <div ref={ref} style={{ position: "relative" }}>
        <button
          onClick={() => setOpen(o => !o)}
          title="Switch scenario"
          style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            border: "none", background: "transparent", padding: 0, cursor: "pointer",
            fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 600, color: "#1E1B2E",
          }}
        >
          {scenario ? scenario.name : "Select scenario"}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {open && (
          <div className="slide-up" style={{
            position: "absolute", top: "calc(100% + 6px)", left: 0, width: 240, zIndex: 60,
            background: "#fff", border: "1px solid #E5E7EB", borderRadius: 9,
            boxShadow: "0 10px 28px rgba(15,23,42,0.12)", padding: 5,
          }}>
            {scenarios.map(s => (
              <button key={s.id}
                onClick={() => { onSelect(s.id); setOpen(false); }}
                style={{
                  width: "100%", textAlign: "left", padding: "7px 9px", borderRadius: 6,
                  border: "none", background: s.id === scenarioId ? "#F5F5F5" : "transparent",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: 12.5,
                }}
                onMouseEnter={(e) => { if (s.id !== scenarioId) e.currentTarget.style.background = "#FAFAFA"; }}
                onMouseLeave={(e) => { if (s.id !== scenarioId) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }}/>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#1E1B2E" }}>{s.name}</span>
                {s.id === scenarioId && <Icons.Check size={12} stroke="#F97316"/>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScenarioContextHeader({ view }) {
  const store = window.FM.useStore();
  const scenarios = (store && store.scenarios) || [];
  const [scenarioId, setScenarioId] = window.FM.usePersistentState("fm.storylineScenario", scenarios[0] && scenarios[0].id);
  const scenario = scenarios.find(s => s.id === scenarioId) || scenarios[0];

  const v = SCENARIO_VIEWS.find(x => x.id === view);
  const viewLabel = v ? v.label : "";

  if (!scenario) return null;
  const tagline = SCENARIO_TAGLINES[scenario.id] || scenario.summary || scenario.tagline || "";

  return (
    <div style={{ padding: "16px 0" }}>
      <ScenarioBreadcrumbPicker
        label={viewLabel}
        scenario={scenario}
        scenarios={scenarios}
        scenarioId={scenarioId}
        onSelect={setScenarioId}
      />
      <div style={{ color: "#6B7280", fontSize: 13, marginTop: 10, maxWidth: 672, lineHeight: 1.5, textWrap: "pretty" }}>
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
