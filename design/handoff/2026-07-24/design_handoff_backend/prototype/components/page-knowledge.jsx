// Knowledge Base
function PageKnowledge({ navigate }) {
  const store = window.FM.useStore();
  const { seed } = store;
  const [sources, setSources] = React.useState(store.sources);
  const [activeType, setActiveType] = React.useState("Docs");
  const [dragOver, setDragOver] = React.useState(false);
  const [tab, setTab] = React.useState("Interviews");
  const fileInputRef = React.useRef(null);

  // Simulate processing progress for any "Processing" source
  React.useEffect(() => {
    const timer = setInterval(() => {
      setSources(prev => prev.map(s => {
        if (s.status === "Processing" && s.progress < 100) {
          const next = Math.min(100, s.progress + 5);
          return { ...s, progress: next, status: next === 100 ? "Complete" : "Processing" };
        }
        return s;
      }));
    }, 700);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => { store.setSources(sources); }, [sources]);

  const onFiles = (files) => {
    const list = Array.from(files);
    const newSources = list.map((f, i) => ({
      id: "u" + Date.now() + "-" + i,
      name: f.name,
      type: f.type.startsWith("audio") ? "audio" : (f.name.endsWith(".csv") ? "survey" : "doc"),
      status: "Processing",
      progress: 8,
    }));
    setSources(s => [...newSources, ...s]);
  };

  const stats = [
    { label: "Sources", value: sources.length },
    { label: "Interviews", value: 5 },
    { label: "Insights", value: 48 },
    { label: "Voices", value: 9 },
  ];

  const typeOptions = [
    { id: "Docs", icon: <Icons.File size={16}/>, label: "Docs" },
    { id: "Audio", icon: <Icons.Mic size={16}/>, label: "Audio" },
    { id: "Survey", icon: <Icons.Survey size={16}/>, label: "Survey" },
    { id: "Web", icon: <Icons.Link size={16}/>, label: "Web" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }} className="scroll-y">
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Knowledge Base</h2>
            <div style={{ color: "#6B7280", fontSize: 13, marginTop: 2 }}>Everything the AI Analyst reads from.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost btn-sm">Invite participant</button>
            <button className="btn btn-soft btn-sm"><Icons.Sparkle size={12}/> Extract insights</button>
            <button className="btn btn-primary btn-sm"><Icons.Plus size={12}/> Add source</button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
          {stats.map(s => (
            <div key={s.label} style={{
              border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", background: "#fff",
            }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: ".06em" }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Type selectors */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          {typeOptions.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveType(t.id)}
              style={{
                border: activeType === t.id ? "1.5px solid #F97316" : "1px solid #E5E7EB",
                background: activeType === t.id ? "#FFF7ED" : "#fff",
                padding: activeType === t.id ? "11.5px 12px" : "12px 12px",
                borderRadius: 10, cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                color: activeType === t.id ? "#C2410C" : "#6B7280",
                transition: "background .12s ease",
              }}
            >
              {t.icon}
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {/* Left: dropzone + sources */}
          <div>
            <div
              className={"dropzone" + (dragOver ? " drag" : "")}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                if (e.dataTransfer.files) onFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{ padding: 28 }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: "none" }}
                onChange={(e) => { if (e.target.files) onFiles(e.target.files); e.target.value = ""; }}
              />
              <Icons.Upload size={20} stroke="#9CA3AF" style={{ marginBottom: 8 }}/>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>Drop files or click to upload</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>AI reads and extracts insights automatically</div>
              <div style={{ fontSize: 10, color: "#9CA3AF", fontFamily: "var(--font-mono)", marginTop: 8, letterSpacing: ".04em" }}>
                PDF · DOCX · MP3 · MP4 · CSV
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {sources.map(s => {
                const icon = s.type === "audio" ? <Icons.Mic size={14}/> :
                             s.type === "survey" ? <Icons.Survey size={14}/> :
                             <Icons.File size={14}/>;
                return (
                  <div key={s.id} style={{
                    border: "1px solid #E5E7EB", borderRadius: 10, padding: "10px 12px",
                    display: "flex", alignItems: "center", gap: 10, background: "#fff",
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: 6, background: "#F5F5F5",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#6B7280",
                    }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                      <div className="progress-track" style={{ marginTop: 6, background: s.status === "Complete" ? "#ECFDF5" : "#FED7AA" }}>
                        <div className="progress-fill" style={{
                          width: s.progress + "%",
                          background: s.status === "Complete" ? "#10B981" : "#F97316",
                        }}/>
                      </div>
                    </div>
                    <span className={"badge " + (s.status === "Complete" ? "badge-low" : "badge-high")}>{s.status}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: AI insights banner + interviews */}
          <div>
            <div style={{
              border: "1px solid #FED7AA", background: "#FFF7ED", borderRadius: 10,
              padding: 14, marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icons.Sparkle size={12} stroke="#C2410C"/>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#C2410C", letterSpacing: ".05em", textTransform: "uppercase" }}>AI extracted insights (latest)</span>
              </div>
              <div style={{ fontSize: 13, color: "#C2410C", lineHeight: 1.55 }}>
                "Supply chain resilience flagged by 78% of managers as most critical uncertainty for the next 3 years."
              </div>
            </div>

            <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB", marginBottom: 10 }}>
              {["Interviews", "Surveys", "Themes"].map(t => (
                <button key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {seed.interviews.map(p => (
                <div key={p.id} style={{ border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{
                      width: 26, height: 26, borderRadius: 999,
                      background: p.avatar_bg, color: p.avatar_fg,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 600,
                    }}>{p.initials}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>{p.role}</div>
                    </div>
                    <span className={"badge " + (p.status === "Complete" ? "badge-low" : "badge-high")}>{p.status}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: "#1E1B2E", fontStyle: "italic", marginBottom: 8, lineHeight: 1.5 }}>"{p.quote}"</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span className={"chip chip-" + (p.tag.toLowerCase())}>{p.tag}</span>
                    <button style={{
                      border: "none", background: "transparent", color: "#F97316",
                      fontSize: 12, fontWeight: 500, cursor: "pointer",
                    }} onClick={() => navigate("/app/signals")}>
                      + Add to Signals →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.PageKnowledge = PageKnowledge;
