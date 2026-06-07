// Impact × Uncertainty Matrix
function PageMatrix({ navigate }) {
  const store = window.FM.useStore();
  const seed = store.seed;
  const [dots, setDots] = React.useState(store.matrixDots);
  const [selectedId, setSelectedId] = React.useState(store.selectedDot || dots[0]?.id);
  const [critical, setCritical] = React.useState(store.criticalUncertainties);
  const matrixRef = React.useRef(null);

  React.useEffect(() => { store.setMatrixDots(dots); }, [dots]);
  React.useEffect(() => { store.setCriticalUncertainties(critical); }, [critical]);

  const selectedDot = dots.find(d => d.id === selectedId);
  const selectedSignal = selectedDot ? seed.signals.find(s => s.id === selectedDot.sigId) : null;
  const [reaxisOpen, setReaxisOpen] = React.useState(false);
  const [buildOpen, setBuildOpen] = React.useState(false);
  const hasScenarios = (store.scenarios || []).some(s => !s.archived);
  const onBuildClick = () => { if (hasScenarios) setReaxisOpen(true); else setBuildOpen(true); };

  // Drag logic
  const dragRef = React.useRef({ active: false, id: null });

  const onPointerDown = (e, id) => {
    e.preventDefault();
    dragRef.current = { active: true, id, startX: e.clientX, startY: e.clientY, moved: false };
    setSelectedId(id);
    e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    if (Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY) > 3) dragRef.current.moved = true;
    const rect = matrixRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(2, Math.min(98, x));
    y = Math.max(2, Math.min(98, y));
    setDots(prev => prev.map(d => d.id === dragRef.current.id ? { ...d, x, y } : d));
  };
  const onPointerUp = () => {
    const { id, moved } = dragRef.current;
    dragRef.current = { active: false, id: null };
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    // A click (no drag) on a critical-quadrant candidate selects it as an axis.
    if (!moved && id) {
      const d = dots.find(x => x.id === id);
      if (d && d.x > 50 && d.y < 50 && !critical.includes(d.sigId) && critical.length < 2) {
        setCritical(prev => prev.length < 2 ? [...prev, d.sigId] : prev);
      }
    }
  };

  // Quadrants (TL: predetermined, TR: critical, BL: background, BR: wildcards)
  // Layout uses x as horizontal (uncertainty: left=low, right=high)
  // y as vertical inverted (top=high impact, bottom=low impact)
  // So:
  //  TL: low uncertainty, high impact = PREDETERMINED
  //  TR: high uncertainty, high impact = CRITICAL ★
  //  BL: low uncertainty, low impact  = BACKGROUND
  //  BR: high uncertainty, low impact = WILDCARDS

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 20 }} className="scroll-y">
      {/* Project-level breadcrumb */}
      <nav aria-label="Breadcrumb" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
        <button
          onClick={() => navigate("/app/home")}
          style={{ color: "#6B7280", fontSize: 12, border: "none", background: "transparent", cursor: "pointer", padding: 0, transition: "color .12s ease" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#F97316"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#6B7280"}
        >
          APAC Expansion 2030
        </button>
        <span aria-hidden style={{ color: "#D1D5DB", fontSize: 12 }}>/</span>
        <span style={{ color: "#1E1B2E", fontSize: 12, fontWeight: 500 }}>Matrix</span>
      </nav>

      {/* Project-level page header */}
      <div style={{ padding: "12px 0 20px" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: "#1E1B2E", letterSpacing: "-0.018em" }}>
          Impact × Uncertainty Matrix
        </h1>
        <div style={{ fontSize: 14, color: "#6B7280", maxWidth: 672, marginTop: 4, lineHeight: 1.5, textWrap: "pretty" }}>
          Rank all your signals by impact and uncertainty. The top-right quadrant becomes the source for your scenario axes.
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: "#6B7280" }}>Drag signals to rank them. The top-right quadrant becomes your scenario axes.</div>
          <button className="btn btn-primary btn-sm" onClick={onBuildClick}>
            Build Scenario Matrix <Icons.ArrowRight size={12}/>
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 14 }}>
          {/* Matrix */}
          <div style={{ position: "relative" }}>
            <div
              ref={matrixRef}
              style={{
                position: "relative",
                height: 460,
                background: "#fff",
                border: "1px solid #E5E7EB",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              {/* Quadrant backgrounds */}
              <div style={{ position: "absolute", left: 0, top: 0, width: "50%", height: "50%", background: "#EFF6FF" }}/>
              <div style={{ position: "absolute", left: "50%", top: 0, width: "50%", height: "50%", background: "#FFF7ED" }}/>
              <div style={{ position: "absolute", left: 0, top: "50%", width: "50%", height: "50%", background: "#F3F4F6" }}/>
              <div style={{ position: "absolute", left: "50%", top: "50%", width: "50%", height: "50%", background: "rgba(245,243,255,0.5)" }}/>

              {/* Quadrant labels */}
              <div style={{ position: "absolute", top: 12, left: 14, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".08em", color: "#3B82F6", fontWeight: 500, textTransform: "uppercase" }}>PREDETERMINED</div>
              <div style={{ position: "absolute", top: 12, right: 14, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".08em", color: "#F97316", fontWeight: 600, textTransform: "uppercase" }}>CRITICAL ★</div>
              <div style={{ position: "absolute", bottom: 32, left: 14, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".08em", color: "#9CA3AF", fontWeight: 500, textTransform: "uppercase" }}>BACKGROUND</div>
              <div style={{ position: "absolute", bottom: 32, right: 14, fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".08em", color: "#8B5CF6", fontWeight: 500, textTransform: "uppercase" }}>WILDCARDS</div>

              {/* Crosshairs (dashed) */}
              <div style={{ position: "absolute", left: 0, top: "50%", width: "100%", borderTop: "1px dashed #E5E7EB" }}/>
              <div style={{ position: "absolute", top: 0, left: "50%", height: "100%", borderLeft: "1px dashed #E5E7EB" }}/>

              {/* Axis labels */}
              <div style={{
                position: "absolute", left: "50%", bottom: 8, transform: "translateX(-50%)",
                fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase",
              }}>
                Uncertainty →
              </div>
              <div style={{
                position: "absolute", left: 8, top: "50%", transform: "translateY(-50%) rotate(-90deg)", transformOrigin: "left center",
                fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase",
              }}>
                ← Impact
              </div>

              {/* Dots */}
              {dots.map(d => {
                const sig = seed.signals.find(s => s.id === d.sigId);
                const inCritical = d.x > 50 && d.y < 50;       // top-right
                const inPredet   = d.x <= 50 && d.y < 50;      // top-left
                const isAxis     = critical.includes(d.sigId);
                let state = "other";
                if (isAxis) state = "axis";
                else if (inCritical) state = "candidate";
                else if (inPredet) state = "predetermined";

                const base = {
                  left: d.x + "%", top: d.y + "%",
                  background: d.color,
                };
                let extra = {};
                let titleText = sig && sig.title;
                if (state === "axis") {
                  extra = {
                    border: "2px solid #F97316",
                    boxShadow: "0 0 0 4px rgba(249,115,22,0.2)",
                    transform: "translate(-50%, -50%) scale(1.15)",
                    zIndex: 6,
                  };
                } else if (state === "candidate") {
                  extra = { border: "1.5px solid #fff" };
                  titleText = "Critical candidate — click to select as axis";
                } else if (state === "predetermined") {
                  extra = { border: "1.5px solid #fff" };
                  titleText = "Predetermined — appears in all scenarios";
                } else {
                  extra = { border: "1.5px solid #fff", opacity: 0.7, transform: "translate(-50%, -50%) scale(0.9)" };
                }

                return (
                  <div
                    key={d.id}
                    onPointerDown={(e) => onPointerDown(e, d.id)}
                    className={"matrix-dot matrix-dot--" + state}
                    style={{ ...base, ...extra }}
                    title={titleText}
                  >
                    {state === "predetermined" ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Predetermined">
                        <circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
                      </svg>
                    ) : d.label}

                    {state === "axis" && (
                      <span style={{
                        position: "absolute", top: "calc(100% + 3px)", left: "50%", transform: "translateX(-50%)",
                        fontSize: 9, fontWeight: 600, letterSpacing: ".4px", textTransform: "uppercase",
                        color: "#F97316", whiteSpace: "nowrap",
                      }}>Axis</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Category legend */}
            <div style={{ display: "flex", gap: 18, marginTop: 12, padding: "8px 14px 0", fontSize: 12, color: "#6B7280", flexWrap: "wrap" }}>
              {[
                { label: "Social",     color: "#8B5CF6" },
                { label: "Technology", color: "#3B82F6" },
                { label: "Economic",   color: "#10B981" },
                { label: "Ecological", color: "#14B8A6" },
                { label: "Political",  color: "#EF4444" },
              ].map(l => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: l.color }}/>
                  {l.label}
                </div>
              ))}
            </div>

            {/* State legend */}
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 10, padding: "0 14px", fontSize: 11, color: "#6B7280", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: "#9CA3AF", border: "2px solid #F97316", boxShadow: "0 0 0 2.5px rgba(249,115,22,0.2)", flexShrink: 0 }}/>
                Selected axis
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 999, background: "#9CA3AF", border: "1.5px solid #fff", flexShrink: 0 }}/>
                Critical candidate
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 14, height: 14, borderRadius: 999, background: "#9CA3AF", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
                  </svg>
                </span>
                Predetermined
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div>
            <div style={{
              border: "1px solid #FED7AA", background: "#FFF7ED", borderRadius: 12,
              padding: 12, marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ color: "#F97316" }}>★</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#C2410C" }}>Critical Uncertainties</span>
              </div>

              {/* Selection counter pill */}
              {(() => {
                const done = critical.length === 2;
                return (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "2px 10px", borderRadius: 999,
                    fontSize: 12, fontWeight: 500,
                    background: done ? "#ECFDF5" : "#FFF7ED",
                    color: done ? "#10B981" : "#F97316",
                    marginBottom: 8,
                  }}>
                    Selected: {critical.length} of 2{done ? " ✓" : ""}
                  </span>
                );
              })()}

              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: "#9A3412" }}>Select 2 as scenario axes</span>
                <MethodologyInfo/>
              </div>
              {dots.filter(d => d.x > 50 && d.y < 50).map(d => {
                const sig = seed.signals.find(s => s.id === d.sigId);
                const isOn = critical.includes(d.sigId);
                return (
                  <CriticalUncertaintyRow
                    key={d.id}
                    dot={d} sig={sig} isOn={isOn}
                    atCapacity={critical.length >= 2 && !isOn}
                    currentPicks={critical.map(id => {
                      const cd = dots.find(x => x.sigId === id);
                      const cs = cd && seed.signals.find(s => s.id === cd.sigId);
                      return { sigId: id, title: (cs && cs.title) || (cd && cd.label) || id };
                    })}
                    onToggle={() => {
                      setCritical(prev => prev.includes(d.sigId)
                        ? prev.filter(x => x !== d.sigId)
                        : prev.length < 2 ? [...prev, d.sigId] : prev
                      );
                    }}
                    onReplace={(removeId) => {
                      setCritical(prev => [...prev.filter(x => x !== removeId), d.sigId]);
                    }}
                    onViewStoryline={() => navigate("/app/storyline")}
                  />
                );
              })}
              {dots.filter(d => d.x > 50 && d.y < 50).length === 0 && (
                <div style={{ fontSize: 11.5, color: "#9CA3AF", padding: "8px 0" }}>Drag signals into the top-right to mark as critical.</div>
              )}

              {/* Orthogonality assessment — only with exactly 2 axes */}
              <IndependenceAssessment
                signals={critical.map(id => seed.signals.find(s => s.id === id)).filter(Boolean)}
                library={seed.signals}
              />

              {/* Live 2×2 scenario preview */}
              <ScenarioPreview
                signals={critical.map(id => seed.signals.find(s => s.id === id)).filter(Boolean)}
              />
            </div>

            <div style={{
              border: "1px solid #BFDBFE", background: "#EFF6FF", borderRadius: 12,
              padding: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#1D4ED8" }}>Predetermined</span>
              </div>
              {dots.filter(d => d.x <= 50 && d.y < 50).map(d => {
                const sig = seed.signals.find(s => s.id === d.sigId);
                return (
                  <div key={d.id} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
                    fontSize: 12, color: "#1E1B2E",
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: d.color }}/>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sig?.title || d.label}</span>
                  </div>
                );
              })}
              {dots.filter(d => d.x <= 50 && d.y < 50).length === 0 && (
                <div style={{ fontSize: 11.5, color: "#1D4ED8", padding: "4px 0" }}>No predetermined forces yet.</div>
              )}
            </div>

            {/* Selected signal details */}
            {selectedSignal && (
              <div className="slide-up" style={{ marginTop: 12, border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, background: "#fff" }}>
                <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em", marginBottom: 4 }}>SELECTED SIGNAL</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{selectedSignal.title}</div>
                <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{selectedSignal.body}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Re-axis migration modal (when scenarios already exist) */}
      <window.ReAxisModal open={reaxisOpen} onClose={() => setReaxisOpen(false)} navigate={navigate}/>
      {/* Build scenarios modal (first-time creation) */}
      <window.BuildScenariosModal open={buildOpen} onClose={() => setBuildOpen(false)} navigate={navigate}/>
    </div>
  );
}

window.PageMatrix = PageMatrix;


// Heuristic orthogonality check between two axis signals.
function assessIndependence(signals, library) {
  if (!signals || signals.length !== 2) return null;
  const [a, b] = signals;
  const countInCat = (cat) => (library || []).filter(s => s.category === cat).length;
  const aCount = countInCat(a.category);
  const bCount = countInCat(b.category);

  // Stable pseudo "sync %" derived from the pair (demo heuristic).
  const seed = (a.id + "|" + b.id).split("").reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const syncPct = 55 + (Math.abs(seed) % 30); // 55–84%

  // STATE 3 — not enough evidence in one of the categories.
  if (aCount < 2 || bCount < 2) {
    const thinCat = aCount <= bCount ? a.category : b.category;
    const thinN = Math.min(aCount, bCount);
    return {
      state: "uncertain",
      rationale: [
        `Only ${thinN} signal${thinN === 1 ? "" : "s"} available in the ${thinCat} category.`,
        "Add more signals related to both axes to improve this check.",
      ],
    };
  }

  // STATE 2 — shared primary STEEP driver ⇒ likely correlated.
  if (a.category === b.category) {
    return {
      state: "correlated",
      rationale: [
        `Both axes rely heavily on signals from the ${a.category} category.`,
        `Historical signals show these forces moving in sync ${syncPct}% of the time.`,
      ],
    };
  }

  // STATE 1 — independent.
  return {
    state: "independent",
    rationale: [
      `Axes draw on different STEEP categories (${a.category} vs ${b.category}).`,
      "No shared primary drivers detected in the available signals.",
    ],
  };
}

function IndependenceAssessment({ signals, library }) {
  const result = assessIndependence(signals, library);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Fade-in when exactly 2 axes present.
  React.useEffect(() => {
    if (result) {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }
    setMounted(false);
    setOpen(false);
  }, [result ? result.state : null, !!result]);

  if (!result) return null;

  const THEME = {
    independent: {
      bg: "#ECFDF5", border: "rgba(16,185,129,0.4)", icon: "#10B981",
      headColor: "#065F46", bodyColor: "#065F46",
      heading: "Independent axes ✓",
      body: "These two uncertainties appear to resolve independently. Good axis pairing.",
    },
    correlated: {
      bg: "#FFFBEB", border: "rgba(245,158,11,0.4)", icon: "#F59E0B",
      headColor: "#92400E", bodyColor: "#92400E",
      heading: "Axes may be correlated ⚠",
      body: "These two uncertainties often move together. Scenarios built on correlated axes can lose distinctiveness. Consider swapping one.",
      suggest: "Suggest a more independent pair →",
    },
    uncertain: {
      bg: "#F5F5F5", border: "#E5E7EB", icon: "#6B7280",
      headColor: "#1E1B2E", bodyColor: "#6B7280",
      heading: "Independence unclear",
      body: "Not enough signal data to assess correlation. Add more signals related to both axes to improve this check.",
    },
  };
  const t = THEME[result.state];

  const renderIcon = () => {
    if (result.state === "independent") {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      );
    }
    if (result.state === "correlated") {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.icon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    );
  };

  return (
    <div style={{
      marginTop: 10,
      background: t.bg,
      border: `1px solid ${t.border}`,
      borderRadius: 10,
      padding: 12,
      opacity: mounted ? 1 : 0,
      transform: mounted ? "translateY(0)" : "translateY(4px)",
      transition: "opacity .2s ease, transform .2s ease",
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", border: "none", background: "transparent", padding: 0,
          cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "flex-start", gap: 8,
        }}
      >
        <span style={{ flexShrink: 0, marginTop: 1 }}>{renderIcon()}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: t.headColor }}>{t.heading}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.headColor} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginLeft: "auto", flexShrink: 0, opacity: 0.6, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </span>
          <span style={{ display: "block", fontSize: 12, color: t.bodyColor, marginTop: 3, lineHeight: 1.5, textWrap: "pretty" }}>
            {t.body}
          </span>
        </span>
      </button>

      {t.suggest && (
        <button
          onClick={(e) => e.stopPropagation()}
          style={{
            marginTop: 8, marginLeft: 24,
            border: "none", background: "transparent", padding: 0,
            color: "#F59E0B", fontSize: 12, fontWeight: 500, cursor: "pointer",
          }}
        >
          {t.suggest}
        </button>
      )}

      {/* Details drawer */}
      {open && (
        <div className="slide-up" style={{
          marginTop: 10, marginLeft: 24,
          borderTop: `1px solid ${t.border}`, paddingTop: 9,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: t.headColor, marginBottom: 6, fontFamily: "var(--font-mono)", letterSpacing: ".04em", textTransform: "uppercase" }}>
            Why this assessment?
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 5 }}>
            {result.rationale.map((r, i) => (
              <li key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: t.bodyColor, lineHeight: 1.45 }}>
                <span style={{ flexShrink: 0, marginTop: 6, width: 4, height: 4, borderRadius: 999, background: t.icon }}/>
                <span style={{ flex: 1, textWrap: "pretty" }}>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CriticalUncertaintyRow({ dot, sig, isOn, atCapacity, currentPicks, onToggle, onReplace, onViewStoryline }) {
  const [hover, setHover] = React.useState(false);
  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const ref = React.useRef(null);
  const title = (sig && sig.title) || dot.label;

  React.useEffect(() => {
    if (!replaceOpen) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setReplaceOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setReplaceOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [replaceOpen]);

  const handleClick = () => {
    if (isOn) { onToggle(); return; }
    if (atCapacity) { setReplaceOpen(true); return; }
    onToggle();
  };

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        border: isOn ? "1.5px solid #F97316" : "1px solid #FED7AA",
        background: isOn ? "#fff" : "rgba(255,255,255,0.5)",
        borderRadius: 8, padding: "7px 10px", marginBottom: 6,
        transition: "border-color .12s ease",
      }}
    >
      <button
        onClick={handleClick}
        style={{
          width: "100%", padding: 0, textAlign: "left",
          border: "none", background: "transparent", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 12, fontWeight: 500, color: "#1E1B2E",
        }}
      >
        {/* Checkbox */}
        <span style={{
          width: 15, height: 15, borderRadius: 4, flexShrink: 0,
          border: `1.5px solid ${isOn ? "#F97316" : "#D1D5DB"}`,
          background: isOn ? "#F97316" : "#fff",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          {isOn && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </span>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: dot.color, flexShrink: 0 }}/>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
      </button>

      <div style={{
        marginTop: hover && !replaceOpen ? 4 : 0,
        height: hover && !replaceOpen ? 18 : 0,
        opacity: hover && !replaceOpen ? 1 : 0,
        overflow: "hidden",
        transition: "height .15s ease, opacity .15s ease, margin-top .15s ease",
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); onViewStoryline && onViewStoryline(); }}
          style={{
            border: "none", background: "transparent", padding: 0,
            color: "#F97316", fontSize: 12, fontWeight: 500,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
          }}
        >
          → View storyline
        </button>
      </div>

      {/* Replace popover */}
      {replaceOpen && (
        <div className="slide-up" style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10,
          boxShadow: "0 12px 30px rgba(15,23,42,0.14)",
          padding: 12, zIndex: 40,
        }}>
          <div style={{ fontSize: 12, color: "#1E1B2E", fontWeight: 500, marginBottom: 8, lineHeight: 1.4 }}>
            You can pick 2 axes. Replace which one?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(currentPicks || []).map(p => (
              <button
                key={p.sigId}
                onClick={() => { onReplace(p.sigId); setReplaceOpen(false); }}
                style={{
                  width: "100%", textAlign: "left",
                  border: "1px solid #E5E7EB", borderRadius: 7,
                  background: "#fff", cursor: "pointer",
                  padding: "7px 9px", fontSize: 12, color: "#1E1B2E",
                  display: "flex", alignItems: "center", gap: 7,
                  transition: "border-color .12s ease, background .12s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F97316"; e.currentTarget.style.background = "#FFF7ED"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#fff"; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setReplaceOpen(false)}
            style={{
              marginTop: 8, border: "none", background: "transparent", padding: 0,
              color: "#6B7280", fontSize: 12, cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function MethodologyInfo() {
  const [hover, setHover] = React.useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ cursor: "help" }}>
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      {hover && (
        <span style={{
          position: "absolute", left: "50%", bottom: "calc(100% + 8px)", transform: "translateX(-50%)",
          background: "#1E1B2E", color: "#fff",
          fontSize: 12, lineHeight: 1.45, fontWeight: 400,
          padding: "6px 9px", borderRadius: 6,
          width: 240, maxWidth: 240, zIndex: 50,
          boxShadow: "0 8px 20px rgba(15,23,42,0.2)",
          textWrap: "pretty",
        }}>
          Schwartz's method uses exactly 2 axes to form a 2×2 matrix of 4 scenarios. More axes create too many futures to reason about clearly.
        </span>
      )}
    </span>
  );
}

// Per-signal axis metadata: short axis name + the two poles.
const SIGNAL_AXIS = {
  sg1: { axis: "Carbon Policy",          pos: "Strict",   neg: "Lax" },
  sg2: { axis: "AI Adoption",            pos: "Fast",     neg: "Slow" },
  sg3: { axis: "Talent Values",          pos: "Purpose",  neg: "Pay" },
  sg4: { axis: "Geopolitical Alignment", pos: "Aligned",  neg: "Decoupled" },
  sg5: { axis: "Consumer Growth",        pos: "High",     neg: "Low" },
  sg6: { axis: "Climate Risk",           pos: "Severe",   neg: "Mild" },
  sg7: { axis: "Channel Shift",          pos: "Mobile",   neg: "Web" },
  sg8: { axis: "Market Openness",        pos: "Open",     neg: "Closed" },
  sg9: { axis: "FX Stability",           pos: "Stable",   neg: "Volatile" },
};

function axisMeta(sig) {
  if (!sig) return { axis: "—", pos: "High", neg: "Low" };
  return SIGNAL_AXIS[sig.id] || {
    axis: (sig.title || "").split(" ").slice(0, 2).join(" "),
    pos: "High", neg: "Low",
  };
}

const SCENARIO_NAME_POOL = [
  "Pacific Connector", "Fragmented Frontier", "Walled Gardens", "Bamboo Curtain",
  "Open Horizons", "Sovereign Silos", "Tidal Shift", "Monsoon Markets",
  "Archipelago", "Crosscurrents", "Safe Harbor", "Riptide",
  "High Tide", "Trade Winds", "Storm Front", "Calm Waters",
];

function pickNames(seedStr, count) {
  // Deterministic shuffle of the pool seeded by string; return first `count`.
  let h = seedStr.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const rand = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  const pool = [...SCENARIO_NAME_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function ScenarioPreview({ signals }) {
  const ready = signals && signals.length === 2;
  const [regen, setRegen] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (ready) { const t = setTimeout(() => setMounted(true), 10); return () => clearTimeout(t); }
    setMounted(false);
  }, [ready, signals ? signals.map(s => s.id).join("|") : ""]);

  // Empty state — greyed 2×2 with overlay.
  if (!ready) {
    return (
      <div style={{
        marginTop: 10, background: "#fff", border: "1px solid #E5E7EB",
        borderRadius: 10, padding: 16,
      }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".6px",
          color: "#6B7280", textTransform: "uppercase", marginBottom: 12, fontWeight: 500,
        }}>Scenario preview</div>
        <div style={{ position: "relative", aspectRatio: "1 / 1", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 6 }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ background: "#F5F5F5", borderRadius: 6 }}/>
          ))}
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, color: "#6B7280", textAlign: "center", padding: 12,
          }}>
            Select 2 axes to preview scenarios
          </div>
        </div>
      </div>
    );
  }

  const [aSig, bSig] = signals; // A = vertical (first), B = horizontal (second)
  const a = axisMeta(aSig);
  const b = axisMeta(bSig);
  const correlated = aSig.category === bSig.category;

  const seedStr = aSig.id + "|" + bSig.id + "|" + regen;
  const names = pickNames(seedStr, 4);

  // Quadrants: TL, TR, BR, BL grid order is row-major (TL, TR, BL, BR).
  const quads = {
    TL: { tint: "#EFF6FF", color: "#3B82F6", combo: `${a.pos} + ${b.neg}`, name: names[0] },
    TR: { tint: "#FFF7ED", color: "#F97316", combo: `${a.pos} + ${b.pos}`, name: names[1], tag: "Best case" },
    BL: { tint: "#FEF2F2", color: "#EF4444", combo: `${a.neg} + ${b.neg}`, name: names[2] },
    BR: { tint: "rgba(245,243,255,0.6)", color: "#8B5CF6", combo: `${a.neg} + ${b.pos}`, name: names[3] },
  };
  const order = ["TL", "TR", "BL", "BR"];

  // Plausibility: correlated axes make one corner self-contradictory.
  const implausibleQuad = correlated ? "BL" : null;

  return (
    <div style={{
      marginTop: 10, background: "#fff", border: "1px solid #E5E7EB",
      borderRadius: 10, padding: 16,
      opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(4px)",
      transition: "opacity .2s ease, transform .2s ease",
    }}>
      <div style={{
        fontFamily: "var(--font-mono)", fontSize: 13, letterSpacing: ".6px",
        color: "#6B7280", textTransform: "uppercase", marginBottom: 12, fontWeight: 500,
      }}>Scenario preview</div>

      {/* Grid + axis labels */}
      <div style={{ display: "flex", gap: 6 }}>
        {/* Vertical axis label */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16 }}>
          <span style={{
            writingMode: "vertical-rl", transform: "rotate(180deg)",
            fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".6px", whiteSpace: "nowrap",
          }}>{a.axis}</span>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ aspectRatio: "1 / 1", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 6 }}>
            {order.map(q => {
              const Q = quads[q];
              const flagged = implausibleQuad === q;
              return (
                <div key={q} style={{
                  background: Q.tint, borderRadius: 6, padding: 10,
                  display: "flex", flexDirection: "column", gap: 4,
                  border: flagged ? "1px dashed #F59E0B" : "1px solid transparent",
                  position: "relative",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: Q.color }}>{q}</span>
                    {Q.tag && (
                      <span style={{ fontSize: 8.5, fontWeight: 600, color: Q.color, textTransform: "uppercase", letterSpacing: ".04em", fontFamily: "var(--font-mono)" }}>{Q.tag}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#1E1B2E", lineHeight: 1.3 }}>{Q.combo}</div>
                  <div style={{ fontSize: 10, fontStyle: "italic", color: "#6B7280", marginTop: "auto" }}>{Q.name}</div>
                </div>
              );
            })}
          </div>
          {/* Horizontal axis label */}
          <div style={{ textAlign: "center", marginTop: 6 }}>
            <span style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".6px" }}>{b.axis}</span>
          </div>
        </div>
      </div>

      {/* Regenerate */}
      <button
        onClick={() => setRegen(r => r + 1)}
        style={{
          marginTop: 8, border: "none", background: "transparent", padding: 0,
          color: "#F97316", fontSize: 12, fontWeight: 500, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>↻</span> Regenerate scenario names
      </button>

      {/* Plausibility check */}
      <div style={{ marginTop: 8 }}>
        {implausibleQuad ? (
          <span
            title="Correlated axes can produce a self-contradictory corner — review whether this future is story-able."
            style={{ fontSize: 11, color: "#F59E0B", cursor: "help", textDecorationLine: "none" }}
            onMouseEnter={(e) => e.currentTarget.style.textDecorationLine = "underline"}
            onMouseLeave={(e) => e.currentTarget.style.textDecorationLine = "none"}
          >
            One quadrant may be implausible — review {implausibleQuad} ⚠
          </span>
        ) : (
          <span style={{ fontSize: 11, color: "#10B981" }}>All four quadrants are plausible ✓</span>
        )}
      </div>
    </div>
  );
}