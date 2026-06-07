// Floating "Ask AI" button + chat drawer — available on every app page
function AskAI() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState(() => {
    try {
      const stored = localStorage.getItem("fm.askai");
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { role: "ai", text: "Hi — I'm your AI Analyst. I've read your 12 sources and 5 interviews. Ask me anything about your scenarios." },
    ];
  });
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    try { localStorage.setItem("fm.askai", JSON.stringify(messages)); } catch {}
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  // Keyboard shortcut: ⌘ + I to open
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const cannedReplies = [
    "Based on your 12 sources, the most critical uncertainty cluster is regulatory alignment in Indonesia. The Bamboo Curtain scenario has the highest downside risk — would you like me to map your current strategy against it?",
    "Three driving forces stand out from your interview transcripts: geopolitical alignment, enterprise AI adoption pace, and capital cost regime. The first two are your strongest candidates for scenario axes.",
    "Your Pacific Connector narrative is well-supported by signals 3, 5, and 7. The weakest evidence is in the Bamboo Curtain — I'd recommend adding 2-3 more political signals before the next review.",
    "I noticed that 'Federated regional architecture' is robust across 2 of 4 scenarios. Pairing it with 'JV-first market entry' would cover all 4 futures with low combined risk.",
    "Two indicators have moved into Alert status this week: US-China tariff escalations and cross-border cloud sanctions. Both point toward Bamboo Curtain.",
  ];

  const send = (text) => {
    const t = (text || input).trim();
    if (!t) return;
    setMessages(m => [...m, { role: "user", text: t }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const reply = cannedReplies[Math.floor(Math.random() * cannedReplies.length)];
      setMessages(m => [...m, { role: "ai", text: reply }]);
      setThinking(false);
    }, 900 + Math.random() * 500);
  };

  const suggested = [
    "What are my critical uncertainties?",
    "Which scenario has the highest downside?",
    "Stress-test my current strategy",
    "Summarise this week's signals",
  ];

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="askai-btn"
          aria-label="Ask AI"
          title="Ask AI · ⌘I"
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 90,
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 16px 11px 13px",
            background: "#1E1B2E", color: "#fff",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            boxShadow: "0 8px 24px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.12)",
            cursor: "pointer",
            fontSize: 13, fontWeight: 500,
            transition: "transform .15s ease, box-shadow .15s ease",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = "none"}
        >
          <span style={{
            width: 22, height: 22, borderRadius: 999, background: "#F97316",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icons.Sparkle size={12} stroke="#fff"/>
          </span>
          Ask AI
          <span style={{
            marginLeft: 4, padding: "2px 6px", borderRadius: 4,
            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
            fontSize: 10, fontFamily: "var(--font-mono)", letterSpacing: ".04em",
          }}>⌘I</span>
        </button>
      )}

      {/* Drawer */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(15,23,42,0.18)", zIndex: 95,
              animation: "fadeIn .15s ease-out both",
            }}
          />
          <aside
            className="slide-up"
            style={{
              position: "fixed",
              bottom: 16, right: 16, top: 16,
              width: 380, zIndex: 100,
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 20px 60px rgba(15,23,42,0.25), 0 6px 16px rgba(15,23,42,0.08)",
              border: "1px solid #E5E7EB",
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 28, height: 28, borderRadius: 8, background: "#FFF7ED",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icons.Sparkle size={14} stroke="#F97316"/>
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em" }}>Ask AI</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".04em" }}>
                  ANALYST · READING APAC EXPANSION 2030
                </div>
              </div>
              <button
                onClick={() => { setMessages([{ role: "ai", text: "Cleared. What would you like to explore?" }]); }}
                title="New conversation"
                style={{ border: "none", background: "transparent", color: "#9CA3AF", cursor: "pointer", padding: 6, borderRadius: 6 }}
              >
                <Icons.Refresh size={14}/>
              </button>
              <button
                onClick={() => setOpen(false)}
                title="Close · Esc"
                style={{ border: "none", background: "transparent", color: "#9CA3AF", cursor: "pointer", padding: 6, borderRadius: 6 }}
              >
                <Icons.X size={16}/>
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="scroll-y" style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              {messages.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === "ai" ? "flex-start" : "flex-end",
                  maxWidth: "88%",
                  padding: "10px 12px", borderRadius: 12, fontSize: 13.5, lineHeight: 1.55,
                  background: m.role === "ai" ? "#F5F5F5" : "#F97316",
                  color: m.role === "ai" ? "#1E1B2E" : "#fff",
                  whiteSpace: "pre-wrap",
                }}>{m.text}</div>
              ))}
              {thinking && (
                <div style={{
                  alignSelf: "flex-start",
                  padding: "10px 12px", borderRadius: 12, background: "#F5F5F5",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <Dot delay={0}/><Dot delay={150}/><Dot delay={300}/>
                </div>
              )}

              {messages.length <= 1 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 10.5, color: "#9CA3AF", fontFamily: "var(--font-mono)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 2 }}>SUGGESTED</div>
                  {suggested.map(s => (
                    <button key={s} onClick={() => send(s)} style={{
                      textAlign: "left", padding: "9px 12px",
                      border: "1px solid #E5E7EB", background: "#fff",
                      borderRadius: 10, cursor: "pointer", fontSize: 12.5, color: "#374151",
                      transition: "border .12s ease, background .12s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#FED7AA"; e.currentTarget.style.background = "#FFF7ED"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "#fff"; }}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: 12, borderTop: "1px solid #F3F4F6" }}>
              <div style={{
                border: "1px solid #E5E7EB", borderRadius: 12, padding: 6,
                display: "flex", alignItems: "center", gap: 4, background: "#fff",
                transition: "border .12s ease, box-shadow .12s ease",
              }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                  onFocus={(e) => e.currentTarget.parentElement.style.borderColor = "#F97316"}
                  onBlur={(e) => e.currentTarget.parentElement.style.borderColor = "#E5E7EB"}
                  placeholder="Ask anything…"
                  autoFocus
                  style={{ flex: 1, border: "none", outline: "none", padding: "7px 10px", fontSize: 13, background: "transparent" }}
                />
                <button onClick={() => send()} className="btn btn-primary" style={{ padding: 8, width: 32, height: 32 }} disabled={!input.trim()}>
                  <Icons.Send size={12}/>
                </button>
              </div>
              <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 6, fontFamily: "var(--font-mono)", textAlign: "center", letterSpacing: ".04em" }}>
                AI ANALYST · CLAUDE 4 · GROUNDED IN YOUR SOURCES
              </div>
            </div>
          </aside>
        </>
      )}

      <style>{`
        @keyframes blink { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }
      `}</style>
    </>
  );
}

function Dot({ delay = 0 }) {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: 999, background: "#9CA3AF",
      animation: "blink 1.2s infinite ease-in-out",
      animationDelay: delay + "ms",
    }}/>
  );
}

window.AskAI = AskAI;
