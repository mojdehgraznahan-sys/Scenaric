// Home page (formerly "AI Analyst")
// Chat moved to floating Ask AI panel.
function PageDashboard({ navigate }) {
  const store = window.FM.useStore();
  const { seed } = store;
  const project = store.project;
  const activeProject = (store.projects || []).find(p => p.id === store.activeProjectId);
  const stepsComplete = Math.max(0, Math.min(8, (activeProject && activeProject.stepsComplete) || 0));

  const launchAskAI = (q) => {
    // Open Ask AI with this question pre-loaded
    window.dispatchEvent(new CustomEvent("fm:ask", { detail: q }));
  };

  // Map each of the 9 tracker tiles to the canonical 8-step count used by
  // the Projects dashboard (Key forces + Driving forces both complete once
  // step 2, "Driving forces," is reached).
  const stepGate = [1, 2, 2, 3, 4, 5, 6, 7, 8];
  const tiles = [
    { label: "Focal question", route: "/app/settings" },
    { label: "Key forces", route: "/app/knowledge" },
    { label: "Driving forces", route: "/app/signals" },
    { label: "Rank forces", route: "/app/matrix" },
    { label: "Scenario logics", route: "/app/canvas" },
    { label: "Narratives", route: "/app/narrative" },
    { label: "Implications", route: "/app/narrative" },
    { label: "Indicators", route: "/app/monitoring" },
    { label: "Strategy", route: "/app/strategy" },
  ].map((t, i) => ({ ...t, done: stepsComplete >= stepGate[i] }));
  const tilesDone = tiles.filter(t => t.done).length;
  const pct = Math.round((tilesDone / tiles.length) * 100);

  const lastEditedLabel = (() => {
    if (!activeProject || !activeProject.lastEdited) return "just now";
    const now = new Date("2026-07-07T12:00:00Z");
    const diffH = Math.round((now - new Date(activeProject.lastEdited)) / 3600000);
    if (diffH < 1) return "just now";
    if (diffH < 24) return diffH + "h ago";
    return Math.round(diffH / 24) + "d ago";
  })();

  // KPI values gate to zero for a project that hasn't reached that step yet —
  // avoids showing another project's stale counts on a brand-new project.
  const kpis = [
    { label: "Signals tracked",    value: stepsComplete >= 2 ? seed.stats.signals : 0,       sub: stepsComplete >= 2 ? "+3 this week" : "Add your first signal",           tone: "#F97316", route: "/app/signals" },
    { label: "Scenarios drafted",  value: stepsComplete >= 4 ? seed.stats.scenarios : 0,      sub: stepsComplete >= 4 ? "Ready for narratives" : "Build your matrix first",  tone: "#3B82F6", route: "/app/canvas" },
    { label: "Indicators live",    value: stepsComplete >= 7 ? seed.stats.indicators : 0,     sub: stepsComplete >= 7 ? "2 in alert" : "Not set up yet",                     tone: "#EF4444", route: "/app/monitoring" },
    { label: "Strategic options",  value: stepsComplete >= 8 ? (store.strategies || []).length : 0, sub: stepsComplete >= 8 ? "1 robust across futures" : "Not started",  tone: "#10B981", route: "/app/strategy" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24 }} className="scroll-y">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>

        {/* Welcome header */}
        <div style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>WELCOME BACK, {((store.user && store.user.name) || "JOHN").split(" ")[0].toUpperCase()}</div>
          <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
            {project.name}
          </h1>
          <div style={{ color: "#6B7280", fontSize: 14 }}>
            {[project.horizon ? project.horizon + " horizon" : null, project.industry || null, "Last updated " + lastEditedLabel].filter(Boolean).join(" · ")}
          </div>
        </div>

        {/* Progress strip */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Methodology progress</div>
              <div style={{ fontSize: 12.5, color: "#6B7280", marginTop: 2 }}>
                {tilesDone === 0 ? "Not started yet — let's begin" : `${tilesDone} of ${tiles.length} steps complete — keep going`}
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "var(--font-mono)", color: "#F97316", letterSpacing: "-0.02em" }}>
              {pct}<span style={{ color: "#9CA3AF" }}>%</span>
            </div>
          </div>
          <div className="progress-track" style={{ marginBottom: 16 }}>
            <div className="progress-fill" style={{ width: pct + "%" }}/>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 1fr)", gap: 6 }}>
            {tiles.map((step, i) => (
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
          {kpis.map(k => (
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
              {kpis[0].value > 0
                ? `You have ${kpis[0].value} signals ranked. Plot the top by impact and uncertainty to find your scenario axes.`
                : "Add and rank a few signals first, then plot them here to find your scenario axes."}
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
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
              {kpis[2].value > 0 ? `Track ${kpis[2].value} leading indicators` : "Set up leading indicators"}
            </div>
            <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14, lineHeight: 1.55 }}>
              {kpis[2].value > 0
                ? "Regulatory rulings and AI capex thresholds will tell you which scenario is unfolding."
                : "Once your scenarios are built, define the signposts that tell you which future is unfolding."}
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
