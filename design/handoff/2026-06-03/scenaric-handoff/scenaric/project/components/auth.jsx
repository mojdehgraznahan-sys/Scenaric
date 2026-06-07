// Auth — login + signup
function Auth({ navigate, mode = "login" }) {
  const store = window.FM.useStore();
  const [tab, setTab] = React.useState(mode);
  const [email, setEmail] = React.useState("");
  const [pwd, setPwd] = React.useState("");
  const [accountType, setAccountType] = React.useState(store.accountType || "self");

  React.useEffect(() => { setTab(mode); }, [mode]);

  const submit = (e) => {
    e && e.preventDefault();
    store.setAuthed(true);
    store.setAccountType(accountType);
    if (tab === "signup") navigate("/onboarding");
    else navigate("/app");
  };

  return (
    <div data-screen-label="Auth" style={{ minHeight: "100vh", display: "flex", background: "#fff" }}>
      {/* Left panel - quote */}
      <div style={{
        width: "50%", background: "#1E1B2E", color: "#fff",
        padding: 40, display: "flex", flexDirection: "column",
        position: "relative",
      }} className="auth-left">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icons.Logo size={26} reverse={true}/>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Scenaric.ai</span>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 460 }}>
          <blockquote style={{ margin: 0, fontSize: 21, lineHeight: 1.5, color: "rgba(255,255,255,0.7)", fontStyle: "italic", letterSpacing: "-0.005em" }}>
            "Scenarios are not predictions. They are stories about the future that help us make better decisions today."
          </blockquote>
          <div style={{ marginTop: 22, fontSize: 13, color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-mono)" }}>— PETER SCHWARTZ</div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>© 2026 Scenaric.ai</div>
      </div>

      {/* Right panel - form */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40,
        background: "#fff",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>
          {/* Tab toggle */}
          <div style={{ display: "flex", gap: 24, marginBottom: 28, borderBottom: "1px solid #E5E7EB" }}>
            <button
              onClick={() => { setTab("login"); navigate("/login"); }}
              className="tab"
              style={tab === "login" ? { color: "#F97316", borderBottom: "2px solid #F97316" } : {}}
            >Sign in</button>
            <button
              onClick={() => { setTab("signup"); navigate("/signup"); }}
              className="tab"
              style={tab === "signup" ? { color: "#F97316", borderBottom: "2px solid #F97316" } : {}}
            >Create account</button>
          </div>

          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
            {tab === "login" ? "Welcome back" : "Start planning"}
          </h1>
          <p style={{ color: "#6B7280", fontSize: 14, margin: "0 0 24px" }}>
            {tab === "login" ? "Sign in to continue planning." : "Free for 30 days. No credit card needed."}
          </p>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com"/>
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>Password</span>
              <input className="input" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} required placeholder="••••••••"/>
            </label>

            {tab === "signup" && (
              <div className="slide-up">
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, marginTop: 4 }}>I am planning scenarios…</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { id: "self", title: "For myself / my team", body: "Personal or team planning" },
                    { id: "client", title: "For client organisations", body: "Multiple client projects" },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAccountType(opt.id)}
                      style={{
                        textAlign: "left",
                        background: accountType === opt.id ? "#FFF7ED" : "#fff",
                        border: accountType === opt.id ? "2px solid #F97316" : "1px solid #E5E7EB",
                        padding: accountType === opt.id ? "11px 13px" : "12px 14px",
                        borderRadius: 10,
                        cursor: "pointer",
                        transition: "border .12s ease, background .12s ease",
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{opt.title}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{opt.body}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: "100%", padding: "11px 16px", marginTop: 6 }}>
              {tab === "login" ? "Sign in" : "Create account"}
            </button>

            <div style={{ textAlign: "center", fontSize: 13, color: "#6B7280" }}>
              {tab === "login" ? (
                <>Don't have an account? <a onClick={() => { setTab("signup"); navigate("/signup"); }} style={{ color: "#F97316", cursor: "pointer", textDecoration: "underline" }}>Sign up</a></>
              ) : (
                <>Already have an account? <a onClick={() => { setTab("login"); navigate("/login"); }} style={{ color: "#F97316", cursor: "pointer", textDecoration: "underline" }}>Sign in</a></>
              )}
            </div>
          </form>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .auth-left { display: none; }
        }
      `}</style>
    </div>
  );
}

window.Auth = Auth;
