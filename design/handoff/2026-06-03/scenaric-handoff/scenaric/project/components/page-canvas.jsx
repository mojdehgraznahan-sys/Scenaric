// Scenario Canvas - 2x2 with the 4 named scenarios
function PageCanvas({ navigate }) {
  const store = window.FM.useStore();
  const { seed } = store;
  const scenarios = store.scenarios;
  const [hovered, setHovered] = React.useState(null);
  const [reaxisOpen, setReaxisOpen] = React.useState(false);

  const REAX_BADGE_MS = 7 * 24 * 60 * 60 * 1000;
  const isRecentlyReaxed = (s) => s.reaxedAt && (Date.now() - s.reaxedAt) < REAX_BADGE_MS;
  const fmtReaxDate = (ts) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // Quadrant placement by the scenario's own quadrant field; archived ones drop out of the grid.
  const active = scenarios.filter(s => !s.archived);
  const byQuad = (q) => active.find(s => s.quadrant === q);
  const map = {
    TL: byQuad("TL") || active[2], TR: byQuad("TR") || active[0],
    BL: byQuad("BL") || active[3], BR: byQuad("BR") || active[1],
  };
  const archived = scenarios.filter(s => s.archived);

  // Route into the Storyline view with this scenario pre-selected. The
  // Storyline page reads its active scenario from this persistent key.
  const openStoryline = (s) => {
    try { localStorage.setItem("fm.storylineScenario", JSON.stringify(s.id)); } catch {}
    navigate("/app/storyline");
  };

  const ScenarioCard = ({ s, pos }) => {
    if (!s) {
      return (
        <div style={{
          borderRadius: 14, padding: 18, minHeight: 150,
          border: "1.5px dashed #E5E7EB", background: "#FAFAFA",
          display: "flex", flexDirection: "column", gap: 6, justifyContent: "center", alignItems: "flex-start",
        }}>
          <span style={{ padding: "3px 9px", borderRadius: 999, background: "#E5E7EB", color: "#6B7280", fontSize: 10, fontWeight: 600, letterSpacing: ".06em" }}>{pos}</span>
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>No scenario in this quadrant yet.</div>
        </div>
      );
    }
    return (
    <div
      onMouseEnter={() => setHovered(s.id)}
      onMouseLeave={() => setHovered(null)}
      onClick={() => openStoryline(s)}
      style={{
        position: "relative", borderRadius: 14, padding: 18,
        background: "#fff", border: `2px solid ${s.color}30`,
        cursor: "pointer", transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
        transform: hovered === s.id ? "scale(1.01) translateY(-2px)" : "none",
        boxShadow: hovered === s.id ? "0 10px 26px rgba(15,23,42,0.10)" : "none",
        borderColor: hovered === s.id ? s.color : `${s.color}40`,
        display: "flex", flexDirection: "column", gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          padding: "3px 9px", borderRadius: 999, background: s.color, color: "#fff",
          fontSize: 10, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase",
        }}>{pos}</span>
        <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>
          {scenarios.indexOf(s) + 1}/4
        </span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.015em", color: "#1E1B2E", display: "flex", alignItems: "center", gap: 8 }}>
        {s.name}
        {isRecentlyReaxed(s) && (
          <span style={{ padding: "1px 7px", borderRadius: 999, background: "#FFF7ED", color: "#F97316", fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: ".03em", whiteSpace: "nowrap" }}>
            Re-axed {fmtReaxDate(s.reaxedAt)}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: s.color, fontWeight: 500 }}>{s.tagline}</div>
      <div style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>{s.summary}</div>

      {/* Primary + secondary actions */}
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4, paddingTop: 4 }}>
        <button
          onClick={(e) => { e.stopPropagation(); openStoryline(s); }}
          style={{
            border: "none", background: "transparent", color: s.color,
            fontSize: 12, fontWeight: 500, cursor: "pointer", padding: 0,
            textDecoration: hovered === s.id ? "underline" : "none",
          }}
        >
          Open storyline →
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); navigate("/app/narrative"); }}
          style={{
            border: "none", background: "transparent", color: "#6B7280",
            fontSize: 12, fontWeight: 400, cursor: "pointer", padding: 0,
            transition: "color .12s ease",
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#1E1B2E"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#6B7280"}
        >
          View narrative
        </button>
      </div>
    </div>
  );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }} className="scroll-y">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Scenario Canvas</h2>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>Four coherent futures from your two critical uncertainties.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setReaxisOpen(true)}><Icons.Refresh size={12}/> Re-axis</button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/app/narrative")}>
              Develop narratives <Icons.ArrowRight size={12}/>
            </button>
          </div>
        </div>

        {/* Axis labels */}
        <div style={{ position: "relative", padding: "32px 56px" }}>
          {/* Top axis label */}
          <div style={{ position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)", fontSize: 11, color: "#1E1B2E", fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: ".04em" }}>
            ↑ GEOPOLITICAL ALIGNMENT
          </div>
          {/* Bottom axis label */}
          <div style={{ position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)", fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".04em" }}>
            FRAGMENTATION ↓
          </div>
          {/* Left axis label */}
          <div style={{
            position: "absolute", left: 4, top: "50%", transform: "translateY(-50%) rotate(-90deg)",
            transformOrigin: "left center",
            fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".04em",
          }}>
            CLOSED MARKETS ←
          </div>
          <div style={{
            position: "absolute", right: 4, top: "50%", transform: "translateY(-50%) rotate(90deg)",
            transformOrigin: "right center",
            fontSize: 11, color: "#1E1B2E", fontFamily: "var(--font-mono)", fontWeight: 500, letterSpacing: ".04em",
          }}>
            → OPEN MARKETS
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, position: "relative" }}>
            <ScenarioCard s={map.TL} pos="TL"/>
            <ScenarioCard s={map.TR} pos="TR"/>
            <ScenarioCard s={map.BL} pos="BL"/>
            <ScenarioCard s={map.BR} pos="BR"/>
          </div>
        </div>

        {/* AI nudge */}
        <div style={{
          marginTop: 16, padding: 14,
          background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12,
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <Icons.Sparkle size={16} stroke="#F97316"/>
          <div style={{ flex: 1, fontSize: 13, color: "#C2410C" }}>
            <strong>Pacific Connector</strong> is your most optimistic scenario. Test your strategy against the others first — Bamboo Curtain has the highest downside risk.
          </div>
          <button className="btn btn-soft btn-sm">Stress test</button>
        </div>
      </div>

      {/* Past scenarios (archived via re-axis) */}
      {archived.length > 0 && (
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".06em", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 10, fontWeight: 500 }}>Past scenarios</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {archived.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", border: "1px solid #F3F4F6", borderRadius: 8, background: "#FAFAFA" }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0, opacity: 0.6 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.tagline}</div>
                </div>
                <button
                  onClick={() => store.setScenarios(store.scenarios.map(x => x.id === s.id ? { ...x, archived: false } : x))}
                  style={{ border: "none", background: "transparent", color: "#F97316", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}
                >Restore</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Re-axis migration modal */}
      <window.ReAxisModal open={reaxisOpen} onClose={() => setReaxisOpen(false)} navigate={navigate}/>
    </div>
  );
}

window.PageCanvas = PageCanvas;
