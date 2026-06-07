"use client";

// Floating "Ask AI" launcher + chat drawer — available on every app page.
// Faithful Tailwind/shadcn port of the handoff ask-ai.jsx (canned-reply demo chat).
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMsg {
  role: "ai" | "user";
  text: string;
}

const INITIAL: ChatMsg[] = [
  { role: "ai", text: "Hi — I'm your AI Analyst. I've read your 12 sources and 5 interviews. Ask me anything about your scenarios." },
];

const CANNED_REPLIES = [
  "Based on your 12 sources, the most critical uncertainty cluster is regulatory alignment in Indonesia. The Bamboo Curtain scenario has the highest downside risk — would you like me to map your current strategy against it?",
  "Three driving forces stand out from your interview transcripts: geopolitical alignment, enterprise AI adoption pace, and capital cost regime. The first two are your strongest candidates for scenario axes.",
  "Your Pacific Connector narrative is well-supported by signals 3, 5, and 7. The weakest evidence is in the Bamboo Curtain — I'd recommend adding 2-3 more political signals before the next review.",
  "I noticed that 'Federated regional architecture' is robust across 2 of 4 scenarios. Pairing it with 'JV-first market entry' would cover all 4 futures with low combined risk.",
  "Two indicators have moved into Alert status this week: US-China tariff escalations and cross-border cloud sanctions. Both point toward Bamboo Curtain.",
];

const SUGGESTED = [
  "What are my critical uncertainties?",
  "Which scenario has the highest downside?",
  "Stress-test my current strategy",
  "Summarise this week's signals",
];

function Dot({ delay = 0 }: { delay?: number }) {
  return <span className="h-1.5 w-1.5 rounded-full bg-text-3" style={{ animation: "blink 1.2s infinite ease-in-out", animationDelay: delay + "ms" }} />;
}

export function AskAI() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMsg[]>(INITIAL);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Load persisted history after mount (SSR-safe).
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("fm.askai");
      if (stored) setMessages(JSON.parse(stored));
    } catch {}
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem("fm.askai", JSON.stringify(messages));
    } catch {}
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  // Keyboard shortcut: ⌘/Ctrl + I to toggle, Esc to close.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = (text?: string) => {
    const t = (text || input).trim();
    if (!t) return;
    setMessages((m) => [...m, { role: "user", text: t }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
      setMessages((m) => [...m, { role: "ai", text: reply }]);
      setThinking(false);
    }, 900 + Math.random() * 500);
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ask AI"
          title="Ask AI · ⌘I"
          className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 rounded-full border border-white/[0.08] bg-brand-dark py-[11px] pl-[13px] pr-4 text-[13px] font-medium text-white shadow-[0_8px_24px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.12)] transition-[transform,box-shadow] duration-150 hover:-translate-y-px"
        >
          <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-brand-orange">
            <Icons.Sparkle size={12} stroke="#fff" />
          </span>
          Ask AI
          <span className="ml-1 rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] tracking-[0.04em] text-white/60">⌘I</span>
        </button>
      )}

      {open && (
        <>
          <div onClick={() => setOpen(false)} className="fade-in fixed inset-0 z-[95] bg-[rgba(15,23,42,0.18)]" />
          <aside className="slide-up fixed bottom-4 right-4 top-4 z-[100] flex w-[380px] flex-col overflow-hidden rounded-[18px] border border-border bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25),0_6px_16px_rgba(15,23,42,0.08)]">
            {/* Header */}
            <div className="flex items-center gap-2.5 border-b border-[#F3F4F6] px-4 py-3.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-brand-orangeLight">
                <Icons.Sparkle size={14} stroke="#F97316" />
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold tracking-[-0.01em]">Ask AI</div>
                <div className="font-mono text-[11px] tracking-[0.04em] text-text-3">ANALYST · READING APAC EXPANSION 2030</div>
              </div>
              <button
                onClick={() => setMessages([{ role: "ai", text: "Cleared. What would you like to explore?" }])}
                title="New conversation"
                className="rounded-md border-0 bg-transparent p-1.5 text-text-3"
              >
                <Icons.Refresh size={14} />
              </button>
              <button onClick={() => setOpen(false)} title="Close · Esc" className="rounded-md border-0 bg-transparent p-1.5 text-text-3">
                <Icons.X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="scroll-y flex flex-1 flex-col gap-2.5 p-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[88%] whitespace-pre-wrap rounded-xl px-3 py-2.5 text-[13.5px] leading-[1.55]",
                    m.role === "ai" ? "self-start bg-bg text-brand-dark" : "self-end bg-brand-orange text-white"
                  )}
                >
                  {m.text}
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-1.5 self-start rounded-xl bg-bg px-3 py-2.5">
                  <Dot delay={0} />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </div>
              )}

              {messages.length <= 1 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">SUGGESTED</div>
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-[10px] border border-border bg-white px-3 py-2.5 text-left text-[12.5px] text-[#374151] transition-[border,background] duration-[120ms] hover:border-brand-orange100 hover:bg-brand-orangeLight"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[#F3F4F6] p-3">
              <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-1.5 focus-within:border-brand-orange">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                  placeholder="Ask anything…"
                  autoFocus
                  className="flex-1 border-0 bg-transparent px-2.5 py-[7px] text-[13px] outline-none"
                />
                <Button variant="primary" onClick={() => send()} disabled={!input.trim()} className="h-8 w-8 p-2">
                  <Icons.Send size={12} />
                </Button>
              </div>
              <div className="mt-1.5 text-center font-mono text-[10px] tracking-[0.04em] text-text-3">
                AI ANALYST · CLAUDE 4 · GROUNDED IN YOUR SOURCES
              </div>
            </div>
          </aside>
        </>
      )}

      <style>{`@keyframes blink { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }`}</style>
    </>
  );
}
