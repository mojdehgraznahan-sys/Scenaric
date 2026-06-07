// Home page (formerly "AI Analyst")
// Chat moved to floating Ask AI panel.
function PageDashboard({ navigate }) {
  const store = window.FM.useStore();
  const { seed } = store;

  const launchAskAI = (q) => {
    // Open Ask AI with this question pre-loaded
    window.dispatchEvent(new CustomEvent("fm:ask", { detail: q }));
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }} className="scroll-y">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* Welcome header */}
        <div style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>WELCOME BACK, JOHN</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
            APAC Expansion 2030
          </h1>
          <div style={{ color: "#6B7280", fontSize: 14 }}>
            5–10 year horizon · Technology · Last updated 2h ago
          </div>
        </div>

        {/* Progress strip */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Methodology progress</div>
              <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>4 of 9 steps complete — keep going</div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", color: "#F97316", letterSpacing: "-0.02em" }}>
              44<span style={{ color: "#9CA3AF" }}>%</span>
            </div>
          </div>
          <div className="progress-track" style={{ marginBottom: 16 }}>
            <div className="progress-fill" style={{ width: "44%" }}/>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 6 }}>
            {[
              { label: "Focal question", done: true, route: "/app/settings" },
              { label: "Key forces", done: true, route: "/app/knowledge" },
              { label: "Driving forces", done: true, route: "/app/signals" },
              { label: "Rank forces", done: true, route: "/app/matrix" },
              { label: "Scenario logics", done: false, route: "/app/canvas" },
              { label: "Narratives", done: false, route: "/app/narrative" },
              { label: "Implications", done: false, route: "/app/narrative" },
              { label: "Indicators", done: false, route: "/app/monitoring" },
              { label: "Strategy", done: false, route: "/app/strategy" },
            ].map((step, i) => (
              <button
                key={i}
                onClick={() => navigate(step.route)}
                style={{
                  border: "1px solid " + (step.done ? "#FED7AA" : "#E5E7EB"),
                  background: step.done ? "#FFF7ED" : "#fff",
                  padding: "8px 6px", borderRadius: 8,
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  cursor: "pointer", transition: "border .12s ease, background .12s ease",
                }}
                onMouseEnter={e => { if (!step.done) e.currentTarget.style.borderColor = "#D1D5DB"; }}
                onMouseLeave={e => { if (!step.done) e.currentTarget.style.borderColor = "#E5E7EB"; }}
              >
                <span style={{
                  width: 20, height: 20, borderRadius: 999,
                  background: step.done ? "#F97316" : "#F3F4F6",
                  color: step.done ? "#fff" : "#9CA3AF",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 600, fontFamily: "var(--font-mono)",
                }}>{step.done ? "✓" : i + 1}</span>
                <span style={{ fontSize: 10.5, color: step.done ? "#C2410C" : "#6B7280", fontWeight: 500, textAlign: "center", lineHeight: 1.2 }}>{step.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Three KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Signals tracked", value: 23, sub: "+3 this week", tone: "#F97316", route: "/app/signals" },
            { label: "Scenarios drafted", value: 4, sub: "Ready for narratives", tone: "#3B82F6", route: "/app/canvas" },
            { label: "Indicators live", value: 6, sub: "2 in alert", tone: "#EF4444", route: "/app/monitoring" },
            { label: "Strategic options", value: 4, sub: "1 robust across futures", tone: "#10B981", route: "/app/strategy" },
          ].map(k => (
            <button key={k.label}
              onClick={() => navigate(k.route)}
              className="card"
              style={{ padding: 16, textAlign: "left", cursor: "pointer", border: "1px solid #E5E7EB", background: "#fff" }}
            >
              <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>{k.label}</div>
              <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em", color: k.tone, marginTop: 4 }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: "#6B7280", marginTop: 2 }}>{k.sub}</div>
            </button>
          ))}
        </div>

        {/* AI Recommended Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Icons.Sparkle size={14} stroke="#F97316"/>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#C2410C", letterSpacing: ".06em", textTransform: "uppercase" }}>Recommended next</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Build the impact × uncertainty matrix</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14, lineHeight: 1.55 }}>
              You have 23 signals ranked. Plot the top by impact and uncertainty to find your scenario axes.
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/app/matrix")}>
              Open matrix <Icons.ArrowRight size={12}/>
            </button>
          </div>
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Icons.Eye size={14} stroke="#10B981"/>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#065F46", letterSpacing: ".06em", textTransform: "uppercase" }}>Monitor</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Track 6 leading indicators</div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14, lineHeight: 1.55 }}>
              Regulatory rulings and AI capex thresholds will tell you which scenario is unfolding.
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate("/app/monitoring")}>
              Open monitoring <Icons.ArrowRight size={12}/>
            </button>
          </div>
        </div>

        {/* News feed */}
        <div className="card">
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icons.Radio size={14} stroke="#1E1B2E"/>
              <span style={{ fontWeight: 600, fontSize: 14 }}>News Feed</span>
              <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>· 5 unread</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost btn-sm"><Icons.Filter size={12}/> Filter</button>
              <button className="btn btn-ghost btn-sm">View all</button>
            </div>
          </div>
          {seed.news.map((n, i) => (
            <div key={n.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "12px 18px",
              borderBottom: i < seed.news.length - 1 ? "1px solid #F3F4F6" : "none",
              cursor: "pointer",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: "#1E1B2E", marginBottom: 2 }}>{n.title}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>{n.source.toUpperCase()} · {n.time}</div>
              </div>
              <span className={"badge " + (n.impact === "HIGH" ? "badge-high" : "badge-mid")}>{n.impact}</span>
              <button className="btn btn-ghost btn-sm" style={{ color: "#F97316", border: "none", padding: "4px 8px" }} onClick={() => navigate("/app/signals")}>
                + Add to Signals
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.PageDashboard = PageDashboard;
