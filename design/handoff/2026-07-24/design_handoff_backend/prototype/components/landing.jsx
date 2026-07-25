// Landing page
const { useState: useStateLanding } = React;

function Landing({ navigate }) {
  const store = window.FM.useStore();
  return (
    <div data-screen-label="Landing" style={{ minHeight: "100vh", background: "#fff" }}>
      {/* Navbar */}
      <nav style={{
        height: 56, position: "sticky", top: 0, zIndex: 50,
        background: "#fff", borderBottom: "1px solid #E5E7EB",
        display: "flex", alignItems: "center", padding: "0 32px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icons.Logo size={26}/>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Scenaric.ai</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <a href="#features" style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500, color: "#6B7280" }}>Features</a>
          <a href="#method" style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500, color: "#6B7280" }}>Methodology</a>
          <a href="#pricing" style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500, color: "#6B7280" }}>Pricing</a>
          <a onClick={() => navigate("/login")} style={{ padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>Sign in</a>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/signup")}>Get started</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: "#1E1B2E", color: "#fff", padding: "96px 32px 112px", textAlign: "center" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)",
            padding: "6px 14px", borderRadius: 999, fontSize: 12, letterSpacing: ".02em",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#F97316" }}></span>
            Based on <em style={{ fontStyle: "normal", fontWeight: 500 }}>The Art of the Long View</em> · Peter Schwartz
          </div>
          <h1 style={{
            fontSize: 76, fontWeight: 600, letterSpacing: "-0.035em",
            lineHeight: 1.02, margin: "28px 0 20px", textWrap: "balance",
          }}>
            Shape your future<br/>with confidence
          </h1>
          <p style={{
            fontSize: 19, lineHeight: 1.55,
            color: "rgba(255,255,255,0.55)", maxWidth: 620, margin: "0 auto 36px",
          }}>
            The AI-powered scenario planning platform built on Peter Schwartz's proven 9-step methodology. Build strategy that holds up against any future.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate("/signup")}>
              Start planning free <Icons.ArrowRight size={16}/>
            </button>
            <button className="btn btn-on-ink btn-lg">
              See how it works
            </button>
          </div>
          {/* Trusted by row */}
          <div style={{ marginTop: 72, opacity: 0.5 }}>
            <div style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 16, color: "rgba(255,255,255,0.5)" }}>Used by strategy teams at</div>
            <div style={{ display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap", color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>
              <span>NORTHWIND</span><span>· ACME CO ·</span><span>HORIZON LABS</span><span>· VANTA GROUP ·</span><span>MIDWAY CAPITAL</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ background: "#fff", padding: "96px 32px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>THE METHODOLOGY</div>
            <h2 style={{ fontSize: 40, letterSpacing: "-0.02em", fontWeight: 600, margin: "0 0 14px" }}>
              The proven methodology, made interactive
            </h2>
            <p style={{ color: "#6B7280", fontSize: 16, maxWidth: 580, margin: "0 auto" }}>
              Schwartz's framework guided Shell through the 1970s oil shocks. Now it guides you — with AI as your analyst.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
            {[
              { icon: <Icons.Radio size={20}/>, title: "Identify Signals", body: "Capture STEEP forces from news, interviews, and research as they emerge." },
              { icon: <Icons.Layers size={20}/>, title: "Build Scenarios", body: "Plot critical uncertainties on a 2×2 matrix and develop coherent futures." },
              { icon: <Icons.Eye size={20}/>, title: "Monitor Reality", body: "Know which future is unfolding first — set indicators and track them automatically." },
            ].map((f, i) => (
              <div key={i} className="card" style={{ padding: 28 }}>
                <div style={{ width: 40, height: 40, background: "#FFF7ED", color: "#F97316", borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.01em" }}>{f.title}</h3>
                <p style={{ color: "#6B7280", fontSize: 14, margin: 0, lineHeight: 1.55 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9 Steps */}
      <section id="method" style={{ background: "#F5F5F5", padding: "96px 32px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h3 style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 12px" }}>9 steps from question to strategy</h3>
            <p style={{ color: "#6B7280", margin: 0 }}>The full Schwartz methodology, adapted for the AI era.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {[
              "Focal question",
              "Key forces",
              "Driving forces",
              "Rank forces",
              "Scenario logics",
              "Narratives",
              "Implications",
              "Indicators",
              "Strategic options",
            ].map((label, i) => (
              <div key={i} style={{
                background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12,
                padding: "18px 20px", display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 999, background: "#F97316", color: "#fff",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)",
                  flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product preview / quote */}
      <section style={{ background: "#fff", padding: "96px 32px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
          <blockquote style={{
            fontSize: 28, lineHeight: 1.4, fontWeight: 400, letterSpacing: "-0.015em",
            color: "#1E1B2E", margin: "0 0 28px", textWrap: "balance",
            fontStyle: "italic",
          }}>
            "Scenarios are not predictions. They are stories about the future that help us make better decisions today."
          </blockquote>
          <div style={{ fontSize: 13, color: "#6B7280", fontFamily: "var(--font-mono)" }}>— PETER SCHWARTZ</div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "#1E1B2E", color: "#fff", padding: "80px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h3 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 28px" }}>
            Ready to plan for any future?
          </h3>
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/signup")}>
            Start planning free <Icons.ArrowRight size={16}/>
          </button>
          <div style={{ marginTop: 16, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>No credit card required</div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: "#1E1B2E", color: "rgba(255,255,255,0.5)", padding: "32px 32px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icons.Logo size={22} reverse={true}/>
            <span style={{ fontSize: 13 }}>© 2026 Scenaric.ai</span>
          </div>
          <div style={{ display: "flex", gap: 22, fontSize: 13 }}>
            <a>Privacy</a><a>Terms</a><a>Security</a><a>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

window.Landing = Landing;
