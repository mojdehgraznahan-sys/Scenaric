// Signals Library
function PageSignals({ navigate }) {
  const store = window.FM.useStore();
  const signals = store.signals;
  const [filter, setFilter] = React.useState("All");
  const [selected, setSelected] = React.useState(null);

  const categories = ["All", "Social", "Technology", "Economic", "Ecological", "Political"];

  const filtered = filter === "All" ? signals : signals.filter(s => s.category === filter);

  const categoryChipStyle = (cat, active) => {
    const styles = {
      Social:    { bg: "#F5F3FF", fg: "#8B5CF6", border: "rgba(139,92,246,0.4)" },
      Technology:{ bg: "#EFF6FF", fg: "#3B82F6", border: "rgba(59,130,246,0.4)" },
      Economic:  { bg: "#ECFDF5", fg: "#10B981", border: "rgba(16,185,129,0.4)" },
      Ecological:{ bg: "#F0FDFA", fg: "#14B8A6", border: "rgba(20,184,166,0.4)" },
      Political: { bg: "#FEF2F2", fg: "#EF4444", border: "rgba(239,68,68,0.4)" },
    };
    if (cat === "All") {
      return active
        ? { background: "#F97316", color: "#fff", border: "1px solid #F97316" }
        : { background: "#fff", color: "#6B7280", border: "1px solid #E5E7EB" };
    }
    const s = styles[cat];
    return active
      ? { background: s.fg, color: "#fff", border: `1px solid ${s.fg}` }
      : { background: s.bg, color: s.fg, border: `1px solid ${s.border}` };
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }} className="scroll-y">
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Signals Library</h2>
            <div style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}>STEEP forces. Rank by impact and uncertainty to find scenario axes.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm"><Icons.Filter size={12}/> Sort</button>
            <button className="btn btn-primary btn-sm"><Icons.Plus size={12}/> Add Signal</button>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              style={{
                padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontSize: 12,
                fontWeight: 500, ...categoryChipStyle(c, filter === c),
              }}
            >{c}</button>
          ))}
        </div>

        {/* Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              style={{
                border: "1px solid #E5E7EB", borderRadius: 10, padding: 14,
                background: "#fff", cursor: "pointer", transition: "border .12s ease, transform .12s ease",
                display: "flex", flexDirection: "column", gap: 8,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#D1D5DB"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#E5E7EB"}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className={"chip chip-" + s.category.toLowerCase()}>{s.category}</span>
                <span style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>{s.source}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.3, color: "#1E1B2E", letterSpacing: "-0.01em" }}>{s.title}</div>
              <div style={{ fontSize: 12.5, color: "#6B7280", lineHeight: 1.5, flex: 1 }}>{s.body}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>IMPACT</span>
                <Stars value={s.impact} size={11}/>
                <span style={{ marginLeft: "auto" }} className={"badge " + (s.uncertainty === "High" ? "badge-high" : s.uncertainty === "Medium" ? "badge-mid" : "badge-low")}>
                  {s.uncertainty}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                <button
                  className="btn btn-soft btn-sm"
                  style={{ flex: 1 }}
                  onClick={(e) => { e.stopPropagation(); navigate("/app/matrix"); }}
                >+ Add to Matrix</button>
                <button className="btn btn-ghost btn-sm" style={{ padding: 6 }} onClick={(e) => e.stopPropagation()}>
                  <Icons.MoreH size={14}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div onClick={() => setSelected(null)} style={{
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} className="card slide-up" style={{ maxWidth: 540, width: "100%", padding: 24, borderRadius: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span className={"chip chip-" + selected.category.toLowerCase()}>{selected.category}</span>
              <button onClick={() => setSelected(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6B7280" }}>
                <Icons.X size={16}/>
              </button>
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em" }}>{selected.title}</h3>
            <div style={{ fontSize: 11.5, color: "#9CA3AF", fontFamily: "var(--font-mono)", marginBottom: 14 }}>
              SOURCE · {selected.source.toUpperCase()}
            </div>
            <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>{selected.body}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>IMPACT</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                  <Stars value={selected.impact} size={14}/>
                  <span style={{ marginLeft: 4, fontSize: 13, fontWeight: 600 }}>{selected.impact}/5</span>
                </div>
              </div>
              <div style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em" }}>UNCERTAINTY</div>
                <div style={{ marginTop: 6 }}>
                  <span className={"badge " + (selected.uncertainty === "High" ? "badge-high" : selected.uncertainty === "Medium" ? "badge-mid" : "badge-low")} style={{ fontSize: 11 }}>
                    {selected.uncertainty}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setSelected(null); navigate("/app/matrix"); }}>
                Place on matrix →
              </button>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.PageSignals = PageSignals;
