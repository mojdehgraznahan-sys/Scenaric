// Scenario Narratives — full reading view
function PageNarrative({ navigate }) {
  const store = window.FM.useStore();
  const scenarios = store.scenarios;
  const [active, setActive] = React.useState((scenarios[0] && scenarios[0].id) || "sc1");
  const current = scenarios.find(s => s.id === active) || scenarios[0];

  // Empty state — no scenarios built yet. Guard before any current.* access.
  if (!scenarios.length || !current) {
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: 20 }} className="scroll-y">
        <window.ScenarioContextHeader view="narrative"/>
        <div style={{
          marginTop: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          textAlign: "center", padding: "48px 24px",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: "#FFF7ED",
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
          }}>
            <Icons.Edit3 size={22} stroke="#F97316"/>
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 600, color: "#1E1B2E" }}>No scenarios yet</h3>
          <p style={{ margin: "0 0 18px", fontSize: 14, color: "#6B7280", maxWidth: 360, lineHeight: 1.5 }}>
            Build your four scenarios from the Matrix, then come back to write their narratives.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/app/matrix")}>
            <Icons.Grid size={12}/> Go to Matrix
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }} className="scroll-y">
      <window.ScenarioContextHeader view="narrative"/>
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        {/* Scenarios list */}
        <div className="card" style={{ padding: 12, alignSelf: "start" }}>
          <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em", padding: "4px 6px 8px" }}>4 SCENARIOS</div>
          {scenarios.map(s => (
            <button key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                width: "100%", textAlign: "left", padding: "10px 11px", borderRadius: 8,
                border: "none", background: active === s.id ? "#F5F5F5" : "transparent",
                marginBottom: 2, cursor: "pointer", display: "flex", flexDirection: "column", gap: 3,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: s.color }}/>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1E1B2E" }}>{s.name}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "#6B7280", paddingLeft: 17 }}>{s.tagline}</div>
            </button>
          ))}
        </div>

        {/* Narrative reading view */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 16, height: 16, borderRadius: 999, background: current.color }}/>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>Scenario · {scenarios.indexOf(current) + 1}/4</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm"><Icons.Edit3 size={12}/> Edit</button>
              <button className="btn btn-soft btn-sm"><Icons.Sparkle size={12}/> Expand with AI</button>
            </div>
          </div>

          <h1 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.025em", margin: "0 0 6px", textWrap: "balance" }}>{current.name}</h1>
          <div style={{ fontSize: 14, color: current.color, fontWeight: 500, marginBottom: 26 }}>{current.tagline}</div>

          <p style={{ fontSize: 17, color: "#374151", lineHeight: 1.6, margin: "0 0 22px", textWrap: "pretty", fontStyle: "italic" }}>
            {current.summary}
          </p>

          <div className="divider" style={{ margin: "0 0 22px" }}/>

          <p style={{ fontSize: 15, color: "#1E1B2E", lineHeight: 1.75, margin: 0, textWrap: "pretty" }}>
            {current.narrative}
          </p>

          {/* Implications */}
          <div style={{ marginTop: 32 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".08em", textTransform: "uppercase", margin: "0 0 12px" }}>Implications</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Capital allocation: shift 15-25% of growth budget to scenario-resilient bets",
                "Hiring: anchor leadership in Singapore; build local talent benches in 2 priority markets",
                "Tech stack: federated architecture with country-level data plane",
                "Partners: cultivate 1-2 strategic JV options per market as optionality",
              ].map((imp, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontSize: 14, color: "#374151", lineHeight: 1.55 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: current.color, flexShrink: 0, marginTop: 7 }}/>
                  <span style={{ flex: 1 }}>{imp}</span>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 28, display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={() => navigate("/app/strategy")}>
              See strategic options <Icons.ArrowRight size={14}/>
            </button>
            <button className="btn btn-ghost" onClick={() => navigate("/app/monitoring")}>
              Track signposts
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageNarrative = PageNarrative;
