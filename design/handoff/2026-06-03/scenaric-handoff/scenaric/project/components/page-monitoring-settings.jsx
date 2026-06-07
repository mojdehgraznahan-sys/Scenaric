// Monitoring + Settings
function PageMonitoring({ navigate }) {
  const store = window.FM.useStore();
  const indicators = store.indicators;
  const scenarios = store.scenarios;
  const [filter, setFilter] = React.useState("All");

  const statusColor = (st) =>
    st === "Alert" ? { bg: "#FEF2F2", fg: "#EF4444", dot: "#EF4444" } :
    st === "Watch" ? { bg: "#FFFBEB", fg: "#B45309", dot: "#F59E0B" } :
                     { bg: "#ECFDF5", fg: "#065F46", dot: "#10B981" };

  const filtered = filter === "All" ? indicators : indicators.filter(i => i.status === filter);

  // Sparkline (fake)
  const sparkline = (color, trend) => {
    const points = trend === "↑" ? [10,12,9,15,13,18,22] :
                   trend === "→" ? [12,13,11,14,12,13,12] :
                                   [18,15,16,12,14,10,8];
    const max = Math.max(...points);
    const min = Math.min(...points);
    return (
      <svg width="80" height="24" viewBox="0 0 80 24" preserveAspectRatio="none">
        <polyline
          fill="none" stroke={color} strokeWidth="1.5"
          points={points.map((p, i) => `${(i / (points.length-1)) * 78 + 1},${22 - ((p - min) / (max - min || 1)) * 20}`).join(" ")}
        />
      </svg>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }} className="scroll-y">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Monitoring</h2>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>Leading indicators tell you which scenario is unfolding.</div>
          </div>
          <button className="btn btn-primary btn-sm"><Icons.Plus size={12}/> Add indicator</button>
        </div>

        {/* Status summary */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
          {[
            { label: "All", count: indicators.length, color: "#1E1B2E", dot: "#1E1B2E" },
            { label: "Alert", count: indicators.filter(i => i.status === "Alert").length, color: "#EF4444", dot: "#EF4444" },
            { label: "Watch", count: indicators.filter(i => i.status === "Watch").length, color: "#F59E0B", dot: "#F59E0B" },
            { label: "On track", count: indicators.filter(i => i.status === "On track").length, color: "#10B981", dot: "#10B981" },
          ].map(s => (
            <button
              key={s.label}
              onClick={() => setFilter(s.label)}
              style={{
                border: filter === s.label ? "1.5px solid #1E1B2E" : "1px solid #E5E7EB",
                background: "#fff", padding: filter === s.label ? "11px 14px" : "12px 14px",
                borderRadius: 10, cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase" }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot }}/>
                {s.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 4, color: s.color }}>{s.count}</div>
            </button>
          ))}
        </div>

        {/* Indicator list */}
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(280px, 2.4fr) 1.4fr 100px 100px 90px 40px",
            background: "#F9FAFB", borderBottom: "1px solid #E5E7EB",
            padding: "10px 14px", fontSize: 11, fontFamily: "var(--font-mono)",
            fontWeight: 500, color: "#6B7280", letterSpacing: ".04em", textTransform: "uppercase",
          }}>
            <div>INDICATOR</div>
            <div>POINTS TO</div>
            <div style={{ textAlign: "center" }}>STATUS</div>
            <div style={{ textAlign: "center" }}>TREND</div>
            <div style={{ textAlign: "center" }}>7-DAY</div>
            <div></div>
          </div>
          {filtered.map((ind, i) => {
            const c = statusColor(ind.status);
            const scenario = scenarios.find(s => s.name === ind.scenario);
            return (
              <div
                key={ind.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(280px, 2.4fr) 1.4fr 100px 100px 90px 40px",
                  padding: "12px 14px",
                  borderBottom: i < filtered.length - 1 ? "1px solid #F3F4F6" : "none",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: "#1E1B2E" }}>{ind.name}</div>
                  <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2 }}>{ind.note}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: scenario?.color || "#9CA3AF" }}/>
                  <span style={{ fontSize: 12.5, color: "#374151" }}>{ind.scenario}</span>
                </div>
                <div style={{ textAlign: "center" }}>
                  <span className="badge" style={{ background: c.bg, color: c.fg, fontSize: 10 }}>{ind.status}</span>
                </div>
                <div style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: c.fg }}>
                  {ind.trend}
                </div>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  {sparkline(c.dot, ind.trend)}
                </div>
                <div style={{ textAlign: "right" }}>
                  <button style={{ border: "none", background: "transparent", color: "#9CA3AF", cursor: "pointer", padding: 4 }}>
                    <Icons.MoreH size={14}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI insight */}
        <div style={{
          marginTop: 16, padding: 14,
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <Icons.Bell size={16} stroke="#EF4444" style={{ flexShrink: 0, marginTop: 2 }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#991B1B", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 4 }}>2 indicators in alert</div>
            <div style={{ fontSize: 13, color: "#7F1D1D", lineHeight: 1.55 }}>
              US-China tariff escalations and cross-border cloud sanctions are both moving toward the <strong>Bamboo Curtain</strong> scenario. Review your hedging strategy.
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ borderColor: "#FCA5A5", color: "#991B1B", background: "#fff" }}>Review</button>
        </div>
      </div>
    </div>
  );
}

function PageSettings({ navigate }) {
  const store = window.FM.useStore();
  const [tab, setTab] = React.useState("Project");

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }} className="scroll-y">
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
        <div className="card" style={{ padding: 8, alignSelf: "start" }}>
          {["Project", "Team", "AI Analyst", "Integrations", "Billing"].map(t => (
            <button key={t}
              onClick={() => setTab(t)}
              style={{
                width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 7,
                border: "none", background: tab === t ? "#FFF7ED" : "transparent",
                color: tab === t ? "#C2410C" : "#374151",
                fontSize: 13, fontWeight: 500, cursor: "pointer", marginBottom: 2,
              }}
            >{t}</button>
          ))}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 600 }}>{tab}</h2>

          {tab === "Project" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Field label="Project name" value={store.project.name}/>
              <Field label="Focal question" value={store.project.focal_question} multiline/>
              <Field label="Time horizon" value={store.project.horizon}/>
              <Field label="Industry" value={store.project.industry}/>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "16px 0", borderTop: "1px solid #F3F4F6" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#EF4444" }}>Reset prototype</div>
                  <div style={{ fontSize: 12, color: "#6B7280" }}>Clear all localStorage and return to landing.</div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ color: "#EF4444", borderColor: "#FECACA" }} onClick={store.reset}>Reset</button>
              </div>
            </div>
          )}

          {tab === "Team" && (
            <div>
              {[
                { name: "John Doe", role: "Owner", initials: "JD", bg: "#E5E7EB", fg: "#6B7280" },
                { name: "Sarah Chen", role: "Contributor", initials: "SC", bg: "#DBEAFE", fg: "#1D4ED8" },
                { name: "Maya R.", role: "Consultant", initials: "MR", bg: "#EDE9FE", fg: "#6D28D9" },
              ].map(m => (
                <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <span style={{ width: 32, height: 32, borderRadius: 999, background: m.bg, color: m.fg, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600 }}>{m.initials}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{m.name}</div>
                    <div style={{ fontSize: 11.5, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>{m.role.toUpperCase()}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm">Manage</button>
                </div>
              ))}
              <button className="btn btn-soft btn-sm" style={{ marginTop: 14 }}><Icons.Plus size={12}/> Invite member</button>
            </div>
          )}

          {tab === "AI Analyst" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.55 }}>
                Configure how the AI Analyst reads your knowledge base and proposes signals.
              </div>
              {[
                { label: "Auto-extract insights from new sources", on: true },
                { label: "Suggest signals from external news feeds", on: true },
                { label: "Send weekly scenario digest", on: false },
                { label: "Use Schwartz framework strictly (vs. exploratory)", on: true },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #F3F4F6" }}>
                  <div style={{ fontSize: 13.5 }}>{s.label}</div>
                  <Toggle on={s.on}/>
                </div>
              ))}
            </div>
          )}

          {tab === "Integrations" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { name: "Slack", desc: "Push signposts and alerts to channels", connected: true },
                { name: "Notion", desc: "Sync narratives to your team wiki", connected: false },
                { name: "Bloomberg", desc: "Auto-import macro data into Signals", connected: false },
                { name: "RSS Feeds", desc: "Watch sources for relevant signals", connected: true },
              ].map(intg => (
                <div key={intg.name} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 14, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{intg.name}</div>
                    <span className={"badge " + (intg.connected ? "badge-low" : "badge-mid")} style={{ fontSize: 10 }}>{intg.connected ? "Connected" : "Available"}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#6B7280", marginBottom: 12, lineHeight: 1.5 }}>{intg.desc}</div>
                  <button className={"btn " + (intg.connected ? "btn-ghost" : "btn-soft") + " btn-sm"}>
                    {intg.connected ? "Manage" : "Connect"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {tab === "Billing" && (
            <div>
              <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: 16, marginBottom: 18 }}>
                <div style={{ fontSize: 11, color: "#C2410C", fontFamily: "var(--font-mono)", letterSpacing: ".06em", marginBottom: 4 }}>CURRENT PLAN</div>
                <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em" }}>Pro · $49/seat/mo</div>
                <div style={{ fontSize: 13, color: "#9A3412", marginTop: 4 }}>3 of 5 seats used · Renews March 14, 2026</div>
              </div>
              <button className="btn btn-primary btn-sm">Manage subscription</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, multiline }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 500, marginBottom: 6 }}>{label}</div>
      {multiline ? (
        <textarea className="input textarea" rows={3} defaultValue={value} style={{ minHeight: 80 }}/>
      ) : (
        <input className="input" defaultValue={value}/>
      )}
    </div>
  );
}

function Toggle({ on: initial }) {
  const [on, setOn] = React.useState(initial);
  return (
    <button onClick={() => setOn(!on)} style={{
      width: 36, height: 20, borderRadius: 999, position: "relative",
      background: on ? "#F97316" : "#E5E7EB", border: "none",
      cursor: "pointer", transition: "background .15s ease",
    }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 18 : 2,
        width: 16, height: 16, borderRadius: 999, background: "#fff",
        transition: "left .15s ease",
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      }}/>
    </button>
  );
}

window.PageMonitoring = PageMonitoring;
window.PageSettings = PageSettings;
