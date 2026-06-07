// Onboarding wizard — 3 steps
function Onboarding({ navigate }) {
  const store = window.FM.useStore();
  const [step, setStep] = React.useState(store.onboarding.step || 1);
  const [focal, setFocal] = React.useState(store.onboarding.focal || "");
  const [refined, setRefined] = React.useState(store.onboarding.refined);
  const [refining, setRefining] = React.useState(false);
  const [horizon, setHorizon] = React.useState(store.onboarding.horizon || "5-10 years");
  const [name, setName] = React.useState(store.onboarding.name || "");
  const [summary, setSummary] = React.useState(store.onboarding.summary || "");
  const [industry, setIndustry] = React.useState(store.onboarding.industry || "Technology");

  const persist = (patch) => {
    store.setOnboarding({ ...store.onboarding, ...patch });
  };

  const focalReady = focal.trim().length >= 20;

  const refine = () => {
    if (!focalReady) return;
    setRefining(true);
    setTimeout(() => {
      // Pretend AI refines
      const suggestion = `Over the next ${horizon}, how should we approach Southeast Asia market entry — sequencing Indonesia, Vietnam, and the Philippines — given the range of geopolitical, regulatory, and macroeconomic outcomes that could reshape the region?`;
      setRefined(suggestion);
      setRefining(false);
    }, 1300);
  };

  const launch = () => {
    persist({ step: 3, focal, refined, horizon, name, summary, industry, complete: true });
    store.setProject({ ...store.project, name, summary, industry, focal_question: refined || focal, horizon });
    navigate("/app");
  };

  const totalSteps = 3;

  return (
    <div data-screen-label={`Onboarding step ${step}`} style={{ minHeight: "100vh", background: "#F5F5F5", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "14px 32px",
        display: "flex", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icons.Logo size={26}/>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Scenaric.ai</span>
        </div>
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#6B7280", fontFamily: "var(--font-mono)" }}>
          Step {step} of {totalSteps}
        </div>
      </div>
      {/* Progress */}
      <div style={{ height: 4, background: "#E5E7EB" }}>
        <div style={{ height: "100%", background: "#F97316", width: `${(step / totalSteps) * 100}%`, transition: "width .35s ease" }}/>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "56px 24px" }}>
        <div className="card slide-up" key={step} style={{ maxWidth: 640, width: "100%", padding: 36, borderRadius: 20 }}>

          {step === 1 && (
            <>
              <div className="eyebrow" style={{ marginBottom: 14 }}>STEP 1 OF 3 · FOCAL QUESTION</div>
              <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
                What decision are you planning for?
              </h1>
              <p style={{ color: "#6B7280", fontSize: 14, margin: "0 0 22px" }}>
                This is your <strong style={{ color: "#1E1B2E" }}>focal question</strong> — the strategic decision scenario planning will help you navigate.
              </p>

              <textarea
                rows={4}
                value={focal}
                onChange={(e) => setFocal(e.target.value)}
                className="input textarea"
                style={{ borderRadius: 14, padding: 14, fontSize: 15, lineHeight: 1.55, minHeight: 110 }}
                placeholder="e.g. How should we approach SEA market entry given geopolitical uncertainty?"
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)" }}>
                <span>{focal.length} characters</span>
                <span>{focalReady ? "" : `${Math.max(0, 20 - focal.length)} more for AI refine`}</span>
              </div>

              {focalReady && (
                <button
                  className="btn btn-soft"
                  style={{ marginTop: 14, width: "100%", padding: "10px 12px" }}
                  onClick={refine}
                  disabled={refining}
                >
                  <Icons.Sparkle size={14}/>
                  {refining ? "Refining…" : "Refine with AI"}
                </button>
              )}

              {refining && (
                <div className="pulse" style={{
                  marginTop: 14, padding: 14, border: "1px dashed #FED7AA", borderRadius: 14,
                  background: "#FFF7ED", color: "#C2410C", fontSize: 13, fontFamily: "var(--font-mono)",
                }}>
                  AI is sharpening your question…
                </div>
              )}

              {refined && !refining && (
                <div className="slide-up" style={{
                  marginTop: 14, padding: 16, border: "1px solid #FED7AA", background: "#FFF7ED", borderRadius: 14,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Icons.Sparkle size={12} stroke="#C2410C"/>
                    <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "#C2410C", textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 500 }}>AI refined version</span>
                  </div>
                  <p style={{ margin: "0 0 12px", color: "#C2410C", fontSize: 14, lineHeight: 1.55 }}>{refined}</p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => { setFocal(refined); setRefined(null); }}>Use this version</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setRefined(null)}>Keep original</button>
                  </div>
                </div>
              )}

              <button
                className="btn btn-primary"
                style={{ marginTop: 22, width: "100%", padding: "12px 16px", borderRadius: 14, opacity: focalReady ? 1 : 0.4, cursor: focalReady ? "pointer" : "not-allowed" }}
                disabled={!focalReady}
                onClick={() => { persist({ focal, refined, step: 2 }); setStep(2); }}
              >
                Continue <Icons.ArrowRight size={14}/>
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="eyebrow" style={{ marginBottom: 14 }}>STEP 2 OF 3 · TIME HORIZON</div>
              <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
                How far ahead?
              </h1>
              <p style={{ color: "#6B7280", fontSize: 14, margin: "0 0 22px" }}>
                Choose a horizon that gives your scenarios room to diverge meaningfully.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
                {[
                  { id: "1-2 years", label: "1–2 years", body: "Tactical · operational" },
                  { id: "3-5 years", label: "3–5 years", body: "Strategic planning cycle" },
                  { id: "5-10 years", label: "5–10 years", body: "Long view — recommended" },
                  { id: "10+ years", label: "10+ years", body: "Transformative · directional" },
                ].map(h => (
                  <button
                    key={h.id}
                    type="button"
                    className={"horizon-card" + (horizon === h.id ? " selected" : "")}
                    onClick={() => setHorizon(h.id)}
                  >
                    <div style={{ fontSize: 16, fontWeight: 600, margin: "0 0 3px" }}>{h.label}</div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>{h.body}</div>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" onClick={() => { setStep(1); persist({ step: 1 }); }}>
                  <Icons.ArrowLeft size={14}/> Back
                </button>
                <button className="btn btn-primary" style={{ flex: 1, padding: "12px 16px", borderRadius: 14 }} onClick={() => { persist({ horizon, step: 3 }); setStep(3); }}>
                  Continue <Icons.ArrowRight size={14}/>
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="eyebrow" style={{ marginBottom: 14 }}>STEP 3 OF 3 · PROJECT</div>
              <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 8px" }}>
                Name your project
              </h1>
              <p style={{ color: "#6B7280", fontSize: 14, margin: "0 0 22px" }}>
                Give it a memorable name so the team can find it later.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Project name</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="APAC Expansion 2030"/>
                </label>
                <label>
                  <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Summary <span style={{ color: "#9CA3AF", fontWeight: 400 }}>· optional</span></span>
                  <textarea className="input textarea" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Your project summary..." style={{ minHeight: 80 }}/>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label>
                    <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Horizon</span>
                    <select className="input" value={horizon} onChange={(e) => setHorizon(e.target.value)}>
                      <option>1–2 years</option>
                      <option>3–5 years</option>
                      <option>5–10 years</option>
                      <option>10+ years</option>
                    </select>
                  </label>
                  <label>
                    <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Industry</span>
                    <select className="input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                      <option>Technology</option>
                      <option>Financial Services</option>
                      <option>Energy</option>
                      <option>Healthcare</option>
                      <option>Consumer Goods</option>
                      <option>Public Sector</option>
                    </select>
                  </label>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
                <button className="btn btn-ghost" onClick={() => { setStep(2); persist({ step: 2 }); }}>
                  <Icons.ArrowLeft size={14}/> Back
                </button>
                <button className="btn btn-primary" style={{ flex: 1, padding: "12px 16px", borderRadius: 14 }} onClick={launch} disabled={!name.trim()}>
                  <Icons.Rocket size={14}/> Launch project
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.Onboarding = Onboarding;
