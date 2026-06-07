// Storyline — causal chain of signals showing HOW a scenario unfolds.
// Five-column directed graph: Precursors → Catalysts → First-order → Second-order → Scenario realized.
// Arrows are interactive: hover to reveal a "+" insert button at the midpoint,
// click to open a popover that exposes relationship + confidence and a remove
// action.

const STORYLINE_DATA = {
  // sc1 = Pacific Connector
  sc1: {
    title: "Pacific Connector",
    summary: "How open markets + aligned geopolitics produce the best-case future for SEA expansion.",
    confidence: 0.32,
    phases: [
      { id: "prec",   range: "2026",            desc: "Initial conditions in place." },
      { id: "cat",    range: "Late 2026 – 2027", desc: "Triggering events fire." },
      { id: "first",  range: "2027 – 2028",     desc: "Direct consequences emerge." },
      { id: "second", range: "2028 – 2029",     desc: "Compounding effects propagate." },
      { id: "real",   range: "2029 – 2030",     desc: "New equilibrium for SEA." },
    ],
    nodes: [
      { id: "p1", phase: "prec",   cat: "Political",   title: "ASEAN unlocks digital trade pact", body: "Customs harmonisation removes friction for cross-border services.", year: "May 2026", strength: 0.7 },
      { id: "p2", phase: "prec",   cat: "Economic",    title: "SEA tech IPO pipeline doubles",    body: "Capital floods regional growth equity; valuations re-rate.",       year: "Q3 2026", strength: 0.6 },
      { id: "p4", phase: "cat",    cat: "Political",   title: "US-China standards climbdown",     body: "Cloud, semiconductor, and AI standards re-converge.",              year: "Q2 2027", strength: 0.5 },
      { id: "p3", phase: "first",  cat: "Technology",  title: "Enterprise AI capex +40% YoY",     body: "Boards greenlight major AI infrastructure across SEA HQs.",        year: "2027",    strength: 0.8 },
      { id: "p5", phase: "first",  cat: "Social",      title: "Talent visa programme launches",   body: "Singapore-led scheme attracts 200K knowledge workers in 18mo.",    year: "Q4 2027", strength: 0.7 },
      { id: "p6", phase: "second", cat: "Economic",    title: "SEA middle-class hits 400M",       body: "Premium consumer categories see step-change in willingness to pay.", year: "2028", strength: 0.9 },
      { id: "p7", phase: "second", cat: "Technology",  title: "Regional cloud federation live",   body: "Cross-border data flows under a unified compliance regime.",       year: "Q3 2028", strength: 0.8 },
      { id: "p8", phase: "real",   cat: "Economic",    title: "Regional GDP growth 5.8%",         body: "Sustained over 3 years; productivity gap to OECD halves.",         year: "2030",    strength: 1.0 },
      { id: "p9", phase: "real",   cat: "Political",   title: "Single digital market ratified",   body: "ASEAN matures into a functional integrated economic bloc.",        year: "Late 2030", strength: 0.85 },
    ],
    edges: [
      { from: "p1", to: "p4", relationship: "Leads to",   confidence: "Strong"   },
      { from: "p2", to: "p4", relationship: "Enables",    confidence: "Moderate" },
      { from: "p1", to: "p3", relationship: "Enables",    confidence: "Moderate" },
      { from: "p2", to: "p3", relationship: "Amplifies",  confidence: "Strong"   },
      { from: "p4", to: "p3", relationship: "Amplifies",  confidence: "Strong"   },
      { from: "p4", to: "p7", relationship: "Enables",    confidence: "Strong"   },
      { from: "p3", to: "p7", relationship: "Leads to",   confidence: "Moderate" },
      { from: "p3", to: "p6", relationship: "Leads to",   confidence: "Moderate" },
      { from: "p5", to: "p6", relationship: "Amplifies",  confidence: "Moderate" },
      { from: "p6", to: "p8", relationship: "Leads to",   confidence: "Strong"   },
      { from: "p7", to: "p8", relationship: "Amplifies",  confidence: "Moderate" },
      { from: "p7", to: "p9", relationship: "Leads to",   confidence: "Strong"   },
    ],
  },

  // sc2 = Fragmented Frontier
  sc2: {
    title: "Fragmented Frontier",
    summary: "Markets stay open but politics atomise. Speed and modularity beat scale.",
    confidence: 0.28,
    phases: [
      { id: "prec",   range: "2026",            desc: "Decoupling accelerates." },
      { id: "cat",    range: "Late 2026",       desc: "Sovereign mandates set the template." },
      { id: "first",  range: "2027 – 2028",     desc: "Multi-stack reality hardens." },
      { id: "second", range: "2028 – 2029",     desc: "Federated architecture wins." },
      { id: "real",   range: "2029 – 2030",     desc: "Local champions outperform." },
    ],
    nodes: [
      { id: "f1", phase: "prec",   cat: "Political",   title: "US-China decoupling deepens",       body: "Bifurcated standards force market-by-market technology choices.", year: "2026",    strength: 0.8 },
      { id: "f2", phase: "cat",    cat: "Political",   title: "Indonesia sovereign cloud rule",    body: "Data residency mandate becomes the SEA template.",                year: "Q4 2026", strength: 0.7 },
      { id: "f3", phase: "first",  cat: "Technology",  title: "Three AI stacks emerge",            body: "Western, Chinese, sovereign. Vendors pick lanes per market.",      year: "2027",    strength: 0.85 },
      { id: "f4", phase: "first",  cat: "Political",   title: "Vietnam follows Indonesia",         body: "Country-level rules diverge sharply on content and AI training.", year: "Q2 2028", strength: 0.7 },
      { id: "f5", phase: "first",  cat: "Economic",    title: "FX bands breached repeatedly",      body: "Cross-border unit economics become unmanageable globally.",        year: "2028",    strength: 0.6 },
      { id: "f6", phase: "second", cat: "Technology",  title: "Federated architecture as default", body: "Local pods on local stacks; shared brand and product spine only.", year: "Q2 2029", strength: 0.9 },
      { id: "f7", phase: "second", cat: "Social",      title: "Local talent premium spikes",       body: "Country-specific compliance + AI skills command 2x premium.",      year: "2029",    strength: 0.65 },
      { id: "f8", phase: "real",   cat: "Economic",    title: "Local champions outperform",        body: "Country pods deliver 30% higher growth than global average.",      year: "2030",    strength: 0.85 },
      { id: "f9", phase: "real",   cat: "Technology",  title: "Speed beats scale",                 body: "Speed-to-market with local fit outweighs cost-of-scale.",          year: "2030",    strength: 0.8 },
    ],
    edges: [
      { from: "f1", to: "f2", relationship: "Leads to",  confidence: "Strong"   },
      { from: "f1", to: "f3", relationship: "Leads to",  confidence: "Strong"   },
      { from: "f2", to: "f3", relationship: "Amplifies", confidence: "Strong"   },
      { from: "f2", to: "f4", relationship: "Leads to",  confidence: "Strong"   },
      { from: "f1", to: "f5", relationship: "Enables",   confidence: "Moderate" },
      { from: "f3", to: "f6", relationship: "Leads to",  confidence: "Strong"   },
      { from: "f4", to: "f6", relationship: "Amplifies", confidence: "Moderate" },
      { from: "f5", to: "f6", relationship: "Enables",   confidence: "Moderate" },
      { from: "f3", to: "f7", relationship: "Leads to",  confidence: "Moderate" },
      { from: "f6", to: "f8", relationship: "Leads to",  confidence: "Strong"   },
      { from: "f6", to: "f9", relationship: "Leads to",  confidence: "Strong"   },
      { from: "f7", to: "f8", relationship: "Amplifies", confidence: "Moderate" },
    ],
  },

  // sc3 = Walled Gardens
  sc3: {
    title: "Walled Gardens",
    summary: "Geopolitical détente but rising protectionism. Local-for-local becomes mandatory.",
    confidence: 0.22,
    phases: [
      { id: "prec",   range: "2026",            desc: "Reshoring instincts harden." },
      { id: "cat",    range: "2027",            desc: "Industrial policy onshores." },
      { id: "first",  range: "2027 – 2028",     desc: "Local mandates spread." },
      { id: "second", range: "2028 – 2029",     desc: "JV-first becomes the rule." },
      { id: "real",   range: "2029 – 2030",     desc: "Politically resilient, lower ROIC." },
    ],
    nodes: [
      { id: "w1", phase: "prec",   cat: "Political",  title: "US-China truce surprises",          body: "Tech standards de-escalate, but protectionism remains.",          year: "Q1 2027", strength: 0.55 },
      { id: "w2", phase: "prec",   cat: "Economic",   title: "Reshoring credits expanded",        body: "SEA governments subsidise domestic manufacturing and data.",      year: "2027",    strength: 0.7 },
      { id: "w3", phase: "cat",    cat: "Political",  title: "Local-for-local mandates",          body: "Data, IP, employment must be in-country for licensed services.",  year: "2028",    strength: 0.85 },
      { id: "w4", phase: "first",  cat: "Technology", title: "Domestic AI compute scales",        body: "National AI fabs and clouds capture latent demand.",              year: "Q3 2028", strength: 0.65 },
      { id: "w5", phase: "second", cat: "Political",  title: "Foreign equity caps tighten",       body: "Minority stake limits become standard across SEA.",               year: "2029",    strength: 0.75 },
      { id: "w6", phase: "second", cat: "Economic",   title: "JV-first becomes the rule",         body: "Every entry requires a local JV partner with majority control.",  year: "Q2 2029", strength: 0.85 },
      { id: "w7", phase: "real",   cat: "Economic",   title: "Market share holds",                body: "Politically resilient operators retain footprint, lower ROIC.",   year: "2030",    strength: 0.7 },
      { id: "w8", phase: "real",   cat: "Social",     title: "Local talent leads",                body: "Foreign exec presence falls below 10% in SEA.",                   year: "2030",    strength: 0.6 },
    ],
    edges: [
      { from: "w1", to: "w3", relationship: "Leads to",   confidence: "Moderate" },
      { from: "w2", to: "w3", relationship: "Amplifies",  confidence: "Strong"   },
      { from: "w2", to: "w4", relationship: "Enables",    confidence: "Strong"   },
      { from: "w3", to: "w4", relationship: "Amplifies",  confidence: "Moderate" },
      { from: "w3", to: "w5", relationship: "Leads to",   confidence: "Strong"   },
      { from: "w3", to: "w6", relationship: "Leads to",   confidence: "Strong"   },
      { from: "w4", to: "w6", relationship: "Enables",    confidence: "Moderate" },
      { from: "w5", to: "w7", relationship: "Leads to",   confidence: "Moderate" },
      { from: "w6", to: "w7", relationship: "Leads to",   confidence: "Strong"   },
      { from: "w6", to: "w8", relationship: "Amplifies",  confidence: "Moderate" },
    ],
  },

  // sc4 = Bamboo Curtain
  sc4: {
    title: "Bamboo Curtain",
    summary: "Worst case: blocs harden, decoupling accelerates. Preserve optionality.",
    confidence: 0.18,
    phases: [
      { id: "prec",   range: "Late 2026",       desc: "Sino-Western tensions spike." },
      { id: "cat",    range: "Q2 2027",         desc: "Sanctions regime broadens." },
      { id: "first",  range: "2027 – 2028",     desc: "Markets bifurcate." },
      { id: "second", range: "2028 – 2029",     desc: "SEA aligns into blocs." },
      { id: "real",   range: "2029 – 2030",     desc: "Strategic pullback, preserve optionality." },
    ],
    nodes: [
      { id: "b1", phase: "prec",   cat: "Political",  title: "Taiwan tensions spike",            body: "Naval incident escalates into 90-day standoff.",                  year: "Late 2026", strength: 0.7 },
      { id: "b2", phase: "cat",    cat: "Political",  title: "Sino-Western relations rupture",   body: "Comprehensive sanctions across tech, finance, shipping.",         year: "Q2 2027",   strength: 0.85 },
      { id: "b3", phase: "first",  cat: "Economic",   title: "Capital controls return",          body: "Major SEA economies reimpose FX restrictions.",                   year: "2027",      strength: 0.75 },
      { id: "b4", phase: "first",  cat: "Technology", title: "Cross-border cloud sanctions",     body: "Cloud services blocked across rival blocs; data must localise.",  year: "Q4 2027",   strength: 0.9 },
      { id: "b5", phase: "second", cat: "Political",  title: "Tech sanctions hit consumer",      body: "Consumer-facing services swept into sanction regimes.",           year: "2028",      strength: 0.8 },
      { id: "b6", phase: "second", cat: "Political",  title: "SEA forced to pick sides",         body: "Bilateral alignment for Indonesia, Vietnam, Philippines.",        year: "2028",      strength: 0.85 },
      { id: "b7", phase: "second", cat: "Economic",   title: "Currency volatility 20%+",         body: "Cross-border ops unviable for many revenue lines.",               year: "2029",      strength: 0.7 },
      { id: "b8", phase: "real",   cat: "Economic",   title: "Pullback from 2 SEA markets",      body: "Indonesia and Philippines exited; Vietnam/Singapore consolidated.", year: "2029-30", strength: 0.85 },
      { id: "b9", phase: "real",   cat: "Economic",   title: "Optionality via minority stakes",  body: "Hold passive positions in local champions; await regime shift.",  year: "2030",      strength: 0.65 },
    ],
    edges: [
      { from: "b1", to: "b2", relationship: "Leads to",   confidence: "Strong"   },
      { from: "b2", to: "b3", relationship: "Leads to",   confidence: "Strong"   },
      { from: "b2", to: "b4", relationship: "Leads to",   confidence: "Strong"   },
      { from: "b3", to: "b5", relationship: "Amplifies",  confidence: "Moderate" },
      { from: "b3", to: "b7", relationship: "Leads to",   confidence: "Strong"   },
      { from: "b4", to: "b5", relationship: "Leads to",   confidence: "Strong"   },
      { from: "b4", to: "b6", relationship: "Leads to",   confidence: "Moderate" },
      { from: "b5", to: "b8", relationship: "Leads to",   confidence: "Strong"   },
      { from: "b6", to: "b8", relationship: "Amplifies",  confidence: "Strong"   },
      { from: "b7", to: "b8", relationship: "Amplifies",  confidence: "Moderate" },
      { from: "b6", to: "b9", relationship: "Enables",    confidence: "Moderate" },
    ],
  },
};

const CAT_STYLE = {
  Social:     { bg: "#F5F3FF", fg: "#8B5CF6", dot: "#8B5CF6" },
  Technology: { bg: "#EFF6FF", fg: "#3B82F6", dot: "#3B82F6" },
  Economic:   { bg: "#ECFDF5", fg: "#10B981", dot: "#10B981" },
  Ecological: { bg: "#F0FDFA", fg: "#14B8A6", dot: "#14B8A6" },
  Political:  { bg: "#FEF2F2", fg: "#EF4444", dot: "#EF4444" },
};

const SOURCE_POOL = {
  Political:  ["Reuters", "FT", "Nikkei", "Politico", "AP"],
  Technology: ["Gartner", "IDC", "MIT Tech Review", "Wired"],
  Economic:   ["Bloomberg", "World Bank", "Economist", "WSJ"],
  Social:     ["Deloitte", "Pew", "Edelman"],
  Ecological: ["IPCC", "Bloomberg Green", "Carbon Brief"],
};

const PHASE_UNCERTAINTY = {
  prec:   ["High", "High", "High", "Medium"],
  cat:    ["High", "Medium", "Medium"],
  first:  ["High", "Medium", "Medium", "Medium", "Low"],
  second: ["Medium", "Medium", "Medium", "Low", "Low"],
  real:   ["Medium", "Low", "Low", "Low"],
};

// Auto-layout constants — match spec.
const CARD_W   = 260;
const COL_GAP  = 80;
const ROW_GAP  = 24;
const COL_PITCH = CARD_W + COL_GAP; // 340

const DEFAULT_COLUMN_LABELS = [
  "Precursors",
  "Catalysts",
  "First-order effects",
  "Second-order",
  "Scenario realized",
];

const RELATIONSHIPS = ["Leads to", "Amplifies", "Blocks", "Enables"];
const CONFIDENCES   = ["Strong", "Moderate", "Weak"];

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return Math.abs(h); }

function enrichNode(node) {
  const sources = SOURCE_POOL[node.cat] || ["Internal"];
  const uPool = PHASE_UNCERTAINTY[node.phase] || ["Medium"];
  const h = hash(node.id);
  return {
    ...node,
    source: node.source || sources[h % sources.length],
    uncertainty: node.uncertainty || uPool[h % uPool.length],
    impact: node.impact || Math.max(1, Math.min(5, Math.round((node.strength || 0.6) * 5))),
  };
}

const edgeKey = (e) => e.from + ">" + e.to;

function PageStoryline({ navigate }) {
  const store = window.FM.useStore();
  const scenarios = store.scenarios;
  const [scenarioId, setScenarioId] = window.FM.usePersistentState("fm.storylineScenario", (scenarios[0] && scenarios[0].id) || "sc1");
  const data = STORYLINE_DATA[scenarioId] || STORYLINE_DATA.sc1;
  const scenario = scenarios.find(s => s.id === scenarioId) || scenarios[0] || { id: scenarioId, name: "Scenario", color: "#F97316", tagline: "", quadrant: "TR" };
  const [selected, setSelected] = React.useState(null);

  // Editable column labels — global across scenarios.
  const [columnLabels, setColumnLabels] = window.FM.usePersistentState("fm.storyColumnLabels", DEFAULT_COLUMN_LABELS);

  // Context panel collapse state
  const [panelOpen, setPanelOpen] = window.FM.usePersistentState("fm.storyPanelOpen", true);

  // Add-signal modal
  const [addModalOpen, setAddModalOpen] = React.useState(false);

  // Page-level toast (shared by canvas + add-signal flow)
  const [toast, setToast] = React.useState(null);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1700);
    return () => clearTimeout(t);
  }, [toast]);
  const showToast = React.useCallback((msg, kind = "success") => setToast({ msg, kind, ts: Date.now() }), []);

  // Per-scenario, editable copy of edges and nodes so changes don't blow away
  // hand-edited connection metadata when switching tabs.
  const [edgesByScenario, setEdgesByScenario] = React.useState(() => {
    const out = {};
    Object.keys(STORYLINE_DATA).forEach(k => out[k] = STORYLINE_DATA[k].edges.map(e => ({ ...e })));
    return out;
  });
  const [nodesByScenario, setNodesByScenario] = React.useState(() => {
    const out = {};
    Object.keys(STORYLINE_DATA).forEach(k => out[k] = STORYLINE_DATA[k].nodes.map(enrichNode));
    return out;
  });

  // Fall back to sc1's chain when the active scenario id isn't a known
  // STORYLINE_DATA key (e.g. a freshly-built or re-axed scenario).
  const dataKey = edgesByScenario[scenarioId] ? scenarioId : "sc1";
  const edges = edgesByScenario[dataKey] || [];
  const nodes = nodesByScenario[dataKey] || [];
  const setEdges = (updater) => setEdgesByScenario(prev => ({ ...prev, [dataKey]: typeof updater === "function" ? updater(prev[dataKey]) : updater }));
  const setNodes = (updater) => setNodesByScenario(prev => ({ ...prev, [dataKey]: typeof updater === "function" ? updater(prev[dataKey]) : updater }));

  const clearChain = () => {
    setNodes([]);
    setEdges([]);
    setSelected(null);
    // Re-arm onboarding so the tooltip appears next time the user populates the chain.
    try { localStorage.removeItem("fm.storyOnboardSeen"); } catch {}
  };
  const autoSuggestChain = () => {
    const fresh = STORYLINE_DATA[scenarioId];
    if (!fresh) return;
    setNodes(fresh.nodes.map(enrichNode));
    setEdges(fresh.edges.map(e => ({ ...e })));
    setSelected(null);
  };

  // Highlight path from a selected node (ancestors + descendants)
  const highlighted = React.useMemo(() => {
    if (!selected) return null;
    const ancestors = new Set([selected]);
    const descendants = new Set([selected]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges) {
        if (descendants.has(e.from) && !descendants.has(e.to)) { descendants.add(e.to); changed = true; }
        if (ancestors.has(e.to) && !ancestors.has(e.from)) { ancestors.add(e.from); changed = true; }
      }
    }
    const allEdges = edges.filter(e =>
      (descendants.has(e.from) && descendants.has(e.to)) ||
      (ancestors.has(e.from) && ancestors.has(e.to))
    );
    return { nodes: new Set([...ancestors, ...descendants]), edges: new Set(allEdges.map(edgeKey)) };
  }, [selected, edges]);

  return (
    <div data-screen-label="App · storyline" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Scenario context header + actions */}
      <div style={{
        flexShrink: 0, background: "#fff", borderBottom: "1px solid #E5E7EB",
        padding: "0 24px",
        display: "flex", alignItems: "flex-start", gap: 16,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <window.ScenarioContextHeader view="storyline"/>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 24 }}>
          {nodes.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={clearChain}
              title="Clear the chain to see the empty state"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M 19 6 l -1 14 a 2 2 0 0 1 -2 2 H 8 a 2 2 0 0 1 -2 -2 L 5 6"/>
              </svg>
              Clear
            </button>
          )}
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setAddModalOpen(true)}
          >
            <Icons.Plus size={12}/> Add Signal to Chain
          </button>
        </div>
      </div>

      {/* Summary bar — stats only (scenario context now lives in the header) */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "12px 24px",
        display: "flex", alignItems: "center", gap: 24,
      }}>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18, color: "#6B7280", fontSize: 12 }}>
          <div>
            <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", letterSpacing: ".06em", color: "#9CA3AF" }}>SIGNALS</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1E1B2E", fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>{nodes.length}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", letterSpacing: ".06em", color: "#9CA3AF" }}>LINKS</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#1E1B2E", fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>{edges.length}</div>
          </div>
          <div style={{ width: 140 }}>
            <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", letterSpacing: ".06em", color: "#9CA3AF" }}>CONFIDENCE</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <div style={{ flex: 1, height: 6, background: "#F3F4F6", borderRadius: 999, overflow: "hidden" }}>
                <div style={{ width: (data.confidence * 100) + "%", height: "100%", background: scenario.color }}/>
              </div>
              <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: scenario.color, fontWeight: 600 }}>{Math.round(data.confidence * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main row: canvas + context panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
        <div style={{ flex: 1, overflow: "auto", background: "#F5F5F5", padding: "24px 0" }} className="scroll-y">
          <StorylineCanvas
            data={data}
            scenarioColor={scenario.color}
            selected={selected}
            setSelected={setSelected}
            highlighted={highlighted}
            columnLabels={columnLabels}
            setColumnLabels={setColumnLabels}
            nodes={nodes}
            setNodes={setNodes}
            edges={edges}
            setEdges={setEdges}
            onAutoSuggest={autoSuggestChain}
            onBrowseLibrary={() => setAddModalOpen(true)}
            showToast={showToast}
          />
        </div>
        <StorylineSidePanel
          open={panelOpen}
          onToggle={() => setPanelOpen(!panelOpen)}
          scenario={scenario}
          data={data}
          nodes={nodes}
          edges={edges}
        />
      </div>

      {/* Page-level toast (rendered above everything, persists across canvas/empty state swap) */}
      <StorylineToast toast={toast}/>

      {/* Add-signal modal */}
      <SignalPickerModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        scenarioId={scenarioId}
        nodes={nodes}
        edges={edges}
        phases={data.phases}
        columnLabels={columnLabels}
        setNodes={setNodes}
        setEdges={setEdges}
        showToast={showToast}
      />
    </div>
  );
}

/* ─────────────────────── Side panel data ─────────────────────── */

const QUADRANT_LABELS = {
  TL: "Predetermined", TR: "Critical", BL: "Background", BR: "Wildcards",
};

// Project-specific axes (the SEA expansion demo)
const AXES = { x: "Geopolitical Alignment", y: "Market Openness" };

const SIGNPOSTS_BY_SCENARIO = {
  sc1: [
    "ASEAN customs harmonisation bill clears committee",
    "Singapore talent visa scheme exceeds 50K issued",
    "Enterprise AI capex run-rate crosses $40B in SEA",
    "US-China standards working group reconvenes",
  ],
  sc2: [
    "Second SEA country adopts Indonesia-style data residency",
    "Vietnam dong band breached for two consecutive quarters",
    "First Western hyperscaler announces sovereign-cloud variant",
    "Federated reference architecture appears in industry RFP",
  ],
  sc3: [
    "US-China bilateral working group resumes formal talks",
    "Local-equity floor proposed in Indonesian draft law",
    "National AI compute capacity announcement (any SEA market)",
    "Foreign equity caps debated in Vietnamese parliament",
  ],
  sc4: [
    "Naval incident in Taiwan Strait escalates beyond 14 days",
    "Capital controls reintroduced in any major SEA market",
    "Consumer-facing cloud service added to sanction list",
    "Reuters reports SEA alignment summit invitations",
  ],
};

const GAP_BY_SCENARIO = {
  sc1: {
    from: "ASEAN unlocks digital trade pact",
    to:   "Enterprise AI capex +40% YoY",
    suggest: "policy-pilot announcements, cross-border procurement RFPs",
  },
  sc2: {
    from: "Indonesia sovereign cloud rule",
    to:   "Federated architecture as default",
    suggest: "vendor lane-pick announcements, reference customer migrations",
  },
  sc3: {
    from: "Local-for-local mandates",
    to:   "JV-first becomes the rule",
    suggest: "minority-stake deal flow, foreign-equity cap debates",
  },
  sc4: {
    from: "Cross-border cloud sanctions",
    to:   "Pullback from 2 SEA markets",
    suggest: "tariff retaliation events, manufacturing relocation announcements",
  },
};

const CONFIDENCE_WEIGHT = { Strong: 1, Moderate: 0.65, Weak: 0.3 };

function computeChainStrength(nodes, edges) {
  if (!nodes.length) return { pct: 0, signalCount: 0, confidence: 0 };
  const evidence = edges.reduce((sum, e) => sum + (CONFIDENCE_WEIGHT[e.confidence] || 0.5), 0);
  // Saturate at ~1.5 edges per node — meaningful chain density.
  const density = Math.min(1, evidence / Math.max(1, nodes.length * 1.5));
  const confidence = Math.round(density * 100);
  const pct = Math.min(100, Math.round((nodes.length / 14) * 50 + density * 50));
  return { pct, signalCount: nodes.length, confidence };
}

function StorylineSidePanel({ open, onToggle, scenario, data, nodes, edges }) {
  const PANEL_W = 300;
  const COLLAPSED_W = 40;

  // Signals flagged as "needs review" by a recent re-axis migration.
  const [reaxReview, setReaxReview] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("fm.reaxReview") || "[]"); } catch { return []; }
  });
  React.useEffect(() => {
    const sync = () => { try { setReaxReview(JSON.parse(localStorage.getItem("fm.reaxReview") || "[]")); } catch {} };
    window.addEventListener("fm:persist", sync);
    return () => window.removeEventListener("fm:persist", sync);
  }, []);
  const allSignals = (window.FM_DATA && window.FM_DATA.signals) || [];
  const reviewSignals = reaxReview.map(id => allSignals.find(s => s.id === id)).filter(Boolean);
  const clearReview = (id) => {
    const next = reaxReview.filter(x => x !== id);
    setReaxReview(next);
    try { localStorage.setItem("fm.reaxReview", JSON.stringify(next)); } catch {}
  };
  const strength = computeChainStrength(nodes, edges);
  const quadrantLabel = QUADRANT_LABELS[scenario.quadrant] || "Critical";
  const signposts = SIGNPOSTS_BY_SCENARIO[scenario.id] || SIGNPOSTS_BY_SCENARIO.sc1;
  const gap = GAP_BY_SCENARIO[scenario.id] || GAP_BY_SCENARIO.sc1;

  // Backward-in-time edges — the canvas flags these in amber; surface them here too.
  const phaseIdx = (id) => {
    const n = nodes.find(x => x.id === id);
    if (!n) return -1;
    return data.phases.findIndex(p => p.id === n.phase);
  };
  const backwardEdges = edges.filter(e => {
    const a = phaseIdx(e.from); const b = phaseIdx(e.to);
    return a >= 0 && b >= 0 && a > b;
  });

  if (!open) {
    return (
      <aside style={{
        width: COLLAPSED_W, flexShrink: 0,
        borderLeft: "1px solid #E5E7EB",
        background: "#fff",
        display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16,
      }}>
        <button
          onClick={onToggle}
          title="Expand context panel"
          aria-label="Expand context panel"
          style={{
            width: 28, height: 28, borderRadius: 7,
            border: "1px solid #E5E7EB", background: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#6B7280",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div style={{
          marginTop: 14,
          fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".6px",
          color: "#9CA3AF", textTransform: "uppercase",
          writingMode: "vertical-rl", transform: "rotate(180deg)",
        }}>
          Scenario context
        </div>
      </aside>
    );
  }

  return (
    <aside style={{
      width: PANEL_W, flexShrink: 0,
      borderLeft: "1px solid #E5E7EB",
      background: "#fff",
      overflow: "auto",
      padding: 20,
      position: "relative",
    }} className="scroll-y slide-up">
      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        title="Collapse panel"
        aria-label="Collapse context panel"
        style={{
          position: "absolute", top: 14, right: 14,
          width: 26, height: 26, borderRadius: 6,
          border: "1px solid #E5E7EB", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: "#6B7280",
          zIndex: 2,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </button>

      {/* 1. Scenario header */}
      <section style={{ paddingRight: 30 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          letterSpacing: ".6px", color: "#F97316",
          textTransform: "uppercase", fontWeight: 600,
        }}>
          Scenario
        </div>
        <h3 style={{
          margin: "4px 0 10px", fontSize: 18, fontWeight: 600,
          color: "#1E1B2E", letterSpacing: "-0.01em", lineHeight: 1.25,
        }}>
          {scenario.name}
        </h3>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <QuadrantMini active={scenario.quadrant} color={scenario.color}/>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.45, flex: 1 }}>
            From <span style={{ color: "#1E1B2E", fontWeight: 500 }}>{quadrantLabel}</span> quadrant
            <div style={{ color: "#9CA3AF", marginTop: 2 }}>
              ({AXES.x} × {AXES.y})
            </div>
          </div>
        </div>
      </section>

      <Divider/>

      {/* 2. Chain strength meter */}
      <section>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1E1B2E" }}>Evidence Strength</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#F97316", fontWeight: 600 }}>
            {strength.pct}%
          </span>
        </div>
        <div style={{
          height: 6, background: "#E5E7EB", borderRadius: 999, overflow: "hidden",
        }}>
          <div style={{
            width: strength.pct + "%", height: "100%", background: "#F97316",
            borderRadius: 999,
            transition: "width .6s cubic-bezier(.4,.0,.2,1)",
          }}/>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6B7280" }}>
          <span style={{ fontFamily: "var(--font-mono)", color: "#1E1B2E", fontWeight: 600 }}>{strength.signalCount}</span> signals chained
          <span style={{ color: "#D1D5DB", margin: "0 6px" }}>·</span>
          <span style={{ fontFamily: "var(--font-mono)", color: "#1E1B2E", fontWeight: 600 }}>{strength.confidence}%</span> confidence
        </div>
      </section>

      <Divider/>

      {/* 3. Signposts to watch */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".6px",
            color: "#6B7280", textTransform: "uppercase", fontWeight: 600,
          }}>
            Signposts to watch
          </span>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>{signposts.length}</span>
        </div>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {signposts.map((sp, i) => (
            <li key={i} style={{ display: "flex", gap: 10 }}>
              <Icons.Eye size={16} stroke="#F97316" style={{ flexShrink: 0, marginTop: 1 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#1E1B2E", lineHeight: 1.4, textWrap: "pretty" }}>{sp}</div>
                <span style={{
                  display: "inline-block", marginTop: 5,
                  padding: "2px 7px",
                  background: "#F5F5F5", color: "#6B7280",
                  fontSize: 10, fontFamily: "var(--font-mono)",
                  letterSpacing: ".04em", borderRadius: 999, textTransform: "uppercase",
                  fontWeight: 500,
                }}>
                  Not yet observed
                </span>
              </div>
            </li>
          ))}
        </ul>
        <button
          style={{
            marginTop: 12, padding: 0,
            border: "none", background: "transparent",
            color: "#F97316", fontSize: 13, fontWeight: 500,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Add signpost
        </button>
      </section>

      <Divider/>

      {/* 4. Gaps in chain */}
      <section>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: ".6px",
          color: "#6B7280", textTransform: "uppercase", fontWeight: 600,
          marginBottom: 10,
        }}>
          Gaps in chain
        </div>

        {/* Re-axis: signals needing manual placement */}
        {reviewSignals.length > 0 && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "#F59E0B", flexShrink: 0 }}/>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>
                {reviewSignals.length} signal{reviewSignals.length === 1 ? "" : "s"} need review
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#78350F", lineHeight: 1.5, marginBottom: 6 }}>
              Re-axis couldn't place these confidently. Drag them into the right column, then mark resolved.
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {reviewSignals.map(s => (
                <li key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "#92400E" }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>— {s.title}</span>
                  <button onClick={() => clearReview(s.id)} style={{ border: "none", background: "transparent", color: "#B45309", fontSize: 11, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>Resolve</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Backward-in-time arrows */}
        {backwardEdges.length > 0 && (
          <div style={{
            background: "#FFFBEB", border: "1px solid #FDE68A",
            borderRadius: 10, padding: 12, marginBottom: 10,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>
                {backwardEdges.length} backward connection{backwardEdges.length === 1 ? "" : "s"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#78350F", lineHeight: 1.5 }}>
              These arrows point earlier in causal time. Common when a feedback loop or late-stage signal influences a precursor.
            </div>
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4 }}>
              {backwardEdges.slice(0, 3).map(e => {
                const a = nodes.find(n => n.id === e.from);
                const b = nodes.find(n => n.id === e.to);
                return (
                  <li key={e.from + ">" + e.to} style={{
                    fontSize: 11.5, color: "#92400E",
                    fontFamily: "var(--font-mono)", letterSpacing: ".01em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    — {(a && a.title || e.from).slice(0, 22)} → {(b && b.title || e.to).slice(0, 22)}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div style={{
          background: "#FFF7ED", border: "1px solid #FED7AA",
          borderRadius: 10, padding: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#C2410C", letterSpacing: "-.005em" }}>
              Gap detected
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: "#7C2D12", lineHeight: 1.5, textWrap: "pretty" }}>
            No signals connect <strong style={{ color: "#1E1B2E", fontWeight: 600 }}>"{gap.from}"</strong> to <strong style={{ color: "#1E1B2E", fontWeight: 600 }}>"{gap.to}"</strong>. Suggested: {gap.suggest}.
          </div>
          <button
            style={{
              marginTop: 10, padding: 0,
              border: "none", background: "transparent",
              color: "#F97316", fontSize: 13, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
            }}
          >
            Find signals
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </section>
    </aside>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#E5E7EB", margin: "18px 0" }}/>;
}

function QuadrantMini({ active = "TR", color = "#F97316" }) {
  // 2×2 grid mini-map
  const cells = ["TL", "TR", "BL", "BR"];
  return (
    <div style={{
      width: 36, height: 36,
      display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr",
      gap: 2, padding: 2,
      border: "1px solid #E5E7EB", borderRadius: 6,
      background: "#fff", flexShrink: 0,
    }}
    aria-label={`Quadrant ${active} active`}>
      {cells.map(q => (
        <div key={q} style={{
          background: q === active ? color : "#F3F4F6",
          borderRadius: 2,
        }}/>
      ))}
    </div>
  );
}

function StorylineCanvas({ data, scenarioColor, selected, setSelected, highlighted, columnLabels, setColumnLabels, nodes, setNodes, edges, setEdges, onAutoSuggest, onBrowseLibrary, showToast }) {
  // Onboarding tooltip — fires the first time the user populates an empty chain.
  const [onboardSeen, setOnboardSeen] = window.FM.usePersistentState("fm.storyOnboardSeen", false);
  const [tooltipFor, setTooltipFor] = React.useState(null);
  const prevCount = React.useRef(nodes.length);
  React.useEffect(() => {
    if (prevCount.current === 0 && nodes.length > 0 && !onboardSeen) {
      setTooltipFor(nodes[0].id);
    }
    if (nodes.length === 0) setTooltipFor(null);
    prevCount.current = nodes.length;
  }, [nodes.length, onboardSeen]);
  const dismissTooltip = () => { setTooltipFor(null); setOnboardSeen(true); };

  const cardRefs = React.useRef({});
  const containerRef = React.useRef(null);
  const [layout, setLayout] = React.useState({ width: 0, height: 0, positions: {} });

  // Arrow interaction state
  const [hoveredEdge, setHoveredEdge] = React.useState(null);
  const [popover, setPopover] = React.useState(null); // { key, x, y }

  // Unified pointer-drag state. One operation at a time.
  //  Card drag:  { kind:"card", id, x, y, offsetX, offsetY, w, h, overPhase, overIndex, moved }
  //  Edge drag:  { kind:"edge", mode:"new"|"rewire", x, y, anchorId, anchorIsSource,
  //               dragEdgeKey?, overId, invalid }
  const [pointerDrag, setPointerDrag] = React.useState(null);

  React.useLayoutEffect(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const positions = {};
    for (const id in cardRefs.current) {
      const el = cardRefs.current[id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      positions[id] = {
        left: r.left - containerRect.left,
        right: r.right - containerRect.left,
        top: r.top - containerRect.top,
        bottom: r.bottom - containerRect.top,
        midY: r.top - containerRect.top + r.height / 2,
        width: r.width,
        height: r.height,
      };
    }
    setLayout({ width: containerRect.width, height: containerRect.height, positions });
  }, [data, nodes, edges.length, pointerDrag && pointerDrag.kind === "card" ? `${pointerDrag.overPhase}:${pointerDrag.overIndex}` : null]);

  // Group nodes by phase, preserving local order.
  const nodesByPhase = {};
  data.phases.forEach(p => nodesByPhase[p.id] = []);
  nodes.forEach(n => {
    if (nodesByPhase[n.phase]) nodesByPhase[n.phase].push(n);
    else nodesByPhase[data.phases[data.phases.length - 1].id].push(n);
  });

  // ─── Helpers ─────────────────────────────────────────────────────────

  const phaseIdx = React.useCallback((phaseId) => data.phases.findIndex(p => p.id === phaseId), [data]);
  const isBackward = React.useCallback((fromId, toId) => {
    const a = nodes.find(n => n.id === fromId);
    const b = nodes.find(n => n.id === toId);
    if (!a || !b) return false;
    return phaseIdx(a.phase) > phaseIdx(b.phase);
  }, [nodes, phaseIdx]);

  const wouldCreateCycle = React.useCallback((fromId, toId, ignoreEdgeKey = null) => {
    if (fromId === toId) return true;
    // BFS from `toId` along outgoing edges; if we hit `fromId`, adding from→to closes a cycle.
    const adj = {};
    edges.forEach(e => {
      if (ignoreEdgeKey && edgeKey(e) === ignoreEdgeKey) return;
      (adj[e.from] = adj[e.from] || []).push(e.to);
    });
    const stack = [toId]; const seen = new Set([toId]);
    while (stack.length) {
      const n = stack.pop();
      const outs = adj[n] || [];
      for (const o of outs) {
        if (o === fromId) return true;
        if (!seen.has(o)) { seen.add(o); stack.push(o); }
      }
    }
    return false;
  }, [edges]);

  const findCardUnder = React.useCallback((x, y) => {
    for (const id in layout.positions) {
      const p = layout.positions[id];
      if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom) return id;
    }
    return null;
  }, [layout]);

  const columnRefs = React.useRef({});

  // ─── Pointer drag — cards ────────────────────────────────────────────

  const startCardDrag = (id) => (e) => {
    e.preventDefault();
    const containerRect = containerRef.current.getBoundingClientRect();
    const cardEl = cardRefs.current[id];
    if (!cardEl) return;
    const r = cardEl.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;
    setPopover(null);
    setPointerDrag({
      kind: "card",
      id,
      startX: e.clientX, startY: e.clientY,
      x, y,
      offsetX: e.clientX - r.left,
      offsetY: e.clientY - r.top,
      w: r.width, h: r.height,
      overPhase: null,
      overIndex: -1,
      moved: false,
    });
  };

  // ─── Pointer drag — arrow endpoints / new arrow ─────────────────────

  const startEdgeRewire = (edgeK, which) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const containerRect = containerRef.current.getBoundingClientRect();
    const edge = edges.find(ed => edgeKey(ed) === edgeK);
    if (!edge) return;
    const anchorId = which === "from" ? edge.to : edge.from;
    const anchorIsSource = which === "to"; // we keep the "from" fixed if user grabbed "to"
    setPointerDrag({
      kind: "edge", mode: "rewire",
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      anchorId, anchorIsSource,
      dragEdgeKey: edgeK,
      overId: null,
      invalid: false,
    });
  };
  const startCreateArrow = (fromId) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const containerRect = containerRef.current.getBoundingClientRect();
    setPointerDrag({
      kind: "edge", mode: "new",
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      anchorId: fromId,
      anchorIsSource: true,
      overId: null,
      invalid: false,
    });
  };

  // ─── Global pointer listeners while a drag is active ────────────────

  React.useEffect(() => {
    if (!pointerDrag) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const onMove = (e) => {
      const x = e.clientX - containerRect.left;
      const y = e.clientY - containerRect.top;

      setPointerDrag(d => {
        if (!d) return d;
        if (d.kind === "card") {
          const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
          const moved = d.moved || dist > 4;
          // Figure out hovered column from cursor x.
          let overPhase = null;
          let overIndex = -1;
          if (moved) {
            for (const phase of data.phases) {
              const colEl = columnRefs.current[phase.id];
              if (!colEl) continue;
              const cr = colEl.getBoundingClientRect();
              if (e.clientX >= cr.left - COL_GAP / 2 && e.clientX <= cr.right + COL_GAP / 2) {
                overPhase = phase.id;
                const slots = colEl.querySelectorAll("[data-card-slot]");
                let idx = slots.length;
                for (let i = 0; i < slots.length; i++) {
                  const sr = slots[i].getBoundingClientRect();
                  const mid = sr.top + sr.height / 2;
                  if (e.clientY < mid) { idx = i; break; }
                }
                overIndex = idx;
                break;
              }
            }
          }
          return { ...d, x, y, overPhase, overIndex, moved };
        }
        if (d.kind === "edge") {
          let overId = null;
          for (const id in layout.positions) {
            const p = layout.positions[id];
            if (x >= p.left && x <= p.right && y >= p.top && y <= p.bottom) { overId = id; break; }
          }
          let invalid = false;
          if (overId) {
            if (overId === d.anchorId) invalid = true;
            else if (d.mode === "new") {
              if (wouldCreateCycle(d.anchorId, overId)) invalid = true;
              if (edges.some(ed => ed.from === d.anchorId && ed.to === overId)) invalid = true;
            } else if (d.mode === "rewire") {
              const newFrom = d.anchorIsSource ? d.anchorId : overId;
              const newTo   = d.anchorIsSource ? overId : d.anchorId;
              if (newFrom === newTo) invalid = true;
              else if (wouldCreateCycle(newFrom, newTo, d.dragEdgeKey)) invalid = true;
              else if (edges.some(ed => edgeKey(ed) !== d.dragEdgeKey && ed.from === newFrom && ed.to === newTo)) invalid = true;
            }
          }
          return { ...d, x, y, overId, invalid };
        }
        return d;
      });
    };

    const onUp = () => {
      setPointerDrag(prev => {
        if (!prev) return null;
        if (prev.kind === "card") {
          if (!prev.moved) {
            // Treat a no-move press/release as a click on the card — toggle selection.
            setSelected(cur => cur === prev.id ? null : prev.id);
          } else if (prev.overPhase) {
            const targetIdx = prev.overIndex < 0 ? 0 : prev.overIndex;
            setNodes(ns => {
              const moving = ns.find(n => n.id === prev.id);
              if (!moving) return ns;
              const without = ns.filter(n => n.id !== prev.id);
              const phaseStart = without.findIndex(n => n.phase === prev.overPhase);
              const insertAt = phaseStart === -1 ? without.length : phaseStart + targetIdx;
              return [...without.slice(0, insertAt), { ...moving, phase: prev.overPhase }, ...without.slice(insertAt)];
            });
            showToast("Saved");
          }
        } else if (prev.kind === "edge") {
          if (prev.overId && !prev.invalid) {
            if (prev.mode === "new") {
              const newEdge = { from: prev.anchorId, to: prev.overId, relationship: "Leads to", confidence: "Moderate" };
              setEdges(es => [...es, newEdge]);
              // Open popover next to the newly-created edge
              setTimeout(() => {
                const from = layout.positions[newEdge.from];
                const to   = layout.positions[newEdge.to];
                if (from && to) {
                  setPopover({ key: edgeKey(newEdge), x: (from.right + to.left) / 2, y: (from.midY + to.midY) / 2 });
                }
              }, 0);
              showToast("Connection created");
            } else if (prev.mode === "rewire") {
              const newFrom = prev.anchorIsSource ? prev.anchorId : prev.overId;
              const newTo   = prev.anchorIsSource ? prev.overId : prev.anchorId;
              setEdges(es => es.map(ed => edgeKey(ed) === prev.dragEdgeKey ? { ...ed, from: newFrom, to: newTo } : ed));
              showToast("Connection updated");
            }
          } else if (prev.overId && prev.invalid) {
            if (prev.overId === prev.anchorId) {
              // dropped on source — silent snap-back
            } else if (prev.mode === "new" && wouldCreateCycle(prev.anchorId, prev.overId)) {
              showToast("Circular connection not allowed", "error");
            } else if (prev.mode === "rewire") {
              const newFrom = prev.anchorIsSource ? prev.anchorId : prev.overId;
              const newTo   = prev.anchorIsSource ? prev.overId : prev.anchorId;
              if (wouldCreateCycle(newFrom, newTo, prev.dragEdgeKey)) showToast("Circular connection not allowed", "error");
            }
          }
        }
        return null;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pointerDrag && pointerDrag.kind, data, layout, edges, wouldCreateCycle]);

  // ─── Insert / edge edits ────────────────────────────────────────────

  // Insert a placeholder signal between two existing ones.
  const insertBetween = (edge) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode   = nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) return;
    const fromIdx = data.phases.findIndex(p => p.id === fromNode.phase);
    const toIdx   = data.phases.findIndex(p => p.id === toNode.phase);
    let midIdx = Math.round((fromIdx + toIdx) / 2);
    if (midIdx === fromIdx) midIdx = Math.min(data.phases.length - 1, fromIdx + 1);
    if (midIdx === toIdx)   midIdx = Math.max(0, toIdx - 1);
    if (midIdx === fromIdx) midIdx = toIdx;
    const newPhase = data.phases[midIdx].id;
    const newId = "ins" + Date.now().toString(36);
    const newNode = enrichNode({
      id: newId, phase: newPhase, cat: fromNode.cat,
      title: "New signal", body: "Click Edit to describe how this links the chain.",
      year: "—", strength: 0.5, source: "Draft", uncertainty: "Medium", impact: 3,
    });
    setNodes(ns => [...ns, newNode]);
    setEdges(es => [
      ...es.filter(e => !(e.from === edge.from && e.to === edge.to)),
      { from: edge.from, to: newId, relationship: edge.relationship || "Leads to", confidence: "Moderate" },
      { from: newId, to: edge.to,   relationship: "Leads to", confidence: "Moderate" },
    ]);
    setHoveredEdge(null);
    setPopover(null);
    setSelected(newId);
    showToast("Signal inserted");
  };

  const updateEdge = (key, patch) => {
    setEdges(es => es.map(e => edgeKey(e) === key ? { ...e, ...patch } : e));
    showToast("Saved");
  };
  const removeEdge = (key) => {
    setEdges(es => es.filter(e => edgeKey(e) !== key));
    setPopover(null);
    showToast("Connection removed");
  };

  // Close popover on outside click / escape
  React.useEffect(() => {
    if (!popover) return;
    const onKey = (e) => { if (e.key === "Escape") setPopover(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popover]);

  // Empty state — fully replaces the column grid. Must sit AFTER every hook
  // declaration so the hook count is stable across populated/empty transitions.
  if (nodes.length === 0) {
    return <StorylineEmptyState onAutoSuggest={onAutoSuggest} onBrowseLibrary={onBrowseLibrary}/>;
  }

  // Total minimum width keeps the 5×CARD_W + 4×GAP layout intact during scroll.
  const TOTAL_W = 5 * CARD_W + 4 * COL_GAP;

  return (
    <div style={{ minWidth: TOTAL_W + 48, padding: "0 24px", position: "relative" }}>
      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(5, ${CARD_W}px)`, columnGap: COL_GAP, marginBottom: 18 }}>
        {data.phases.map((p, i) => (
          <ColumnHeader
            key={p.id}
            index={i}
            label={columnLabels[i] || DEFAULT_COLUMN_LABELS[i]}
            range={p.range}
            desc={p.desc}
            scenarioColor={scenarioColor}
            onChange={(v) => {
              const next = [...columnLabels];
              while (next.length < 5) next.push(DEFAULT_COLUMN_LABELS[next.length]);
              next[i] = v;
              setColumnLabels(next);
            }}
          />
        ))}
      </div>

      {/* Canvas with cards + SVG overlay + dotted dividers */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: `repeat(5, ${CARD_W}px)`,
          columnGap: COL_GAP,
          rowGap: ROW_GAP,
          paddingTop: 4,
        }}
        onClick={(e) => {
          // Click outside a card / arrow clears popover + selection
          if (e.target === e.currentTarget) {
            setPopover(null);
            setSelected(null);
          }
        }}
      >
        {/* Dotted column dividers between columns (subtle temporal beat) */}
        {[1, 2, 3, 4].map(i => (
          <div key={"div-" + i} aria-hidden style={{
            position: "absolute",
            top: -28,
            bottom: -12,
            left: i * COL_PITCH - COL_GAP / 2,
            width: 0,
            borderLeft: "1px dashed #E5E7EB",
            pointerEvents: "none",
            zIndex: 0,
          }}/>
        ))}

        {/* SVG arrows */}
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", zIndex: 3, pointerEvents: "none" }}
          width={layout.width} height={layout.height}
        >
          <defs>
            <marker id="fm-arrow-default" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6B7280"/>
            </marker>
            <marker id="fm-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#F97316"/>
            </marker>
            <marker id="fm-arrow-scenario" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={scenarioColor}/>
            </marker>
            <marker id="fm-arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#F59E0B"/>
            </marker>
          </defs>
          {edges.map(e => {
            const from = layout.positions[e.from];
            const to   = layout.positions[e.to];
            if (!from || !to) return null;
            const k = edgeKey(e);
            // Hide the edge entirely while its endpoint is being rewired (we draw a preview instead)
            const beingDragged = pointerDrag && pointerDrag.kind === "edge" && pointerDrag.mode === "rewire" && pointerDrag.dragEdgeKey === k;
            if (beingDragged) return null;

            const backward    = isBackward(e.from, e.to);
            const isHovered   = hoveredEdge === k || (popover && popover.key === k);
            const onPath      = highlighted && highlighted.edges.has(k);
            const dim         = highlighted && !onPath && !isHovered;
            const x1 = from.right;
            const y1 = from.midY;
            const x2 = to.left - 4;
            const y2 = to.midY;
            const cx = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;

            let stroke, marker, strokeWidth, opacity;
            if (isHovered)      { stroke = "#F97316"; marker = "fm-arrow-active";   strokeWidth = 3;    opacity = 1; }
            else if (backward)  { stroke = "#F59E0B"; marker = "fm-arrow-amber";    strokeWidth = 2.25; opacity = 1; }
            else if (onPath)    { stroke = scenarioColor; marker = "fm-arrow-scenario"; strokeWidth = 2.25; opacity = 1; }
            else                { stroke = "#6B7280"; marker = "fm-arrow-default";  strokeWidth = 2;    opacity = dim ? 0.18 : 0.65; }

            return (
              <g key={k}>
                {/* Hit area */}
                <path
                  d={d} fill="none" stroke="transparent" strokeWidth={16}
                  style={{ cursor: "pointer", pointerEvents: pointerDrag ? "none" : "stroke" }}
                  onMouseEnter={() => setHoveredEdge(k)}
                  onMouseLeave={() => setHoveredEdge(null)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    const rect = containerRef.current.getBoundingClientRect();
                    setPopover({ key: k, x: ev.clientX - rect.left, y: ev.clientY - rect.top });
                  }}
                />                {/* Visible stroke */}
                <path
                  d={d} fill="none"
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  markerEnd={`url(#${marker})`}
                  pointerEvents="none"
                  style={{ transition: "stroke .2s ease, stroke-width .15s ease, stroke-opacity .15s ease" }}
                />
              </g>
            );
          })}

          {/* Live preview line during edge create / rewire */}
          {pointerDrag && pointerDrag.kind === "edge" && (() => {
            const anchor = layout.positions[pointerDrag.anchorId];
            if (!anchor) return null;
            const ax = pointerDrag.anchorIsSource ? anchor.right : anchor.left;
            const ay = anchor.midY;
            const bx = pointerDrag.x;
            const by = pointerDrag.y;
            const x1 = pointerDrag.anchorIsSource ? ax : bx;
            const y1 = pointerDrag.anchorIsSource ? ay : by;
            const x2 = pointerDrag.anchorIsSource ? bx : ax;
            const y2 = pointerDrag.anchorIsSource ? by : ay;
            const mx = (x1 + x2) / 2;
            const d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
            const color = pointerDrag.invalid ? "#EF4444" : "#F97316";
            return (
              <g pointerEvents="none">
                <path d={d} fill="none" stroke={color} strokeWidth={2.25} strokeDasharray="4 4" strokeLinecap="round" opacity="0.95"/>
                {/* Marker-less head triangle at cursor end */}
                <circle cx={x2} cy={y2} r={4} fill={color}/>
              </g>
            );
          })()}
        </svg>

        {/* Midpoint "+" insert buttons — rendered only for the hovered edge (suppressed during any drag) */}
        {!pointerDrag && edges.map(e => {
          const from = layout.positions[e.from];
          const to   = layout.positions[e.to];
          if (!from || !to) return null;
          const k = edgeKey(e);
          const show = hoveredEdge === k || (popover && popover.key === k);
          if (!show) return null;
          const cx = (from.right + to.left) / 2;
          const cy = (from.midY + to.midY) / 2;
          return (
            <button
              key={k + "-ins"}
              title="Insert signal here"
              onClick={(ev) => { ev.stopPropagation(); insertBetween(e); }}
              onMouseEnter={() => setHoveredEdge(k)}
              onMouseLeave={() => setHoveredEdge(null)}
              style={{
                position: "absolute",
                left: cx - 11, top: cy - 11,
                width: 22, height: 22, borderRadius: 999,
                border: "1.5px solid #F97316",
                background: "#fff",
                color: "#F97316",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: 0,
                fontSize: 15, fontWeight: 600, lineHeight: 1,
                boxShadow: "0 2px 8px rgba(249,115,22,0.28)",
                zIndex: 12,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          );
        })}

        {/* Arrow endpoint handles — shown for the hovered edge so the user can grab + rewire */}
        {!pointerDrag && edges.map(e => {
          const from = layout.positions[e.from];
          const to   = layout.positions[e.to];
          if (!from || !to) return null;
          const k = edgeKey(e);
          const show = hoveredEdge === k || (popover && popover.key === k);
          if (!show) return null;
          return (
            <React.Fragment key={k + "-handles"}>
              <EndpointHandle
                cx={from.right} cy={from.midY}
                onPointerDown={startEdgeRewire(k, "from")}
                title="Drag to change source"
              />
              <EndpointHandle
                cx={to.left - 4} cy={to.midY}
                onPointerDown={startEdgeRewire(k, "to")}
                title="Drag to change target"
              />
            </React.Fragment>
          );
        })}

        {/* Phase columns */}
        {data.phases.map(phase => {
          const items = nodesByPhase[phase.id] || [];
          const cardDragging = pointerDrag && pointerDrag.kind === "card";
          const showPlaceholderAt = cardDragging && pointerDrag.overPhase === phase.id ? pointerDrag.overIndex : -1;
          const isActiveColumn   = cardDragging && pointerDrag.overPhase === phase.id;
          return (
            <div
              key={phase.id}
              ref={(el) => { columnRefs.current[phase.id] = el; }}
              style={{
                display: "flex", flexDirection: "column", gap: ROW_GAP,
                position: "relative", zIndex: 2,
                minHeight: 200,
                padding: isActiveColumn ? 6 : 0,
                margin: isActiveColumn ? -6 : 0,
                borderRadius: 12,
                background: isActiveColumn ? "#FFF7ED" : "transparent",
                border: isActiveColumn ? "2px dashed #F97316" : "2px dashed transparent",
                transition: "background .12s ease, border-color .12s ease",
              }}
            >
              {items.map((node, idx) => {
                const isSelected = selected === node.id;
                const inPath = highlighted ? highlighted.nodes.has(node.id) : false;
                const dim = highlighted && !inPath;
                const isDragging = cardDragging && pointerDrag.id === node.id && pointerDrag.moved;
                const isEdgeDropTarget = pointerDrag && pointerDrag.kind === "edge" && pointerDrag.overId === node.id && !pointerDrag.invalid;
                return (
                  <React.Fragment key={node.id}>
                    {showPlaceholderAt === idx && pointerDrag.id !== node.id && (
                      <SignalCardPlaceholder/>
                    )}
                    <div data-card-slot ref={el => cardRefs.current[node.id] = el}>
                      <SignalCard
                        node={node}
                        selected={isSelected}
                        dim={dim}
                        dragging={isDragging}
                        isDropTarget={isEdgeDropTarget}
                        onEdit={() => setSelected(node.id)}
                        onCardPointerDown={startCardDrag(node.id)}
                        onConnectorPointerDown={startCreateArrow(node.id)}
                        accentColor={scenarioColor}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
              {showPlaceholderAt >= items.length && cardDragging && pointerDrag.id && (
                <SignalCardPlaceholder/>
              )}

              {/* Add slot at column tail */}
              <button
                style={{
                  border: "1.5px dashed #E5E7EB", borderRadius: 10, padding: 10,
                  background: "transparent", color: "#9CA3AF", cursor: "pointer", fontSize: 12,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  width: CARD_W,
                  transition: "border .12s ease, color .12s ease, background .12s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#FED7AA"; e.currentTarget.style.color = "#C2410C"; e.currentTarget.style.background = "#FFF7ED"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.color = "#9CA3AF"; e.currentTarget.style.background = "transparent"; }}
              >
                <Icons.Plus size={12}/> Add signal
              </button>
            </div>
          );
        })}

        {/* Dragging card ghost — follows the cursor, only after threshold */}
        {pointerDrag && pointerDrag.kind === "card" && pointerDrag.moved && (() => {
          const node = nodes.find(n => n.id === pointerDrag.id);
          if (!node) return null;
          return (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: pointerDrag.x - pointerDrag.offsetX,
                top:  pointerDrag.y - pointerDrag.offsetY,
                width: pointerDrag.w,
                pointerEvents: "none",
                transform: "rotate(2deg) scale(1.05)",
                opacity: 0.95,
                filter: "drop-shadow(0 18px 36px rgba(15,23,42,0.18)) drop-shadow(0 4px 10px rgba(15,23,42,0.12))",
                zIndex: 60,
              }}
            >
              <SignalCard
                node={node}
                accentColor={scenarioColor}
              />
            </div>
          );
        })()}

        {/* Invalid-drop cursor cue during edge drag */}
        {pointerDrag && pointerDrag.kind === "edge" && pointerDrag.invalid && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: pointerDrag.x - 11,
              top:  pointerDrag.y - 11,
              width: 22, height: 22, borderRadius: 999,
              border: "2px solid #EF4444",
              background: "rgba(255,255,255,0.95)",
              pointerEvents: "none",
              zIndex: 61,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#EF4444",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="9"/>
              <line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/>
            </svg>
          </div>
        )}

        {/* Onboarding tooltip — anchored to the first-added card */}
        {tooltipFor && layout.positions[tooltipFor] && (
          <OnboardingTooltip
            anchor={layout.positions[tooltipFor]}
            onDismiss={dismissTooltip}
          />
        )}

        {/* Popover */}
        {popover && (() => {
          const edge = edges.find(e => edgeKey(e) === popover.key);
          if (!edge) return null;
          return (
            <ArrowPopover
              edge={edge}
              x={popover.x}
              y={popover.y}
              containerWidth={layout.width}
              onChange={(patch) => updateEdge(popover.key, patch)}
              onRemove={() => removeEdge(popover.key)}
              onClose={() => setPopover(null)}
            />
          );
        })()}
      </div>

      {/* Footer legend */}
      <div style={{
        marginTop: 24, padding: "14px 18px", background: "#fff",
        border: "1px solid #E5E7EB", borderRadius: 12,
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>LEGEND</span>
        {Object.entries(CAT_STYLE).map(([cat, c]) => (
          <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6B7280" }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: c.dot }}/>
            {cat}
          </div>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 12, color: "#6B7280", display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width="34" height="10" viewBox="0 0 34 10"><path d="M 1 5 C 12 5, 22 5, 30 5" stroke="#F59E0B" strokeWidth="2" fill="none"/><path d="M 28 2 L 32 5 L 28 8 z" fill="#F59E0B"/></svg>
            Backward in time
          </span>
          <span style={{ color: "#D1D5DB" }}>·</span>
          <span>Grab an arrow endpoint to rewire · Drag the "+" off a card to connect</span>
        </div>
      </div>

      {/* Drag cursor + toast layer */}
      {pointerDrag && (
        <style>{`body { cursor: ${pointerDrag.kind === "edge" && pointerDrag.invalid ? "not-allowed" : "grabbing"} !important; }`}</style>
      )}
    </div>
  );
}

/* ─────────────────────────── Endpoint handle ───────────────────────── */

function EndpointHandle({ cx, cy, onPointerDown, title }) {
  return (
    <div
      title={title}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: cx - 6, top: cy - 6,
        width: 12, height: 12, borderRadius: 999,
        background: "#fff",
        border: "2px solid #F97316",
        cursor: "grab",
        zIndex: 14,
        touchAction: "none",
        boxShadow: "0 1px 3px rgba(15,23,42,0.10)",
      }}
    />
  );
}

/* ─────────────────────────── Toast ─────────────────────────── */

function StorylineToast({ toast }) {
  if (!toast) return null;
  const isError = toast.kind === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      key={toast.ts}
      style={{
        position: "fixed",
        right: 24, bottom: 24,
        padding: "8px 14px",
        borderRadius: 8,
        background: isError ? "#FEF2F2" : "#1E1B2E",
        color: isError ? "#EF4444" : "#fff",
        border: isError ? "1px solid #FECACA" : "1px solid #29243D",
        fontSize: 12, fontWeight: 500, letterSpacing: "-.005em",
        boxShadow: "0 10px 30px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.10)",
        display: "inline-flex", alignItems: "center", gap: 8,
        zIndex: 200,
        animation: "fmToastIn .18s ease-out both",
      }}
    >
      {isError ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
      {toast.msg}
    </div>
  );
}

/* ─────────────────────────── Column header ─────────────────────────── */

function ColumnHeader({ index, label, range, desc, scenarioColor, onChange }) {
  const [hover, setHover] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef(null);
  const [draft, setDraft] = React.useState(label);
  React.useEffect(() => { setDraft(label); }, [label]);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 999, background: scenarioColor, color: "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)", flexShrink: 0,
        }}>{index + 1}</span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false);
            const v = (draft || "").trim() || DEFAULT_COLUMN_LABELS[index];
            setDraft(v);
            if (v !== label) onChange(v);
          }}
          onFocus={() => setFocused(true)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { setDraft(label); e.currentTarget.blur(); } }}
          spellCheck={false}
          aria-label={`Column ${index + 1} label`}
          style={{
            flex: 1, minWidth: 0,
            border: "none", outline: "none",
            background: "transparent",
            padding: "2px 4px",
            margin: "-2px -4px",
            borderRadius: 4,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: ".6px",
            color: "#6B7280",
            textTransform: "uppercase",
            boxShadow: focused ? "inset 0 -1px 0 #F97316" : (hover ? "inset 0 -1px 0 #D1D5DB" : "none"),
            transition: "box-shadow .12s ease",
            cursor: "text",
          }}
        />
        {(hover || focused) && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, pointerEvents: "none" }}>
            <path d="M 12 20 h 9"/>
            <path d="M 16.5 3.5 a 2.121 2.121 0 0 1 3 3 L 7 19 l -4 1 1 -4 L 16.5 3.5 z"/>
          </svg>
        )}
      </div>
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#9CA3AF", paddingLeft: 32, marginBottom: 2 }}>{range}</div>
      <div style={{ fontSize: 12.5, color: "#6B7280", paddingLeft: 32, lineHeight: 1.45 }}>{desc}</div>
    </div>
  );
}

/* ─────────────────────────── Arrow popover ─────────────────────────── */

function ArrowPopover({ edge, x, y, containerWidth, onChange, onRemove, onClose }) {
  const ref = React.useRef(null);
  const POP_W = 260;

  React.useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    // Defer one tick so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => { clearTimeout(t); window.removeEventListener("mousedown", onDown); };
  }, [onClose]);

  // Clamp horizontally so the popover stays inside the canvas
  const left = Math.max(8, Math.min((containerWidth || 1700) - POP_W - 8, x - POP_W / 2));
  const top  = y + 14;

  return (
    <div
      ref={ref}
      className="slide-up"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left, top,
        width: POP_W,
        background: "#fff",
        border: "1px solid #E5E7EB",
        borderRadius: 12,
        boxShadow: "0 10px 30px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.06)",
        padding: 14,
        zIndex: 40,
      }}
    >
      {/* Pointer notch */}
      <div style={{
        position: "absolute", left: Math.min(POP_W - 24, Math.max(12, x - left - 6)), top: -7,
        width: 12, height: 12,
        background: "#fff", borderTop: "1px solid #E5E7EB", borderLeft: "1px solid #E5E7EB",
        transform: "rotate(45deg)",
      }}/>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".08em", color: "#9CA3AF", textTransform: "uppercase", fontWeight: 600 }}>
          Connection
        </span>
        <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", color: "#9CA3AF", cursor: "pointer", padding: 2, display: "flex", borderRadius: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>
      </div>

      {/* Relationship dropdown */}
      <label style={{ display: "block", fontSize: 11, color: "#6B7280", marginBottom: 5, fontWeight: 500 }}>Relationship</label>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <select
          value={edge.relationship || "Leads to"}
          onChange={(e) => onChange({ relationship: e.target.value })}
          style={{
            width: "100%",
            appearance: "none",
            WebkitAppearance: "none",
            padding: "8px 30px 8px 11px",
            fontSize: 13, color: "#1E1B2E",
            border: "1px solid #E5E7EB", borderRadius: 8,
            background: "#fff",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
          style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {/* Confidence segmented */}
      <label style={{ display: "block", fontSize: 11, color: "#6B7280", marginBottom: 5, fontWeight: 500 }}>Confidence</label>
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        padding: 2,
        background: "#F3F4F6", borderRadius: 8,
        marginBottom: 12,
      }}>
        {CONFIDENCES.map(c => {
          const active = (edge.confidence || "Moderate") === c;
          return (
            <button
              key={c}
              onClick={() => onChange({ confidence: c })}
              style={{
                padding: "6px 8px",
                border: "none",
                borderRadius: 6,
                background: active ? "#fff" : "transparent",
                boxShadow: active ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                color: active ? "#1E1B2E" : "#6B7280",
                fontWeight: active ? 600 : 500,
                fontSize: 12,
                cursor: "pointer",
                transition: "background .12s ease, color .12s ease",
              }}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>{edge.from} → {edge.to}</span>
        <button
          onClick={onRemove}
          style={{
            border: "none", background: "transparent",
            color: "#EF4444", fontSize: 12, fontWeight: 500,
            cursor: "pointer", padding: "4px 2px",
            display: "inline-flex", alignItems: "center", gap: 5,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M 19 6 l -1 14 a 2 2 0 0 1 -2 2 H 8 a 2 2 0 0 1 -2 -2 L 5 6"/><path d="M 10 11 v 6"/><path d="M 14 11 v 6"/>
          </svg>
          Remove connection
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────── Empty state ─────────────────────────── */

function StorylineEmptyState({ onAutoSuggest, onBrowseLibrary }) {
  return (
    <div style={{
      minHeight: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "60px 24px",
    }}>
      <div style={{
        maxWidth: 480, width: "100%",
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center",
      }} className="slide-up">
        <EmptyChainIllustration/>
        <h3 style={{
          margin: "26px 0 10px",
          fontSize: 24, fontWeight: 600,
          color: "#1E1B2E", letterSpacing: "-0.01em",
          textWrap: "balance",
        }}>
          Build your scenario storyline
        </h3>
        <p style={{
          margin: 0, maxWidth: 420,
          fontSize: 14, color: "#6B7280", lineHeight: 1.55,
          textWrap: "pretty",
        }}>
          Drag signals from your library to show how this future unfolds. Connect them with arrows to map cause and effect.
        </p>
        <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            onClick={onBrowseLibrary}
            style={{
              padding: "10px 16px",
              border: "none", borderRadius: 8,
              background: "#F97316", color: "#fff",
              fontSize: 13.5, fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8,
              transition: "background .12s ease, transform .12s ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#EA6B0B"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#F97316"}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
            </svg>
            Browse Signals Library
          </button>
          <button
            onClick={onAutoSuggest}
            style={{
              padding: "10px 16px",
              border: "1px solid #E5E7EB", borderRadius: 8,
              background: "#fff", color: "#1E1B2E",
              fontSize: 13.5, fontWeight: 500,
              cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 8,
              transition: "border .12s ease, background .12s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#D1D5DB"; e.currentTarget.style.background = "#FAFAFA"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#fff"; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 z"/>
              <path d="M19 17 L19.8 19.2 L22 20 L19.8 20.8 L19 23 L18.2 20.8 L16 20 L18.2 19.2 z"/>
            </svg>
            Auto-suggest chain from AI
          </button>
        </div>

        <div style={{
          marginTop: 28,
          fontSize: 11.5, color: "#9CA3AF",
          fontFamily: "var(--font-mono)", letterSpacing: ".04em",
        }}>
          Tip · You can also paste a list of events to chain them automatically.
        </div>
      </div>
    </div>
  );
}

function EmptyChainIllustration() {
  // Three connected dots forming a curved chain. Stroke #F97316, fill #FFF7ED.
  return (
    <svg width="220" height="120" viewBox="0 0 220 120" fill="none" aria-hidden>
      <defs>
        <filter id="emptyShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dy="2" result="off"/>
          <feComponentTransfer><feFuncA type="linear" slope="0.18"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Soft backdrop ring */}
      <circle cx="110" cy="62" r="58" stroke="#FFF7ED" strokeWidth="1.5" fill="none"/>
      <circle cx="110" cy="62" r="40" stroke="#FED7AA" strokeWidth="1" strokeDasharray="2 4" fill="none" opacity="0.7"/>

      {/* Curved chain path */}
      <path
        d="M 36 78 C 60 30, 95 30, 110 60 C 125 90, 160 90, 184 42"
        stroke="#F97316" strokeWidth="2" fill="none" strokeLinecap="round"
        strokeDasharray="0"
        filter="url(#emptyShadow)"
      />

      {/* Arrowhead at end */}
      <path
        d="M 180 38 L 189 40 L 184 47 Z"
        fill="#F97316"
      />

      {/* Three dots */}
      <g filter="url(#emptyShadow)">
        <circle cx="36" cy="78" r="11" fill="#FFF7ED" stroke="#F97316" strokeWidth="2"/>
        <circle cx="110" cy="60" r="13" fill="#FFF7ED" stroke="#F97316" strokeWidth="2"/>
        <circle cx="184" cy="42" r="11" fill="#FFF7ED" stroke="#F97316" strokeWidth="2"/>
      </g>

      {/* Inner dot glyphs */}
      <circle cx="36"  cy="78" r="3" fill="#F97316"/>
      <circle cx="110" cy="60" r="3.5" fill="#F97316"/>
      <circle cx="184" cy="42" r="3" fill="#F97316"/>
    </svg>
  );
}

/* ───────────────────────── Onboarding tooltip ───────────────────────── */

function OnboardingTooltip({ anchor, onDismiss }) {
  // anchor: { left, right, top, bottom, midY } in canvas-local coords.
  // We point a small triangle at the LEFT edge of the tooltip toward the card's
  // right edge, and place the tooltip just past it.
  const TIP_W = 240;
  const offsetX = anchor.right + 14;
  const offsetY = anchor.top - 6;
  return (
    <div
      role="dialog"
      className="slide-up"
      style={{
        position: "absolute",
        left: offsetX,
        top: offsetY,
        width: TIP_W,
        background: "#1E1B2E",
        color: "#fff",
        borderRadius: 10,
        padding: 12,
        fontSize: 12,
        lineHeight: 1.5,
        boxShadow: "0 10px 30px rgba(15,23,42,0.18), 0 2px 8px rgba(15,23,42,0.10)",
        zIndex: 30,
      }}
    >
      {/* Pointer triangle on the left side */}
      <span aria-hidden style={{
        position: "absolute",
        left: -6, top: 18,
        width: 12, height: 12,
        background: "#1E1B2E",
        transform: "rotate(45deg)",
        borderRadius: 2,
      }}/>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <div style={{
          flexShrink: 0,
          width: 22, height: 22, borderRadius: 6,
          background: "rgba(249,115,22,0.18)",
          color: "#FDBA74",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 14 }}>
          <div style={{ fontWeight: 600, color: "#fff", marginBottom: 2, fontSize: 12.5 }}>Connect this signal</div>
          <div style={{ color: "#D1D5DB" }}>
            Drag from the right edge to connect this signal to another. Build the causal chain that leads to your scenario.
          </div>
        </div>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss tooltip"
        style={{
          position: "absolute", top: 6, right: 6,
          width: 22, height: 22, borderRadius: 5,
          border: "none", background: "transparent", color: "#9CA3AF",
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9CA3AF"; }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/>
        </svg>
      </button>
    </div>
  );
}

window.PageStoryline = PageStoryline;
