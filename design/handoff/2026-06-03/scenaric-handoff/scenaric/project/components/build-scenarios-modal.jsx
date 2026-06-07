// Build Scenarios modal — first-time scenario creation from the chosen axes.
// Three steps: confirm axes → preview & name → confirm. On commit it writes
// four fresh scenarios (one per quadrant) and routes to the Canvas.

const { useState: useStateBS, useEffect: useEffectBS, useMemo: useMemoBS } = React;

const BS_AXIS = {
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
function bsAxis(sig) {
  if (!sig) return { axis: "—", pos: "High", neg: "Low" };
  return BS_AXIS[sig.id] || { axis: (sig.title || "").split(" ").slice(0, 2).join(" "), pos: "High", neg: "Low" };
}

const BS_QUAD_COLOR = { TL: "#3B82F6", TR: "#10B981", BL: "#EF4444", BR: "#F97316" };
const BS_QUAD_TINT  = { TL: "#EFF6FF", TR: "#FFF7ED", BL: "#FEF2F2", BR: "rgba(245,243,255,0.6)" };
const BS_ORDER = ["TL", "TR", "BL", "BR"];

const BS_NAME_POOL = [
  "Open Horizons", "Sovereign Silos", "Tidal Shift", "Monsoon Markets",
  "Archipelago", "Crosscurrents", "Safe Harbor", "Riptide",
  "Trade Winds", "Storm Front", "Calm Waters", "High Tide",
];
function bsPickNames(seedStr, n) {
  let h = seedStr.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const rand = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  const pool = [...BS_NAME_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}
function bsCatColor(cat) {
  return ({ Social: "#8B5CF6", Technology: "#3B82F6", Economic: "#10B981", Ecological: "#14B8A6", Political: "#EF4444" })[cat] || "#9CA3AF";
}

function BuildScenariosModal({ open, onClose, navigate }) {
  const store = window.FM.useStore();
  const seed = store.seed;
  const signals = store.signals || seed.signals;
  const dots = store.matrixDots || [];
  const currentAxes = store.criticalUncertainties || [];

  const [step, setStep] = useStateBS(1);
  const [axes, setAxes] = useStateBS(currentAxes);
  const [changingFor, setChangingFor] = useStateBS(null);
  const [names, setNames] = useStateBS([]);
  const [regen, setRegen] = useStateBS(0);
  const [openCanvas, setOpenCanvas] = useStateBS(true);
  const [error, setError] = useStateBS(null);

  const candidates = useMemoBS(() => dots.filter(d => d.x > 50 && d.y < 50).map(d => signals.find(s => s.id === d.sigId)).filter(Boolean), [dots, signals]);

  const sigById = (id) => signals.find(s => s.id === id);
  const a = bsAxis(sigById(axes[0]));
  const b = bsAxis(sigById(axes[1]));

  const suggested = useMemoBS(() => bsPickNames((axes[0] || "") + "|" + (axes[1] || "") + "|" + regen, 4), [axes.join(), regen]);

  // Keep editable names in sync with regenerated suggestions.
  useEffectBS(() => { setNames(suggested); }, [suggested.join()]);

  useEffectBS(() => {
    if (open) {
      setStep(1); setAxes(currentAxes); setChangingFor(null); setRegen(0); setOpenCanvas(true); setError(null);
    }
  }, [open]);

  const axesValid = axes[0] && axes[1] && axes[0] !== axes[1];

  const build = () => {
    try {
      if (!axesValid) throw new Error("invalid axes");
      const combos = {
        TL: `${a.pos} + ${b.neg}`, TR: `${a.pos} + ${b.pos}`,
        BL: `${a.neg} + ${b.neg}`, BR: `${a.neg} + ${b.pos}`,
      };
      const now = Date.now();
      const built = BS_ORDER.map((q, i) => ({
        id: "sc_" + q.toLowerCase() + "_" + now.toString(36),
        name: (names[i] || suggested[i] || q).trim() || q,
        quadrant: q,
        color: BS_QUAD_COLOR[q],
        tagline: combos[q],
        summary: "",
        narrative: "",
        createdAt: now,
        reaxedAt: now,
      }));
      if (built.length !== 4) throw new Error("generation failed");
      store.setScenarios(built);
      store.setCriticalUncertainties(axes);
      try { localStorage.removeItem("fm.reaxReview"); } catch {}
      onClose();
      if (window.FM_toast) window.FM_toast({ message: "4 scenarios created", actionText: "Open Canvas", action: "open-canvas", duration: 4000 });
      if (openCanvas && navigate) navigate("/app/canvas");
    } catch (e) {
      setError("Couldn't build scenarios. Try again or pick different axes.");
    }
  };

  // Esc close, body lock, Enter = primary.
  useEffectBS(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") {
        const tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (step < 3) { if (axesValid) setStep(s => s + 1); }
        else if (axesValid) build();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  });

  if (!open) return null;

  const STEPS = [{ n: 1, label: "Confirm axes" }, { n: 2, label: "Preview & name" }, { n: 3, label: "Confirm" }];

  const AxisSlot = ({ slot }) => {
    const sig = sigById(axes[slot]);
    const m = bsAxis(sig);
    return (
      <div style={{ position: "relative", flex: 1 }}>
        <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>Axis {slot + 1}</div>
        <div style={{ border: "1px solid #E5E7EB", borderRadius: 9, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: (sig && bsCatColor(sig.category)) || "#9CA3AF", flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1B2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.axis}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sig && sig.title}</div>
          </div>
          <button onClick={() => setChangingFor(changingFor === slot ? null : slot)} style={{ border: "none", background: "transparent", color: "#F97316", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>Change</button>
        </div>
        {changingFor === slot && (
          <div className="slide-up" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 12px 30px rgba(15,23,42,0.14)", padding: 6, maxHeight: 220, overflow: "auto" }}>
            {candidates.map(c => {
              const sel = axes[slot] === c.id;
              return (
                <button key={c.id} onClick={() => { setAxes(prev => { const nx = [...prev]; nx[slot] = c.id; return nx; }); setChangingFor(null); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, border: "none", background: sel ? "#FFF7ED" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#FAFAFA"; }} onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: bsCatColor(c.category), flexShrink: 0 }}/>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#1E1B2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Build your scenarios"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(30,27,46,0.40)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, animation: "fadeIn .15s ease-out both" }}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, background: "#fff", borderRadius: 14, boxShadow: "0 30px 80px rgba(15,23,42,0.25), 0 8px 24px rgba(15,23,42,0.12)", padding: 24, display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 48px)", position: "relative", animation: "slideUp .2s ease-out both" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: 7, border: "none", background: "transparent", color: "#6B7280", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          onMouseEnter={(e) => e.currentTarget.style.background = "#F5F5F5"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>

        <div style={{ paddingRight: 32 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1E1B2E", letterSpacing: "-0.01em" }}>Build your scenarios</h2>
          <div style={{ marginTop: 4, fontSize: 13.5, color: "#6B7280" }}>Confirm your two axes and we'll generate four scenarios.</div>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 16px" }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <button onClick={() => { if (s.n === 1 || axesValid) setStep(s.n); }} style={{ display: "flex", alignItems: "center", gap: 7, border: "none", background: "transparent", cursor: "pointer", padding: 0 }}>
                <span style={{ width: 22, height: 22, borderRadius: 999, flexShrink: 0, background: step >= s.n ? "#F97316" : "#E5E7EB", color: step >= s.n ? "#fff" : "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)" }}>{s.n}</span>
                <span style={{ fontSize: 12.5, fontWeight: step === s.n ? 600 : 500, color: step === s.n ? "#1E1B2E" : "#6B7280" }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span style={{ flex: 1, height: 1, background: "#E5E7EB" }}/>}
            </React.Fragment>
          ))}
        </div>

        <div className="scroll-y" style={{ flex: 1, overflow: "auto", minHeight: 180 }}>
          {step === 1 && (
            <div>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <AxisSlot slot={0}/>
                <div style={{ paddingTop: 30, color: "#9CA3AF", fontSize: 16 }}>×</div>
                <AxisSlot slot={1}/>
              </div>
              <div style={{ marginTop: 16, padding: "10px 12px", background: "#F9FAFB", borderRadius: 9, fontSize: 12.5, color: "#6B7280" }}>
                Axes: <strong style={{ color: "#1E1B2E", fontWeight: 600 }}>{a.axis} × {b.axis}</strong>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ display: "flex", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 16 }}>
                  <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".6px", whiteSpace: "nowrap" }}>{a.axis}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "auto auto", gap: 6 }}>
                    {BS_ORDER.map((q, i) => {
                      const combo = ({ TL: `${a.pos} + ${b.neg}`, TR: `${a.pos} + ${b.pos}`, BL: `${a.neg} + ${b.neg}`, BR: `${a.neg} + ${b.pos}` })[q];
                      return (
                        <div key={q} style={{ background: BS_QUAD_TINT[q], borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 5, minHeight: 78 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: BS_QUAD_COLOR[q] }}>{q}</span>
                            {q === "TR" && <span style={{ fontSize: 8.5, fontWeight: 600, color: BS_QUAD_COLOR[q], textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>Best case</span>}
                          </div>
                          <input
                            value={names[i] || ""}
                            onChange={(e) => setNames(prev => { const nx = [...prev]; nx[i] = e.target.value; return nx; })}
                            placeholder="Name…"
                            style={{ border: "none", background: "transparent", padding: 0, fontSize: 12.5, fontWeight: 600, color: "#1E1B2E", width: "100%", outline: "none", borderBottom: "1px dashed transparent" }}
                            onFocus={(e) => e.target.style.borderBottomColor = BS_QUAD_COLOR[q]}
                            onBlur={(e) => e.target.style.borderBottomColor = "transparent"}
                          />
                          <div style={{ fontSize: 10.5, color: "#6B7280", marginTop: "auto" }}>{combo}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 6 }}>
                    <span style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".6px" }}>{b.axis}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setRegen(r => r + 1)} style={{ marginTop: 10, border: "none", background: "transparent", padding: 0, color: "#F97316", fontSize: 12, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 13, lineHeight: 1 }}>↻</span> Regenerate names
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.5, marginBottom: 14 }}>
                This will create <strong style={{ color: "#1E1B2E" }}>4 new scenarios</strong>. You can edit, rename, or delete them later on the Canvas page.
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13, color: "#1E1B2E" }}>
                <span onClick={() => setOpenCanvas(o => !o)} style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, border: `1.5px solid ${openCanvas ? "#F97316" : "#D1D5DB"}`, background: openCanvas ? "#F97316" : "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                  {openCanvas && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                </span>
                Open the Canvas page after building
              </label>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
                {BS_ORDER.map((q, i) => (
                  <div key={q} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#1E1B2E" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: BS_QUAD_COLOR[q], flexShrink: 0 }}/>
                    <span style={{ fontWeight: 600 }}>{names[i] || suggested[i]}</span>
                    <span style={{ color: "#9CA3AF", fontFamily: "var(--font-mono)", fontSize: 10.5 }}>{q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 14, background: "#FEF2F2", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12.5, color: "#991B1B", marginBottom: 6 }}>{error}</div>
              <button onClick={build} style={{ border: "none", background: "transparent", color: "#EF4444", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>Retry</button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#6B7280", fontSize: 13.5, fontWeight: 500, cursor: "pointer", padding: "6px 4px" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#1E1B2E"} onMouseLeave={(e) => e.currentTarget.style.color = "#6B7280"}>Cancel</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {step > 1 && <button onClick={() => setStep(step - 1)} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", color: "#1E1B2E", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>Back</button>}
            {step < 3 ? (
              <button onClick={() => axesValid && setStep(step + 1)} disabled={!axesValid}
                style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: "#F97316", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: axesValid ? "pointer" : "not-allowed", opacity: axesValid ? 1 : 0.4 }}>Next</button>
            ) : (
              <button onClick={build} disabled={!axesValid}
                style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: "#F97316", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: axesValid ? "pointer" : "not-allowed", opacity: axesValid ? 1 : 0.4 }}>Build scenarios →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

window.BuildScenariosModal = BuildScenariosModal;
