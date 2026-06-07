// Strategy Options
function PageStrategy({ navigate }) {
  const store = window.FM.useStore();
  const strategies = store.strategies;
  const scenarios = store.scenarios;
  const [selected, setSelected] = React.useState(null);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }} className="scroll-y">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Strategic Options</h2>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>How robust is each option across your scenarios?</div>
          </div>
          <button className="btn btn-primary btn-sm">
            <Icons.Sparkle size={12}/> Generate options
          </button>
        </div>

        {/* Matrix-style robustness grid */}
        <div style={{
          border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(260px, 2fr) repeat(4, 1fr) 100px 90px",
            background: "#F9FAFB", borderBottom: "1px solid #E5E7EB",
            padding: "10px 14px", fontSize: 11, fontFamily: "var(--font-mono)",
            fontWeight: 500, color: "#6B7280", letterSpacing: ".04em", textTransform: "uppercase",
          }}>
            <div>OPTION</div>
            {scenarios.map(s => (
              <div key={s.id} style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color }}/>
                <span style={{ fontSize: 10, lineHeight: 1.1 }}>{s.name.split(" ").map((w, i) => <div key={i}>{w}</div>)}</span>
              </div>
            ))}
            <div style={{ textAlign: "center" }}>RISK</div>
            <div style={{ textAlign: "center" }}>COST</div>
          </div>

          {strategies.map((st, i) => (
            <div
              key={st.id}
              onClick={() => setSelected(st)}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(260px, 2fr) repeat(4, 1fr) 100px 90px",
                padding: "14px 14px",
                borderBottom: i < strategies.length - 1 ? "1px solid #F3F4F6" : "none",
                cursor: "pointer",
                alignItems: "center",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#FAFAFA"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1E1B2E" }}>{st.name}</div>
                <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, lineHeight: 1.45 }}>{st.notes}</div>
              </div>
              {scenarios.map(s => {
                const robust = st.robustIn.includes(s.name);
                return (
                  <div key={s.id} style={{ display: "flex", justifyContent: "center" }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 999,
                      background: robust ? "#ECFDF5" : "#FEF2F2",
                      color: robust ? "#10B981" : "#EF4444",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, fontWeight: 600,
                    }}>{robust ? "✓" : "·"}</span>
                  </div>
                );
              })}
              <div style={{ textAlign: "center" }}>
                <span className={"badge " + (st.risk === "Low" ? "badge-low" : st.risk === "Medium" ? "badge-mid" : "badge-high")}>{st.risk}</span>
              </div>
              <div style={{ textAlign: "center", fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{st.cost}</div>
            </div>
          ))}
        </div>

        {/* AI recommendation */}
        <div style={{
          marginTop: 16, padding: 16,
          background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Icons.Sparkle size={14} stroke="#F97316"/>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#C2410C", letterSpacing: ".06em", textTransform: "uppercase" }}>AI Recommendation</span>
          </div>
          <div style={{ fontSize: 14, color: "#1E1B2E", lineHeight: 1.6 }}>
            <strong>Federated regional architecture</strong> is robust across 2 scenarios with low risk. Combine with <strong>JV-first market entry</strong> to cover all 4 futures. This pairing minimises downside in Bamboo Curtain while capturing 80% of Pacific Connector upside.
          </div>
        </div>
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} className="card slide-up" style={{ maxWidth: 540, width: "100%", padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>STRATEGIC OPTION</div>
              <button onClick={() => setSelected(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6B7280" }}>
                <Icons.X size={16}/>
              </button>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>{selected.name}</h3>
            <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.55, margin: "0 0 18px" }}>{selected.notes}</p>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em", marginBottom: 8 }}>ROBUST IN</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {selected.robustIn.map(name => (
                  <span key={name} className="chip" style={{ background: "#ECFDF5", color: "#065F46", borderColor: "rgba(16,185,129,0.25)" }}>✓ {name}</span>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>RISK</div>
                <div style={{ marginTop: 6 }}><span className={"badge " + (selected.risk === "Low" ? "badge-low" : selected.risk === "Medium" ? "badge-mid" : "badge-high")}>{selected.risk}</span></div>
              </div>
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>COST</div>
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 600 }}>{selected.cost}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }}>Mark as primary</button>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.PageStrategy = PageStrategy;
