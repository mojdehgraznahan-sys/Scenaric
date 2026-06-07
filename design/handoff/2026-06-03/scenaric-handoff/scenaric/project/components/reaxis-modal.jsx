// Re-axis migration modal — non-destructive flow for changing scenario axes.
// Three steps: choose new axes → review signal migration → preserve/drop
// narratives. Commits via store setters and offers a 30s undo.

const { useState: useStateRX, useEffect: useEffectRX, useMemo: useMemoRX } = React;

// Axis metadata shared with the matrix preview (kept local to avoid coupling).
const RX_SIGNAL_AXIS = {
  sg1: "Carbon Policy", sg2: "AI Adoption", sg3: "Talent Values",
  sg4: "Geopolitical Alignment", sg5: "Consumer Growth", sg6: "Climate Risk",
  sg7: "Channel Shift", sg8: "Market Openness", sg9: "FX Stability",
};
const rxAxisName = (sig) => sig ? (RX_SIGNAL_AXIS[sig.id] || (sig.title || "").split(" ").slice(0, 2).join(" ")) : "—";

const RX_NAME_POOL = [
  "Open Horizons", "Sovereign Silos", "Tidal Shift", "Monsoon Markets",
  "Archipelago", "Crosscurrents", "Safe Harbor", "Riptide",
  "Trade Winds", "Storm Front", "Calm Waters", "High Tide",
];
function rxPickNames(seedStr, n) {
  let h = seedStr.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const rand = () => { h = (h * 1103515245 + 12345) & 0x7fffffff; return h / 0x7fffffff; };
  const pool = [...RX_NAME_POOL];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, n);
}

const RX_QUADS = ["TL", "TR", "BL", "BR"];

function ReAxisModal({ open, onClose, navigate }) {
  const store = window.FM.useStore();
  const seed = store.seed;
  const signals = store.signals || seed.signals;
  const dots = store.matrixDots || [];
  const scenarios = store.scenarios || [];
  const currentAxes = store.criticalUncertainties || [];

  const [step, setStep] = useStateRX(1);
  const [newAxes, setNewAxes] = useStateRX(currentAxes);
  const [changingFor, setChangingFor] = useStateRX(null); // 0 | 1 | null — which axis slot's dropdown is open
  const [narrativeChoices, setNarrativeChoices] = useStateRX({}); // scenarioId -> "migrate"|"archive"|"delete"
  const [confirmDelete, setConfirmDelete] = useStateRX(null);
  const [showPreview, setShowPreview] = useStateRX(false);
  const applyReaxisRef = React.useRef(null);

  useEffectRX(() => {
    if (open) {
      setStep(1);
      setNewAxes(currentAxes);
      setChangingFor(null);
      setNarrativeChoices(Object.fromEntries(scenarios.map(s => [s.id, "migrate"])));
      setConfirmDelete(null);
      setShowPreview(false);
    }
  }, [open]);

  useEffectRX(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // Critical-quadrant signals are the eligible axis candidates.
  const candidates = useMemoRX(() => {
    return dots
      .filter(d => d.x > 50 && d.y < 50)
      .map(d => signals.find(s => s.id === d.sigId))
      .filter(Boolean);
  }, [dots, signals]);

  const sigById = (id) => signals.find(s => s.id === id);
  const axisChanged = JSON.stringify(newAxes) !== JSON.stringify(currentAxes);

  // ── Migration analysis (heuristic) ──────────────────────────────────
  const oldA = sigById(currentAxes[0]), oldB = sigById(currentAxes[1]);
  const newA = sigById(newAxes[0]),     newB = sigById(newAxes[1]);

  const proposedNames = rxPickNames((newAxes[0] || "") + "|" + (newAxes[1] || ""), 4);

  // Per-signal migration confidence — deterministic heuristic across all signals.
  const migration = useMemoRX(() => {
    const all = dots.map(d => {
      const sig = signals.find(s => s.id === d.sigId);
      const oldQuad = d.x > 50 ? (d.y < 50 ? "TR" : "BR") : (d.y < 50 ? "TL" : "BL");
      // Pseudo-confidence from a stable hash of signal + new axes.
      const h = Math.abs((d.sigId + (newAxes.join())).split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0));
      const score = h % 100;
      let confidence = "high";
      if (score < 20) confidence = "low";
      else if (score < 45) confidence = "medium";
      // New quadrant: high → keep, medium → shift one, low → unknown (needs manual)
      const idx = RX_QUADS.indexOf(oldQuad);
      const newQuad = confidence === "high" ? oldQuad
        : confidence === "medium" ? RX_QUADS[(idx + 1) % 4]
        : "?";
      return { sigId: d.sigId, title: (sig && sig.title) || d.label, oldQuad, newQuad, confidence };
    });
    return all;
  }, [dots, signals, newAxes.join()]);

  // Enter triggers the step's primary action. Hook must run unconditionally,
  // so it sits above the early return and guards on `open` internally.
  React.useEffect(() => {
    if (!open) return;
    const onEnter = (e) => {
      if (e.key !== "Enter") return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (step < 3) {
        if (!(step === 1 && (!newAxes[0] || !newAxes[1] || newAxes[0] === newAxes[1]))) setStep(s => s + 1);
      } else {
        applyReaxisRef.current();
      }
    };
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  });

  // Early-return AFTER every hook so hook order is stable across open/closed.
  if (!open) return null;

  const counts = migration.reduce((acc, m) => { acc[m.confidence] = (acc[m.confidence] || 0) + 1; return acc; }, {});
  const cleanCount = counts.high || 0;
  const reviewCount = (counts.medium || 0) + (counts.low || 0);

  const CONF = {
    high:   { color: "#10B981", label: "High", icon: "✓" },
    medium: { color: "#F59E0B", label: "Medium", icon: "?" },
    low:    { color: "#EF4444", label: "Low", icon: "⚠" },
  };

  // ── Apply ───────────────────────────────────────────────────────────
  const applyReaxis = () => {
    const snapshot = {
      scenarios: JSON.parse(JSON.stringify(scenarios)),
      critical: [...currentAxes],
    };
    const now = Date.now();
    const nextScenarios = scenarios
      .filter(s => narrativeChoices[s.id] !== "delete")
      .map((s, i) => ({
        ...s,
        name: narrativeChoices[s.id] === "archive" ? s.name : (proposedNames[i] || s.name),
        archived: narrativeChoices[s.id] === "archive",
        reaxedAt: now,
      }));

    store.setScenarios(nextScenarios);
    store.setCriticalUncertainties(newAxes);
    // Persist needs-review signals for the Storyline side panel.
    const review = migration.filter(m => m.confidence !== "high").map(m => m.sigId);
    try { localStorage.setItem("fm.reaxReview", JSON.stringify(review)); } catch {}

    onClose();
    // Global undo toast (survives the redirect to Canvas) + redirect.
    window.__fmUndo = snapshot;
    if (window.FM_toast) window.FM_toast({ message: "Re-axis applied", actionText: "Undo", action: "undo-reax", duration: 30000 });
    if (navigate) navigate("/app/canvas");
  };
  applyReaxisRef.current = applyReaxis;


  const STEPS = [
    { n: 1, label: "Choose new axes" },
    { n: 2, label: "Review impact" },
    { n: 3, label: "Preserve narratives" },
  ];

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Re-axis scenarios"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(30,27,46,0.40)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "fadeIn .15s ease-out both",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 720, background: "#fff", borderRadius: 14,
          boxShadow: "0 30px 80px rgba(15,23,42,0.25), 0 8px 24px rgba(15,23,42,0.12)",
          padding: 24, display: "flex", flexDirection: "column",
          maxHeight: "calc(100vh - 48px)", position: "relative",
          animation: "slideUp .2s ease-out both",
        }}
      >
        <button onClick={onClose} aria-label="Close" style={{
          position: "absolute", top: 16, right: 16, width: 30, height: 30, borderRadius: 7,
          border: "none", background: "transparent", color: "#6B7280", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#F5F5F5"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>

        {/* Header */}
        <div style={{ paddingRight: 32 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#1E1B2E", letterSpacing: "-0.01em" }}>Re-axis scenarios</h2>
          <div style={{ marginTop: 4, fontSize: 13.5, color: "#6B7280" }}>Pick new scenario axes. We'll help you migrate existing work.</div>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "18px 0 16px" }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <button
                onClick={() => setStep(s.n)}
                style={{
                  display: "flex", alignItems: "center", gap: 7, border: "none", background: "transparent",
                  cursor: "pointer", padding: 0,
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 999, flexShrink: 0,
                  background: step >= s.n ? "#F97316" : "#E5E7EB",
                  color: step >= s.n ? "#fff" : "#6B7280",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                }}>{s.n}</span>
                <span style={{ fontSize: 12.5, fontWeight: step === s.n ? 600 : 500, color: step === s.n ? "#1E1B2E" : "#6B7280" }}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span style={{ flex: 1, height: 1, background: "#E5E7EB" }}/>}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="scroll-y" style={{ flex: 1, overflow: "auto", minHeight: 200 }}>
          {step === 1 && (
            <StepChooseAxes
              currentAxes={currentAxes} newAxes={newAxes} setNewAxes={setNewAxes}
              candidates={candidates} sigById={sigById}
              changingFor={changingFor} setChangingFor={setChangingFor}
              oldA={oldA} oldB={oldB} newA={newA} newB={newB}
            />
          )}
          {step === 2 && (
            <StepReviewImpact
              scenarios={scenarios} proposedNames={proposedNames}
              migration={migration} CONF={CONF}
              cleanCount={cleanCount} reviewCount={reviewCount} total={migration.length}
              newA={newA} newB={newB}
            />
          )}
          {step === 3 && (
            <StepNarratives
              scenarios={scenarios} proposedNames={proposedNames}
              narrativeChoices={narrativeChoices} setNarrativeChoices={setNarrativeChoices}
              confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#6B7280", fontSize: 13.5, fontWeight: 500, cursor: "pointer", padding: "6px 4px" }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#1E1B2E"} onMouseLeave={(e) => e.currentTarget.style.color = "#6B7280"}
          >Cancel</button>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", color: "#1E1B2E", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>Back</button>
            )}
            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && (!newAxes[0] || !newAxes[1] || newAxes[0] === newAxes[1])}
                style={{
                  padding: "8px 16px", border: "none", borderRadius: 8,
                  background: "#F97316", color: "#fff", fontSize: 13.5, fontWeight: 600,
                  cursor: "pointer",
                  opacity: (step === 1 && (!newAxes[0] || !newAxes[1] || newAxes[0] === newAxes[1])) ? 0.4 : 1,
                }}
              >Next</button>
            )}
            {step === 3 && (
              <>
                <button onClick={() => { setShowPreview(true); setStep(2); }} style={{ padding: "8px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", color: "#1E1B2E", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>Preview migration</button>
                <button onClick={applyReaxis} style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: "#F97316", color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Apply re-axis →</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 1 — choose axes ─────────────────────────────────────────── */
function StepChooseAxes({ currentAxes, newAxes, setNewAxes, candidates, sigById, changingFor, setChangingFor, oldA, oldB, newA, newB }) {
  const AxisSlot = ({ slot }) => {
    const sig = sigById(newAxes[slot]);
    const isCurrent = newAxes[slot] === currentAxes[slot];
    return (
      <div style={{ position: "relative", flex: 1 }}>
        <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
          Axis {slot + 1}
        </div>
        <div style={{
          border: "1px solid #E5E7EB", borderRadius: 9, padding: "10px 12px",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: (sig && CAT_COLOR(sig.category)) || "#9CA3AF", flexShrink: 0 }}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1B2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rxAxisName(sig)}</div>
            <div style={{ fontSize: 11, color: "#9CA3AF", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sig && sig.title}</div>
          </div>
          {isCurrent && (
            <span style={{ padding: "1px 7px", borderRadius: 999, background: "#F5F5F5", color: "#6B7280", fontSize: 9.5, fontWeight: 600, fontFamily: "var(--font-mono)", letterSpacing: ".04em", textTransform: "uppercase" }}>Current</span>
          )}
          <button onClick={() => setChangingFor(changingFor === slot ? null : slot)} style={{ border: "none", background: "transparent", color: "#F97316", fontSize: 12, fontWeight: 500, cursor: "pointer", flexShrink: 0 }}>Change</button>
        </div>
        {changingFor === slot && (
          <div className="slide-up" style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
            background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, boxShadow: "0 12px 30px rgba(15,23,42,0.14)",
            padding: 6, maxHeight: 220, overflow: "auto",
          }} >
            {candidates.map(c => {
              const sel = newAxes[slot] === c.id;
              const isCur = currentAxes.includes(c.id);
              return (
                <button key={c.id}
                  onClick={() => { setNewAxes(prev => { const nx = [...prev]; nx[slot] = c.id; return nx; }); setChangingFor(null); }}
                  style={{
                    width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 7, border: "none",
                    background: sel ? "#FFF7ED" : "transparent", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 8,
                  }}
                  onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "#FAFAFA"; }}
                  onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: CAT_COLOR(c.category), flexShrink: 0 }}/>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#1E1B2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
                  {isCur && <span style={{ fontSize: 9.5, color: "#6B7280", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>current</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <AxisSlot slot={0}/>
        <div style={{ paddingTop: 30, color: "#9CA3AF", fontSize: 16 }}>×</div>
        <AxisSlot slot={1}/>
      </div>
      <div style={{ marginTop: 16, padding: "10px 12px", background: "#F9FAFB", borderRadius: 9, fontSize: 12.5, color: "#6B7280", lineHeight: 1.5 }}>
        <span style={{ color: "#9CA3AF" }}>Old:</span> <strong style={{ color: "#1E1B2E", fontWeight: 600 }}>{rxAxisName(oldA)} × {rxAxisName(oldB)}</strong>
        <span style={{ margin: "0 8px", color: "#F97316" }}>→</span>
        <span style={{ color: "#9CA3AF" }}>New:</span> <strong style={{ color: "#1E1B2E", fontWeight: 600 }}>{rxAxisName(newA)} × {rxAxisName(newB)}</strong>
      </div>
    </div>
  );
}

/* ── Step 2 — review impact ───────────────────────────────────────── */
function StepReviewImpact({ scenarios, proposedNames, migration, CONF, cleanCount, reviewCount, total, newA, newB }) {
  return (
    <div>
      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
        <strong style={{ color: "#1E1B2E", fontWeight: 600 }}>{cleanCount} of {total}</strong> signals will migrate cleanly.{" "}
        {reviewCount > 0 ? <><strong style={{ color: "#92400E", fontWeight: 600 }}>{reviewCount}</strong> need your review.</> : "None need review."}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".06em", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>Current scenarios</div>
          {scenarios.map(s => (
            <div key={s.id} style={{ padding: "8px 10px", border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1E1B2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
                <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>9 signals · 12 links</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".06em", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>Proposed scenarios</div>
          {proposedNames.map((nm, i) => (
            <div key={i} style={{ padding: "8px 10px", border: "1px dashed #FED7AA", background: "#FFF7ED", borderRadius: 8, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9.5, fontWeight: 600, color: "#F97316", fontFamily: "var(--font-mono)" }}>{RX_QUADS[i]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1E1B2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nm}</div>
                <div style={{ fontSize: 10.5, color: "#C2410C", fontStyle: "italic" }}>auto-suggested</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Migration rows */}
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: ".06em", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 8 }}>Signal migration</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {migration.map(m => {
          const c = CONF[m.confidence];
          return (
            <div key={m.sigId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", border: "1px solid #F3F4F6", borderRadius: 8 }}>
              <span style={{ width: 16, height: 16, borderRadius: 999, background: c.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, flexShrink: 0 }}>{c.icon}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "#1E1B2E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</span>
              <span style={{ fontSize: 11, color: "#6B7280", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                {m.oldQuad} <span style={{ color: c.color }}>→</span> {m.newQuad}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 3 — narratives ──────────────────────────────────────────── */
function StepNarratives({ scenarios, proposedNames, narrativeChoices, setNarrativeChoices, confirmDelete, setConfirmDelete }) {
  const OPTIONS = [
    { id: "migrate", label: "Migrate" },
    { id: "archive", label: "Archive" },
    { id: "delete",  label: "Delete" },
  ];
  return (
    <div>
      <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>Choose what happens to each existing narrative.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {scenarios.map((s, i) => {
          const choice = narrativeChoices[s.id] || "migrate";
          return (
            <div key={s.id} style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 9 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color, flexShrink: 0 }}/>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#1E1B2E" }}>{s.name}</span>
                {choice === "migrate" && (
                  <span style={{ fontSize: 11, color: "#9CA3AF" }}>→ {proposedNames[i] || "new quadrant"}</span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, padding: 2, background: "#F3F4F6", borderRadius: 8 }}>
                {OPTIONS.map(o => {
                  const active = choice === o.id;
                  return (
                    <button key={o.id}
                      onClick={() => {
                        if (o.id === "delete") { setConfirmDelete(s.id); return; }
                        setNarrativeChoices(prev => ({ ...prev, [s.id]: o.id }));
                      }}
                      style={{
                        padding: "6px 8px", border: "none", borderRadius: 6, cursor: "pointer",
                        background: active ? "#fff" : "transparent",
                        boxShadow: active ? "0 1px 2px rgba(15,23,42,0.08)" : "none",
                        color: active ? (o.id === "delete" ? "#EF4444" : "#1E1B2E") : "#6B7280",
                        fontWeight: active ? 600 : 500, fontSize: 12,
                      }}
                    >{o.label}</button>
                  );
                })}
              </div>
              {confirmDelete === s.id && (
                <div style={{ marginTop: 8, padding: "8px 10px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, fontSize: 12, color: "#991B1B" }}>
                  Delete "{s.name}" and its narrative permanently?
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button onClick={() => { setNarrativeChoices(prev => ({ ...prev, [s.id]: "delete" })); setConfirmDelete(null); }} style={{ border: "none", background: "#EF4444", color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Delete</button>
                    <button onClick={() => setConfirmDelete(null)} style={{ border: "none", background: "transparent", color: "#6B7280", fontSize: 12, cursor: "pointer" }}>Keep</button>
                  </div>
                </div>
              )}
              {choice === "delete" && confirmDelete !== s.id && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#EF4444" }}>Will be deleted on apply.</div>
              )}
              {choice === "archive" && (
                <div style={{ marginTop: 6, fontSize: 11, color: "#6B7280" }}>Preserved in “Past scenarios.”</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CAT_COLOR(cat) {
  return ({ Social: "#8B5CF6", Technology: "#3B82F6", Economic: "#10B981", Ecological: "#14B8A6", Political: "#EF4444" })[cat] || "#9CA3AF";
}

window.ReAxisModal = ReAxisModal;
