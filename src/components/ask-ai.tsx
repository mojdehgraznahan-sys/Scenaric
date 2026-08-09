"use client";

// Floating "Ask AI" launcher + chat drawer — available on every app page.
// Faithful Tailwind/shadcn port of the handoff ask-ai.jsx (canned-reply demo chat). Real
// paths now: context="signals" (Signals page) calls askSignalsChat for real, grounded
// freeform chat; context="storyline"/"narrative" (Storyline/Narrative pages) are each a
// fixed task menu — see STORYLINE_TASKS/NARRATIVE_TASKS below — PLUS a real grounded
// "Ask anything…" freeform input alongside it (ScenarioChatPanel, backed by
// askScenarioChat), never in place of the scoped tasks. Every other page keeps the
// original canned-reply demo behavior untouched.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/chip";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { askSignalsChat, type SignalsChatResult } from "@/lib/actions/ai-signals";
import { AIGenerationFailedError } from "@/lib/ai/errors";
import type {
  ValidatePlausibilityResult,
  ValidateChainResult,
  MissingLinksResult,
} from "@/lib/actions/ai-storyline-tasks";
import type {
  CheckNarrativeFidelityResult,
  StressTestImplicationsResult,
} from "@/lib/actions/ai-narrative-tasks";
import type { GenerateImplicationsResult } from "@/lib/actions/ai-implications";
import type { GenerateIndicatorsResult } from "@/lib/actions/ai-indicators";
import type { StressTestOptionResult, SuggestHedgeResult } from "@/lib/actions/ai-strategy-tasks";
import type { StrategyChatResult } from "@/lib/actions/ai-strategy-chat";
import { createManualStrategicOption } from "@/lib/actions/strategy";
import type { RankScenariosResult, ExplainIndicatorResult, RecentChangesResult, SuggestIndicatorForScenarioResult } from "@/lib/actions/ai-monitoring-tasks";
import type { MonitoringChatResult } from "@/lib/actions/ai-monitoring-chat";
import { createManualIndicator } from "@/lib/actions/indicators";

interface ChatMsg {
  role: "ai" | "user";
  text: string;
  suggestedSignal?: SignalsChatResult["suggestedSignal"];
  // Strategy chat's own "propose a new option" suggestion (ai-strategy-chat.ts) — same
  // labeled + confirm-before-save contract as suggestedSignal above, just a different shape
  // of thing to add. Reuses `added`/`suggestedForProjectId` below rather than duplicating them.
  suggestedOption?: StrategyChatResult["suggestedOption"];
  // Monitoring chat's own "propose a new indicator" suggestion (ai-monitoring-chat.ts) — same
  // labeled + confirm-before-save contract as the two above.
  suggestedIndicator?: MonitoringChatResult["suggestedIndicator"];
  cites?: string[];
  // Set once "Add to Signals"/"Add as option" succeeds, so the button can't fire twice.
  added?: boolean;
  // The project this suggestion was generated against — the add button disables itself if
  // the active project has since changed, rather than silently writing to the wrong one.
  suggestedForProjectId?: string;
}

const INITIAL: ChatMsg[] = [
  { role: "ai", text: "Hi — I'm your AI Analyst. I've read your 12 sources and 5 interviews. Ask me anything about your scenarios." },
];

const SIGNALS_INITIAL: ChatMsg[] = [
  {
    role: "ai",
    text: "Hi — ask me about your Signals Library. I'll only answer from the signals and insights already in this project, and I'll say so plainly if something isn't grounded yet.",
  },
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

const SIGNALS_SUGGESTED = [
  "What are my highest-impact signals?",
  "Suggest a signal about supply chain risk",
  "Which STEEP category has the least coverage?",
  "Summarize my Economic signals",
];

type StorylineTaskId = "validate_plausibility" | "validate_chain" | "find_missing_links" | "explain_chain";

const STORYLINE_TASKS: { id: StorylineTaskId; label: string; needsPath: boolean }[] = [
  { id: "validate_plausibility", label: "Validate plausibility", needsPath: false },
  { id: "validate_chain", label: "Validate this chain", needsPath: true },
  { id: "find_missing_links", label: "Find missing links", needsPath: false },
  { id: "explain_chain", label: "Explain this chain", needsPath: true },
];

interface StorylineResultEntry {
  task: StorylineTaskId;
  ts: number;
  ok: boolean;
  error?: string;
  plausibility?: ValidatePlausibilityResult;
  chain?: ValidateChainResult;
  missing?: MissingLinksResult;
  explanation?: string;
}

type NarrativeTaskId = "check_fidelity" | "regenerate_implications" | "stress_test_implications" | "suggest_indicators";

const NARRATIVE_TASKS: { id: NarrativeTaskId; label: string; needsImplications: boolean }[] = [
  { id: "check_fidelity", label: "Check narrative fidelity to storyline", needsImplications: false },
  { id: "regenerate_implications", label: "Regenerate implications", needsImplications: false },
  { id: "stress_test_implications", label: "Stress-test implications", needsImplications: true },
  { id: "suggest_indicators", label: "Suggest indicators from this narrative", needsImplications: false },
];

interface NarrativeResultEntry {
  task: NarrativeTaskId;
  ts: number;
  ok: boolean;
  error?: string;
  fidelity?: CheckNarrativeFidelityResult;
  implications?: GenerateImplicationsResult;
  stressTest?: StressTestImplicationsResult;
  indicators?: GenerateIndicatorsResult;
}

type StrategyTaskId = "stress_test_option" | "explain_non_robust" | "suggest_hedge";

const STRATEGY_TASKS: { id: StrategyTaskId; label: string; needsOption: boolean; needsCell: boolean }[] = [
  { id: "stress_test_option", label: "Stress-test this option", needsOption: true, needsCell: false },
  { id: "explain_non_robust", label: "Why is this not robust here?", needsOption: false, needsCell: true },
  { id: "suggest_hedge", label: "Suggest a hedge", needsOption: false, needsCell: false },
];

interface StrategyResultEntry {
  task: StrategyTaskId;
  ts: number;
  ok: boolean;
  error?: string;
  stressTest?: StressTestOptionResult;
  explanation?: string;
  hedge?: SuggestHedgeResult;
}

type MonitoringTaskId = "most_likely_scenario" | "explain_indicator" | "recent_changes" | "suggest_indicator";

const MONITORING_TASKS: { id: MonitoringTaskId; label: string; needsIndicator: boolean }[] = [
  { id: "most_likely_scenario", label: "Which scenario is most likely emerging right now?", needsIndicator: false },
  { id: "explain_indicator", label: "Explain this indicator's status", needsIndicator: true },
  { id: "recent_changes", label: "What changed in the last 7 days?", needsIndicator: false },
  { id: "suggest_indicator", label: "Suggest a new indicator for an under-monitored scenario", needsIndicator: false },
];

interface MonitoringResultEntry {
  task: MonitoringTaskId;
  ts: number;
  ok: boolean;
  error?: string;
  ranking?: RankScenariosResult;
  explanation?: ExplainIndicatorResult;
  changes?: RecentChangesResult;
  suggestion?: SuggestIndicatorForScenarioResult;
}

function Dot({ delay = 0 }: { delay?: number }) {
  return <span className="h-1.5 w-1.5 rounded-full bg-text-3" style={{ animation: "blink 1.2s infinite ease-in-out", animationDelay: delay + "ms" }} />;
}

// "Ask anything…" freeform input, sitting alongside (below) Storyline's, Narrative's, and
// Strategy's fixed task menus — never replacing them. Backed by askScenarioChat
// (ai-scenario-chat.ts) for Storyline/Narrative or askStrategyChat (ai-strategy-chat.ts) for
// Strategy — real grounded chats, same discipline as Signals' askSignalsChat, not the
// canned-reply demo. onAddOption (Strategy only) renders a suggested-option card + confirm
// button when a message carries one, mirroring the main canned-chat branch's suggestedSignal
// card below — never auto-saved, only on this explicit click.
function ScenarioChatPanel({
  messages,
  input,
  setInput,
  thinking,
  onSend,
  onAddOption,
  onAddIndicator,
  activeProjectId,
}: {
  messages: ChatMsg[];
  input: string;
  setInput: (v: string) => void;
  thinking: boolean;
  onSend: (text?: string) => void;
  onAddOption?: (index: number) => void;
  onAddIndicator?: (index: number) => void;
  activeProjectId?: string | null;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking]);

  return (
    <div className="mt-1 flex flex-col gap-2 border-t border-[#F3F4F6] pt-3">
      <div className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">ASK ANYTHING</div>
      {messages.length > 0 && (
        <div ref={scrollRef} className="flex max-h-[240px] flex-col gap-2 overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-[1.5]",
                m.role === "ai" ? "self-start bg-bg text-brand-dark" : "self-end bg-brand-orange text-white"
              )}
            >
              {m.text}
              {m.suggestedOption && onAddOption && (
                <div className="mt-2.5 rounded-[10px] border border-border bg-white p-3 text-brand-dark">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold">{m.suggestedOption.name}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                        m.suggestedOption.origin === "grounded" ? "bg-[#ECFDF5] text-[#065F46]" : "bg-brand-orangeLight text-brand-orange700"
                      )}
                    >
                      {m.suggestedOption.origin === "grounded" ? "Grounded" : "External pattern — review before adding"}
                    </span>
                  </div>
                  <div className="mb-2.5 text-[12.5px] leading-[1.5] text-muted-foreground">
                    {m.suggestedOption.notes}
                    <div className="mt-1 italic">{m.suggestedOption.rationale}</div>
                  </div>
                  <Button
                    variant={m.added ? "ghost" : "soft"}
                    size="sm"
                    className="w-full"
                    disabled={m.added || m.suggestedForProjectId !== activeProjectId}
                    onClick={() => onAddOption(i)}
                  >
                    {m.added ? "Added as option ✓" : m.suggestedForProjectId !== activeProjectId ? "Switched projects — can't add" : "+ Add as option"}
                  </Button>
                </div>
              )}
              {m.suggestedIndicator && onAddIndicator && (
                <div className="mt-2.5 rounded-[10px] border border-border bg-white p-3 text-brand-dark">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold">{m.suggestedIndicator.name}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                        m.suggestedIndicator.origin === "grounded" ? "bg-[#ECFDF5] text-[#065F46]" : "bg-brand-orangeLight text-brand-orange700"
                      )}
                    >
                      {m.suggestedIndicator.origin === "grounded" ? "Grounded" : "External pattern — review before adding"}
                    </span>
                  </div>
                  <div className="mb-2.5 text-[12.5px] leading-[1.5] text-muted-foreground">
                    {m.suggestedIndicator.notes}
                    <div className="mt-1 italic">{m.suggestedIndicator.rationale}</div>
                  </div>
                  <Button
                    variant={m.added ? "ghost" : "soft"}
                    size="sm"
                    className="w-full"
                    disabled={m.added || m.suggestedForProjectId !== activeProjectId}
                    onClick={() => onAddIndicator(i)}
                  >
                    {m.added ? "Added indicator ✓" : m.suggestedForProjectId !== activeProjectId ? "Switched projects — can't add" : "+ Add indicator"}
                  </Button>
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="flex items-center gap-1.5 self-start rounded-xl bg-bg px-3 py-2">
              <Dot delay={0} />
              <Dot delay={150} />
              <Dot delay={300} />
            </div>
          )}
        </div>
      )}
      <div className="flex items-center gap-1 rounded-xl border border-border bg-white p-1.5 focus-within:border-brand-orange">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSend();
          }}
          placeholder="Ask anything…"
          className="flex-1 border-0 bg-transparent px-2.5 py-[7px] text-[13px] outline-none"
        />
        <Button variant="primary" onClick={() => onSend()} disabled={!input.trim() || thinking} className="h-8 w-8 p-2">
          <Icons.Send size={12} />
        </Button>
      </div>
    </div>
  );
}

export function AskAI({ context }: { context?: "signals" | "storyline" | "narrative" | "strategy" | "monitoring" }) {
  const store = useStore();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMsg[]>(context === "signals" ? SIGNALS_INITIAL : INITIAL);
  const [input, setInput] = React.useState("");
  const [thinking, setThinking] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const storageKey = context === "signals" ? "fm.askai.signals" : "fm.askai";

  // Reload from this context's own storage slot whenever the context changes (e.g. the
  // user navigates between the Signals page and everywhere else while the chat drawer's
  // component instance stays mounted) — keeps real signals-grounded history from ever
  // mixing with the general canned-reply thread.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setMessages(stored ? JSON.parse(stored) : context === "signals" ? SIGNALS_INITIAL : INITIAL);
    } catch {
      setMessages(context === "signals" ? SIGNALS_INITIAL : INITIAL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {}
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, thinking, storageKey]);

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

  const send = async (text?: string) => {
    const t = (text || input).trim();
    if (!t) return;
    setMessages((m) => [...m, { role: "user", text: t }]);
    setInput("");
    setThinking(true);

    if (context === "signals") {
      const projectId = store.activeProjectId;
      if (!projectId) {
        setMessages((m) => [...m, { role: "ai", text: "No active project — open a project first." }]);
        setThinking(false);
        return;
      }
      try {
        const result = await askSignalsChat({ projectId, question: t });
        setMessages((m) => [
          ...m,
          { role: "ai", text: result.answer, suggestedSignal: result.suggestedSignal, cites: result.cites, suggestedForProjectId: projectId },
        ]);
      } catch (err) {
        console.error("[ask-ai] signals chat failed", err);
        const text =
          err instanceof AIGenerationFailedError
            ? "Couldn't get a grounded answer right now — try rephrasing or ask again in a moment."
            : "Something went wrong answering that — try again.";
        setMessages((m) => [...m, { role: "ai", text }]);
      } finally {
        setThinking(false);
      }
      return;
    }

    setTimeout(() => {
      const reply = CANNED_REPLIES[Math.floor(Math.random() * CANNED_REPLIES.length)];
      setMessages((m) => [...m, { role: "ai", text: reply }]);
      setThinking(false);
    }, 900 + Math.random() * 500);
  };

  const onAddSignal = async (index: number) => {
    const msg = messages[index];
    const suggestion = msg.suggestedSignal;
    if (!suggestion || msg.added || msg.suggestedForProjectId !== store.activeProjectId) return;
    try {
      await store.createSignal({
        projectId: store.activeProjectId!,
        category: suggestion.category,
        source: "Ask AI",
        title: suggestion.title,
        body: suggestion.body,
        origin: suggestion.origin,
        groundedInsightIds: suggestion.groundedIn,
      });
      setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, added: true } : msg)));
    } catch (err) {
      console.error("[ask-ai] failed to add suggested signal", err);
    }
  };

  // Storyline mode — fixed task menu, never freeform. Results are ephemeral (not persisted
  // to localStorage like the other two modes' text-only messages), since they're structured
  // diagnostics tied to the current live chain rather than a conversation worth keeping.
  const [storylineResults, setStorylineResults] = React.useState<StorylineResultEntry[]>([]);
  const [runningTask, setRunningTask] = React.useState<StorylineTaskId | null>(null);

  const runStorylineTask = async (taskId: StorylineTaskId) => {
    const ctx = store.storylineAskAiContext;
    if (!ctx) return;
    setRunningTask(taskId);
    try {
      const res = await fetch(`/api/scenarios/${ctx.scenarioId}/storyline/ask-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskId, nodeIds: ctx.nodeIds }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data = await res.json();
      const entry: StorylineResultEntry = { task: taskId, ts: Date.now(), ok: true };
      if (taskId === "validate_plausibility") entry.plausibility = data as ValidatePlausibilityResult;
      else if (taskId === "validate_chain") entry.chain = data as ValidateChainResult;
      else if (taskId === "find_missing_links") entry.missing = data as MissingLinksResult;
      else entry.explanation = (data as { explanation: string }).explanation;
      setStorylineResults((r) => [entry, ...r]);
    } catch (err) {
      console.error("[ask-ai] storyline task failed", err);
      setStorylineResults((r) => [{ task: taskId, ts: Date.now(), ok: false, error: "Something went wrong running that task." }, ...r]);
    } finally {
      setRunningTask(null);
    }
  };

  // Narrative mode — fixed task menu, never freeform, same convention as storyline mode
  // above. Results are ephemeral for the same reason (structured diagnostics tied to the
  // current live scenario, not a conversation worth keeping).
  const [narrativeResults, setNarrativeResults] = React.useState<NarrativeResultEntry[]>([]);
  const [runningNarrativeTask, setRunningNarrativeTask] = React.useState<NarrativeTaskId | null>(null);

  const runNarrativeTask = async (taskId: NarrativeTaskId) => {
    const ctx = store.narrativeAskAiContext;
    if (!ctx) return;
    setRunningNarrativeTask(taskId);
    try {
      const res = await fetch(`/api/scenarios/${ctx.scenarioId}/narrative/ask-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskId }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data = await res.json();
      const entry: NarrativeResultEntry = { task: taskId, ts: Date.now(), ok: true };
      if (taskId === "check_fidelity") entry.fidelity = data as CheckNarrativeFidelityResult;
      else if (taskId === "regenerate_implications") entry.implications = data as GenerateImplicationsResult;
      else if (taskId === "stress_test_implications") entry.stressTest = data as StressTestImplicationsResult;
      else entry.indicators = data as GenerateIndicatorsResult;
      setNarrativeResults((r) => [entry, ...r]);
    } catch (err) {
      console.error("[ask-ai] narrative task failed", err);
      setNarrativeResults((r) => [{ task: taskId, ts: Date.now(), ok: false, error: "Something went wrong running that task." }, ...r]);
    } finally {
      setRunningNarrativeTask(null);
    }
  };

  // Strategy mode — fixed task menu, never freeform (freeform is strategyChatMessages below),
  // same convention as storyline/narrative modes above. Results are ephemeral for the same
  // reason (structured diagnostics tied to the current live options/scores, not a conversation
  // worth keeping) — except stress_test_option, which can have a real, persisted side effect
  // (ai-strategy-tasks.ts flips a score's robust flag when it finds a genuine failure mode);
  // the result card here is just the report of that, not the only record of it.
  const [strategyResults, setStrategyResults] = React.useState<StrategyResultEntry[]>([]);
  const [runningStrategyTask, setRunningStrategyTask] = React.useState<StrategyTaskId | null>(null);

  const runStrategyTask = async (taskId: StrategyTaskId) => {
    const projectId = store.activeProjectId;
    const ctx = store.strategyAskAiContext;
    if (!projectId) return;
    if (taskId === "stress_test_option" && !ctx?.selectedOption) return;
    if (taskId === "explain_non_robust" && !ctx?.selectedCell) return;
    setRunningStrategyTask(taskId);
    try {
      const body: { task: StrategyTaskId; optionId?: string; scenarioId?: string } = { task: taskId };
      if (taskId === "stress_test_option") body.optionId = ctx!.selectedOption!.id;
      if (taskId === "explain_non_robust") {
        body.optionId = ctx!.selectedCell!.optionId;
        body.scenarioId = ctx!.selectedCell!.scenarioId;
      }
      const res = await fetch(`/api/projects/${projectId}/strategy/ask-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data = await res.json();
      const entry: StrategyResultEntry = { task: taskId, ts: Date.now(), ok: true };
      if (taskId === "stress_test_option") entry.stressTest = data as StressTestOptionResult;
      else if (taskId === "explain_non_robust") entry.explanation = (data as { explanation: string }).explanation;
      else entry.hedge = data as SuggestHedgeResult;
      setStrategyResults((r) => [entry, ...r]);
    } catch (err) {
      console.error("[ask-ai] strategy task failed", err);
      setStrategyResults((r) => [{ task: taskId, ts: Date.now(), ok: false, error: "Something went wrong running that task." }, ...r]);
    } finally {
      setRunningStrategyTask(null);
    }
  };

  // Strategy's own "Ask anything…" — project-scoped (not scenario-scoped like Storyline/
  // Narrative's ScenarioChatPanel usage below), backed by askStrategyChat (ai-strategy-chat.ts).
  // Kept as its own message list/input rather than reusing scenarioChatMessages, since it can
  // carry a suggestedOption a signals-style "+ Add as option" button acts on, which
  // scenarioChatMessages' consumers never need. Resets whenever the active project changes, so
  // a grounded answer from one project never bleeds into another's conversation.
  const [strategyChatMessages, setStrategyChatMessages] = React.useState<ChatMsg[]>([]);
  const [strategyChatInput, setStrategyChatInput] = React.useState("");
  const [strategyChatThinking, setStrategyChatThinking] = React.useState(false);

  React.useEffect(() => {
    setStrategyChatMessages([]);
  }, [store.activeProjectId]);

  const sendStrategyChat = async (text?: string) => {
    const t = (text || strategyChatInput).trim();
    const projectId = store.activeProjectId;
    if (!t || !projectId) return;
    setStrategyChatMessages((m) => [...m, { role: "user", text: t }]);
    setStrategyChatInput("");
    setStrategyChatThinking(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: t }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data: StrategyChatResult = await res.json();
      setStrategyChatMessages((m) => [...m, { role: "ai", text: data.answer, cites: data.cites, suggestedOption: data.suggestedOption, suggestedForProjectId: projectId }]);
    } catch (err) {
      console.error("[ask-ai] strategy chat failed", err);
      setStrategyChatMessages((m) => [...m, { role: "ai", text: "Something went wrong answering that — try again." }]);
    } finally {
      setStrategyChatThinking(false);
    }
  };

  // Backing action for the "+ Add as option" button above — the one place a freeform Strategy
  // chat answer's external/inferred content can actually be written into the project, and only
  // ever after this explicit click, never automatically from sendStrategyChat itself.
  const onAddStrategyOption = async (index: number) => {
    const msg = strategyChatMessages[index];
    const suggestion = msg.suggestedOption;
    const projectId = store.activeProjectId;
    if (!suggestion || msg.added || msg.suggestedForProjectId !== projectId || !projectId) return;
    try {
      await createManualStrategicOption({
        projectId,
        name: suggestion.name,
        notes: `${suggestion.notes}\n\nRationale: ${suggestion.rationale}${
          suggestion.origin === "external_pattern" ? " (external pattern — not grounded in this project's own data; review before relying on it)" : ""
        }`,
      });
      setStrategyChatMessages((m) => m.map((msg, i) => (i === index ? { ...msg, added: true } : msg)));
    } catch (err) {
      console.error("[ask-ai] failed to add suggested strategic option", err);
    }
  };

  // Monitoring mode — fixed task menu, never freeform (freeform is monitoringChatMessages
  // below), same convention as Strategy above. Results are ephemeral diagnostics tied to the
  // current live indicators/readings, not a conversation worth keeping.
  const [monitoringResults, setMonitoringResults] = React.useState<MonitoringResultEntry[]>([]);
  const [runningMonitoringTask, setRunningMonitoringTask] = React.useState<MonitoringTaskId | null>(null);

  const runMonitoringTask = async (taskId: MonitoringTaskId) => {
    const projectId = store.activeProjectId;
    const ctx = store.monitoringAskAiContext;
    if (!projectId) return;
    if (taskId === "explain_indicator" && !ctx?.selectedIndicator) return;
    setRunningMonitoringTask(taskId);
    try {
      const body: { task: MonitoringTaskId; indicatorId?: string } = { task: taskId };
      if (taskId === "explain_indicator") body.indicatorId = ctx!.selectedIndicator!.id;
      const res = await fetch(`/api/projects/${projectId}/monitoring/ask-ai`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data = await res.json();
      const entry: MonitoringResultEntry = { task: taskId, ts: Date.now(), ok: true };
      if (taskId === "most_likely_scenario") entry.ranking = data as RankScenariosResult;
      else if (taskId === "explain_indicator") entry.explanation = data as ExplainIndicatorResult;
      else if (taskId === "recent_changes") entry.changes = data as RecentChangesResult;
      else entry.suggestion = data as SuggestIndicatorForScenarioResult;
      setMonitoringResults((r) => [entry, ...r]);
    } catch (err) {
      console.error("[ask-ai] monitoring task failed", err);
      setMonitoringResults((r) => [{ task: taskId, ts: Date.now(), ok: false, error: "Something went wrong running that task." }, ...r]);
    } finally {
      setRunningMonitoringTask(null);
    }
  };

  // Monitoring's own "Ask anything…" — project-scoped, backed by askMonitoringChat
  // (ai-monitoring-chat.ts). Resets whenever the active project changes, same convention as
  // strategyChatMessages.
  const [monitoringChatMessages, setMonitoringChatMessages] = React.useState<ChatMsg[]>([]);
  const [monitoringChatInput, setMonitoringChatInput] = React.useState("");
  const [monitoringChatThinking, setMonitoringChatThinking] = React.useState(false);

  React.useEffect(() => {
    setMonitoringChatMessages([]);
  }, [store.activeProjectId]);

  const sendMonitoringChat = async (text?: string) => {
    const t = (text || monitoringChatInput).trim();
    const projectId = store.activeProjectId;
    if (!t || !projectId) return;
    setMonitoringChatMessages((m) => [...m, { role: "user", text: t }]);
    setMonitoringChatInput("");
    setMonitoringChatThinking(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/monitoring/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: t }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data: MonitoringChatResult = await res.json();
      setMonitoringChatMessages((m) => [...m, { role: "ai", text: data.answer, cites: data.cites, suggestedIndicator: data.suggestedIndicator, suggestedForProjectId: projectId }]);
    } catch (err) {
      console.error("[ask-ai] monitoring chat failed", err);
      setMonitoringChatMessages((m) => [...m, { role: "ai", text: "Something went wrong answering that — try again." }]);
    } finally {
      setMonitoringChatThinking(false);
    }
  };

  // Backing action for the "+ Add indicator" button above — the one place a freeform
  // Monitoring chat answer's external/inferred content can actually be written into the
  // project, and only ever after this explicit click, never automatically from
  // sendMonitoringChat itself.
  const onAddMonitoringIndicator = async (index: number) => {
    const msg = monitoringChatMessages[index];
    const suggestion = msg.suggestedIndicator;
    const projectId = store.activeProjectId;
    if (!suggestion || msg.added || msg.suggestedForProjectId !== projectId || !projectId) return;
    try {
      await createManualIndicator({
        projectId,
        scenarioId: suggestion.scenarioId,
        name: suggestion.name,
        note: `${suggestion.notes}\n\nRationale: ${suggestion.rationale}${
          suggestion.origin === "external_pattern" ? " (external pattern — not grounded in this project's own data; review before relying on it)" : ""
        }`,
        triggerCondition: suggestion.triggerCondition,
      });
      setMonitoringChatMessages((m) => m.map((msg, i) => (i === index ? { ...msg, added: true } : msg)));
    } catch (err) {
      console.error("[ask-ai] failed to add suggested indicator", err);
    }
  };

  // "Ask anything…" alongside the fixed task menus above — shared between storyline and
  // narrative context since both are scoped to the same scenario and hit the same grounded
  // chat endpoint. Ephemeral like storylineResults/narrativeResults (not persisted to
  // localStorage): resets whenever the scoped scenario id changes, including switching
  // between the Storyline and Narrative pages for a DIFFERENT scenario — but a scenario
  // stays continuous across those two pages if it's the same one, since both draw the id
  // from the same underlying source (fm.storylineScenario).
  const scenarioChatScenarioId =
    context === "storyline" ? store.storylineAskAiContext?.scenarioId : context === "narrative" ? store.narrativeAskAiContext?.scenarioId : undefined;
  const [scenarioChatMessages, setScenarioChatMessages] = React.useState<ChatMsg[]>([]);
  const [scenarioChatInput, setScenarioChatInput] = React.useState("");
  const [scenarioChatThinking, setScenarioChatThinking] = React.useState(false);

  React.useEffect(() => {
    setScenarioChatMessages([]);
  }, [scenarioChatScenarioId]);

  const sendScenarioChat = async (text?: string) => {
    const t = (text || scenarioChatInput).trim();
    if (!t || !scenarioChatScenarioId) return;
    setScenarioChatMessages((m) => [...m, { role: "user", text: t }]);
    setScenarioChatInput("");
    setScenarioChatThinking(true);
    try {
      const res = await fetch(`/api/scenarios/${scenarioChatScenarioId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: t }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const data: { answer: string; cites: string[] } = await res.json();
      setScenarioChatMessages((m) => [...m, { role: "ai", text: data.answer, cites: data.cites }]);
    } catch (err) {
      console.error("[ask-ai] scenario chat failed", err);
      setScenarioChatMessages((m) => [...m, { role: "ai", text: "Something went wrong answering that — try again." }]);
    } finally {
      setScenarioChatThinking(false);
    }
  };

  const suggested = context === "signals" ? SIGNALS_SUGGESTED : SUGGESTED;
  const emptyGreetingCount = context === "signals" ? SIGNALS_INITIAL.length : INITIAL.length;

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
                <div className="font-mono text-[11px] tracking-[0.04em] text-text-3">
                  {context === "signals"
                    ? "SIGNALS MODE · GROUNDED IN YOUR SIGNALS"
                    : context === "storyline"
                      ? "STORYLINE MODE · SCOPED TASKS ONLY"
                      : context === "narrative"
                        ? "NARRATIVE MODE · SCOPED TASKS ONLY"
                        : context === "strategy"
                          ? "STRATEGY MODE · SCOPED TASKS + GROUNDED CHAT"
                          : context === "monitoring"
                            ? "MONITORING MODE · SCOPED TASKS + GROUNDED CHAT"
                            : "ANALYST · READING APAC EXPANSION 2030"}
                </div>
              </div>
              <button
                onClick={() => {
                  if (context === "storyline") setStorylineResults([]);
                  else if (context === "narrative") setNarrativeResults([]);
                  else if (context === "strategy") {
                    setStrategyResults([]);
                    setStrategyChatMessages([]);
                  } else if (context === "monitoring") {
                    setMonitoringResults([]);
                    setMonitoringChatMessages([]);
                  } else setMessages([{ role: "ai", text: "Cleared. What would you like to explore?" }]);
                }}
                title={
                  context === "storyline" || context === "narrative" || context === "strategy" || context === "monitoring" ? "Clear results" : "New conversation"
                }
                className="rounded-md border-0 bg-transparent p-1.5 text-text-3"
              >
                <Icons.Refresh size={14} />
              </button>
              <button onClick={() => setOpen(false)} title="Close · Esc" className="rounded-md border-0 bg-transparent p-1.5 text-text-3">
                <Icons.X size={16} />
              </button>
            </div>

            {context === "storyline" ? (
              // Fixed task menu, never freeform — no input bar at all for this mode (replaced,
              // not just hidden). Results render as cards below the menu, newest first.
              <div className="scroll-y flex flex-1 flex-col gap-2.5 p-4">
                <div className="flex flex-col gap-1.5">
                  <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">TASKS</div>
                  {STORYLINE_TASKS.map((t) => {
                    const pathEmpty = (store.storylineAskAiContext?.nodeIds.length ?? 0) === 0;
                    const disabled = !!runningTask || !store.storylineAskAiContext || (t.needsPath && pathEmpty);
                    return (
                      <button
                        key={t.id}
                        onClick={() => runStorylineTask(t.id)}
                        disabled={disabled}
                        title={t.needsPath && pathEmpty ? "Select a node to highlight a path first" : undefined}
                        className="rounded-[10px] border border-border bg-white px-3 py-2.5 text-left text-[12.5px] text-[#374151] transition-[border,background] duration-[120ms] hover:border-brand-orange100 hover:bg-brand-orangeLight disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {runningTask === t.id ? "Running…" : t.label}
                      </button>
                    );
                  })}
                </div>

                {storylineResults.length > 0 && (
                  <div className="mt-1 flex flex-col gap-2.5">
                    <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">RESULTS</div>
                    {storylineResults.map((r, i) => {
                      const label = STORYLINE_TASKS.find((t) => t.id === r.task)?.label ?? r.task;
                      const titleFor = (id: string) => store.storylineAskAiContext?.nodeTitleById[id] ?? id;
                      return (
                        <div key={i} className="rounded-[10px] border border-border bg-bg p-3 text-brand-dark">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[12.5px] font-semibold">{label}</span>
                            <span className="font-mono text-[10px] text-text-3">{new Date(r.ts).toLocaleTimeString()}</span>
                          </div>
                          {!r.ok && <div className="text-[12.5px] text-[#EF4444]">{r.error}</div>}
                          {r.ok && r.plausibility && (
                            <div className="text-[12.5px] leading-[1.5]">
                              <div className="mb-1 font-mono text-xs font-semibold text-brand-orange">{r.plausibility.score}%</div>
                              <p className="m-0 text-muted-foreground">{r.plausibility.rationale}</p>
                              {r.plausibility.weakLinks.length > 0 && (
                                <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                                  {r.plausibility.weakLinks.map((w, j) => (
                                    <li key={j} className="text-[11.5px] text-[#92400E]">
                                      — {titleFor(w.fromNodeId)} → {titleFor(w.toNodeId)}: {w.issue}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          {r.ok && r.chain && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {r.chain.findings.length === 0 ? (
                                <p className="m-0 text-muted-foreground">Not enough of a path selected to validate.</p>
                              ) : (
                                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                  {r.chain.findings.map((f, j) => (
                                    <li key={j} className={f.sound ? "text-[#065F46]" : "text-[#92400E]"}>
                                      {f.sound ? "✓" : "⚠"} {titleFor(f.fromNodeId)} → {titleFor(f.toNodeId)}
                                      {f.issue ? `: ${f.issue}` : ""}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                          {r.ok && r.missing && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {r.missing.thinChain && <p className="mb-1.5 text-[#92400E]">This chain is thin (fewer than 4 signals).</p>}
                              {r.missing.gaps.length === 0 ? (
                                <p className="m-0 text-muted-foreground">No gaps detected.</p>
                              ) : (
                                r.missing.gaps.map((g, j) => (
                                  <div key={j} className="mb-2">
                                    <div className="font-semibold">{g.phase.replace("_", "-")}</div>
                                    {!g.sufficientEvidence || g.candidates.length === 0 ? (
                                      <p className="m-0 text-muted-foreground">{g.gap || "No matching signals found."}</p>
                                    ) : (
                                      <ul className="m-0 flex list-none flex-col gap-1 p-0">
                                        {g.candidates.map((c) => (
                                          <li key={c.signalId}>
                                            — {c.title}: {c.rationale}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                          {r.ok && r.explanation !== undefined && (
                            <p className="m-0 text-[12.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">{r.explanation}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <ScenarioChatPanel
                  messages={scenarioChatMessages}
                  input={scenarioChatInput}
                  setInput={setScenarioChatInput}
                  thinking={scenarioChatThinking}
                  onSend={sendScenarioChat}
                />
              </div>
            ) : context === "narrative" ? (
              // Fixed task menu, never freeform — same structure as the storyline branch above.
              <div className="scroll-y flex flex-1 flex-col gap-2.5 p-4">
                <div className="flex flex-col gap-1.5">
                  <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">TASKS</div>
                  {NARRATIVE_TASKS.map((t) => {
                    const disabled = !!runningNarrativeTask || !store.narrativeAskAiContext;
                    return (
                      <button
                        key={t.id}
                        onClick={() => runNarrativeTask(t.id)}
                        disabled={disabled}
                        className="rounded-[10px] border border-border bg-white px-3 py-2.5 text-left text-[12.5px] text-[#374151] transition-[border,background] duration-[120ms] hover:border-brand-orange100 hover:bg-brand-orangeLight disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {runningNarrativeTask === t.id ? "Running…" : t.label}
                      </button>
                    );
                  })}
                </div>

                {narrativeResults.length > 0 && (
                  <div className="mt-1 flex flex-col gap-2.5">
                    <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">RESULTS</div>
                    {narrativeResults.map((r, i) => {
                      const label = NARRATIVE_TASKS.find((t) => t.id === r.task)?.label ?? r.task;
                      return (
                        <div key={i} className="rounded-[10px] border border-border bg-bg p-3 text-brand-dark">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[12.5px] font-semibold">{label}</span>
                            <span className="font-mono text-[10px] text-text-3">{new Date(r.ts).toLocaleTimeString()}</span>
                          </div>
                          {!r.ok && <div className="text-[12.5px] text-[#EF4444]">{r.error}</div>}

                          {r.ok && r.fidelity && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {!r.fidelity.hasNarrative || !r.fidelity.hasStoryline ? (
                                <p className="m-0 text-muted-foreground">
                                  {!r.fidelity.hasNarrative ? "This scenario has no narrative yet." : "This scenario has no storyline chain yet."}
                                </p>
                              ) : (
                                <>
                                  <div className="mb-1 font-mono text-xs font-semibold text-brand-orange">
                                    {r.fidelity.nodesCovered.filter((n) => n.covered).length}/{r.fidelity.nodesCovered.length} nodes covered
                                  </div>
                                  {r.fidelity.nodesCovered.some((n) => !n.covered) && (
                                    <ul className="m-0 mb-1.5 flex list-none flex-col gap-1 p-0">
                                      {r.fidelity.nodesCovered
                                        .filter((n) => !n.covered)
                                        .map((n, j) => (
                                          <li key={j} className="text-[11.5px] text-[#92400E]">
                                            — Missing: {n.note || n.nodeId}
                                          </li>
                                        ))}
                                    </ul>
                                  )}
                                  {!r.fidelity.causalOrderOk && (
                                    <p className="m-0 mb-1.5 text-[11.5px] text-[#92400E]">Out of order: {r.fidelity.orderIssue}</p>
                                  )}
                                  {r.fidelity.inventedDetails.length > 0 ? (
                                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                                      {r.fidelity.inventedDetails.map((d, j) => (
                                        <li key={j} className="text-[11.5px] text-[#EF4444]">
                                          — Invented: &quot;{d.text}&quot; ({d.note})
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="m-0 text-muted-foreground">No invented details found.</p>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          {r.ok && r.implications && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {r.implications.sufficientEvidence ? (
                                <p className="m-0 text-muted-foreground">Regenerated {r.implications.count} implication(s).</p>
                              ) : (
                                <p className="m-0 text-[#92400E]">{r.implications.gap}</p>
                              )}
                            </div>
                          )}

                          {r.ok && r.stressTest && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {r.stressTest.results.length === 0 ? (
                                <p className="m-0 text-muted-foreground">No implications yet to stress-test.</p>
                              ) : (
                                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                  {r.stressTest.results.map((res, j) => (
                                    <li key={j} className={res.scenarioSpecific ? "text-[#065F46]" : "text-[#92400E]"}>
                                      {res.scenarioSpecific ? "✓" : "⚠ generic —"} {res.text}
                                      <div className="text-[11.5px] text-muted-foreground">{res.rationale}</div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {r.ok && r.indicators && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {r.indicators.sufficientEvidence ? (
                                <p className="m-0 text-muted-foreground">Generated {r.indicators.count} indicator(s) — see Monitoring.</p>
                              ) : (
                                <p className="m-0 text-[#92400E]">{r.indicators.gap}</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <ScenarioChatPanel
                  messages={scenarioChatMessages}
                  input={scenarioChatInput}
                  setInput={setScenarioChatInput}
                  thinking={scenarioChatThinking}
                  onSend={sendScenarioChat}
                />
              </div>
            ) : context === "strategy" ? (
              // Fixed task menu, never freeform, PLUS the real "Ask anything…" freeform panel
              // below it (per this mode's own spec) — same structure as storyline/narrative's
              // menu-only branches above, extended with ScenarioChatPanel like both of those
              // already use for their own freeform half.
              <div className="scroll-y flex flex-1 flex-col gap-2.5 p-4">
                <div className="flex flex-col gap-1.5">
                  <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">TASKS</div>
                  {STRATEGY_TASKS.map((t) => {
                    const ctx = store.strategyAskAiContext;
                    const needsOptionUnmet = t.needsOption && !ctx?.selectedOption;
                    const needsCellUnmet = t.needsCell && !ctx?.selectedCell;
                    const disabled = !!runningStrategyTask || !store.activeProjectId || needsOptionUnmet || needsCellUnmet;
                    const title = needsOptionUnmet
                      ? "Open an option's detail view first"
                      : needsCellUnmet
                        ? "Click a non-robust (·) cell in the grid first"
                        : undefined;
                    return (
                      <button
                        key={t.id}
                        onClick={() => runStrategyTask(t.id)}
                        disabled={disabled}
                        title={title}
                        className="rounded-[10px] border border-border bg-white px-3 py-2.5 text-left text-[12.5px] text-[#374151] transition-[border,background] duration-[120ms] hover:border-brand-orange100 hover:bg-brand-orangeLight disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {runningStrategyTask === t.id ? "Running…" : t.label}
                      </button>
                    );
                  })}
                </div>

                {strategyResults.length > 0 && (
                  <div className="mt-1 flex flex-col gap-2.5">
                    <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">RESULTS</div>
                    {strategyResults.map((r, i) => {
                      const label = STRATEGY_TASKS.find((t) => t.id === r.task)?.label ?? r.task;
                      return (
                        <div key={i} className="rounded-[10px] border border-border bg-bg p-3 text-brand-dark">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[12.5px] font-semibold">{label}</span>
                            <span className="font-mono text-[10px] text-text-3">{new Date(r.ts).toLocaleTimeString()}</span>
                          </div>
                          {!r.ok && <div className="text-[12.5px] text-[#EF4444]">{r.error}</div>}

                          {r.ok && r.stressTest && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {r.stressTest.findings.length === 0 ? (
                                <p className="m-0 text-muted-foreground">This option isn&apos;t marked robust in any scenario yet — nothing to stress-test.</p>
                              ) : (
                                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                                  {r.stressTest.findings.map((f, j) => (
                                    <li key={j} className={f.revised ? "text-[#92400E]" : "text-[#065F46]"}>
                                      {f.revised ? "⚠ now flagged not robust —" : "✓ confirmed robust —"} {f.scenarioName}
                                      <div className="text-[11.5px] text-muted-foreground">{f.rationale}</div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {r.ok && r.explanation !== undefined && (
                            <p className="m-0 text-[12.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">{r.explanation}</p>
                          )}

                          {r.ok && r.hedge && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {!r.hedge.sufficientEvidence || !r.hedge.suggestion ? (
                                <p className="m-0 text-muted-foreground">{r.hedge.gap || "No grounded hedge suggestion available."}</p>
                              ) : (
                                <>
                                  {r.hedge.targetScenarioName && (
                                    <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-brand-orange">
                                      Weakest coverage: {r.hedge.targetScenarioName}
                                    </div>
                                  )}
                                  <div className="mb-1 text-[13px] font-semibold">{r.hedge.suggestion.name}</div>
                                  <p className="m-0 mb-1 text-muted-foreground">{r.hedge.suggestion.notes}</p>
                                  <p className="m-0 italic text-muted-foreground">{r.hedge.suggestion.rationale}</p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <ScenarioChatPanel
                  messages={strategyChatMessages}
                  input={strategyChatInput}
                  setInput={setStrategyChatInput}
                  thinking={strategyChatThinking}
                  onSend={sendStrategyChat}
                  onAddOption={onAddStrategyOption}
                  activeProjectId={store.activeProjectId}
                />
              </div>
            ) : context === "monitoring" ? (
              // Fixed task menu, never freeform, PLUS the real "Ask anything…" freeform panel
              // below it — same structure as the strategy branch above.
              <div className="scroll-y flex flex-1 flex-col gap-2.5 p-4">
                <div className="flex flex-col gap-1.5">
                  <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">TASKS</div>
                  {MONITORING_TASKS.map((t) => {
                    const ctx = store.monitoringAskAiContext;
                    const needsIndicatorUnmet = t.needsIndicator && !ctx?.selectedIndicator;
                    const disabled = !!runningMonitoringTask || !store.activeProjectId || needsIndicatorUnmet;
                    const title = needsIndicatorUnmet ? "Click an indicator row on the Monitoring page first" : undefined;
                    return (
                      <button
                        key={t.id}
                        onClick={() => runMonitoringTask(t.id)}
                        disabled={disabled}
                        title={title}
                        className="rounded-[10px] border border-border bg-white px-3 py-2.5 text-left text-[12.5px] text-[#374151] transition-[border,background] duration-[120ms] hover:border-brand-orange100 hover:bg-brand-orangeLight disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {runningMonitoringTask === t.id ? "Running…" : t.label}
                      </button>
                    );
                  })}
                </div>

                {monitoringResults.length > 0 && (
                  <div className="mt-1 flex flex-col gap-2.5">
                    <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">RESULTS</div>
                    {monitoringResults.map((r, i) => {
                      const label = MONITORING_TASKS.find((t) => t.id === r.task)?.label ?? r.task;
                      return (
                        <div key={i} className="rounded-[10px] border border-border bg-bg p-3 text-brand-dark">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[12.5px] font-semibold">{label}</span>
                            <span className="font-mono text-[10px] text-text-3">{new Date(r.ts).toLocaleTimeString()}</span>
                          </div>
                          {!r.ok && <div className="text-[12.5px] text-[#EF4444]">{r.error}</div>}

                          {r.ok && r.ranking && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {!r.ranking.sufficientEvidence || !r.ranking.topScenarioName ? (
                                <p className="m-0 text-muted-foreground">{r.ranking.gap || "Not enough data to rank scenarios yet."}</p>
                              ) : (
                                <>
                                  <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-brand-orange">
                                    Most likely: {r.ranking.topScenarioName}
                                  </div>
                                  <p className="m-0 text-muted-foreground">{r.ranking.rationale}</p>
                                </>
                              )}
                            </div>
                          )}

                          {r.ok && r.explanation && (
                            <p className="m-0 text-[12.5px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">{r.explanation.explanation}</p>
                          )}

                          {r.ok && r.changes && (
                            <div className="text-[12.5px] leading-[1.5]">
                              <p className="m-0 text-muted-foreground">{r.changes.summary}</p>
                              {r.changes.changes.length > 0 && (
                                <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0">
                                  {r.changes.changes.map((c, j) => (
                                    <li key={j} className="text-[11.5px] text-text-3">
                                      {c.indicatorName}: {c.fromStatus} → {c.toStatus} ({c.date})
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}

                          {r.ok && r.suggestion && (
                            <div className="text-[12.5px] leading-[1.5]">
                              {!r.suggestion.sufficientEvidence || !r.suggestion.generateResult ? (
                                <p className="m-0 text-muted-foreground">{r.suggestion.gap || "Nothing to suggest right now."}</p>
                              ) : (
                                <>
                                  <div className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.04em] text-brand-orange">
                                    Target: {r.suggestion.targetScenarioName}
                                  </div>
                                  <p className="m-0 text-muted-foreground">
                                    {r.suggestion.generateResult.sufficientEvidence
                                      ? `Generated ${r.suggestion.generateResult.count} indicator(s).`
                                      : r.suggestion.generateResult.gap || "The model found insufficient evidence."}
                                  </p>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <ScenarioChatPanel
                  messages={monitoringChatMessages}
                  input={monitoringChatInput}
                  setInput={setMonitoringChatInput}
                  thinking={monitoringChatThinking}
                  onSend={sendMonitoringChat}
                  onAddIndicator={onAddMonitoringIndicator}
                  activeProjectId={store.activeProjectId}
                />
              </div>
            ) : (
              <>
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
                  {m.suggestedSignal && (
                    <div className="mt-2.5 rounded-[10px] border border-border bg-white p-3 text-brand-dark">
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <Chip category={m.suggestedSignal.category} />
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                            m.suggestedSignal.groundedIn.length > 0 ? "bg-[#ECFDF5] text-[#065F46]" : "bg-brand-orangeLight text-brand-orange700"
                          )}
                        >
                          {m.suggestedSignal.groundedIn.length > 0
                            ? `Grounded in ${m.suggestedSignal.groundedIn.length} insight${m.suggestedSignal.groundedIn.length === 1 ? "" : "s"}`
                            : "External pattern — review before adding"}
                        </span>
                      </div>
                      <div className="mb-1 text-[13px] font-semibold leading-[1.3]">{m.suggestedSignal.title}</div>
                      <div className="mb-2.5 text-[12.5px] leading-[1.5] text-muted-foreground">{m.suggestedSignal.body}</div>
                      <Button
                        variant={m.added ? "ghost" : "soft"}
                        size="sm"
                        className="w-full"
                        disabled={m.added || m.suggestedForProjectId !== store.activeProjectId}
                        onClick={() => onAddSignal(i)}
                      >
                        {m.added
                          ? "Added to Signals ✓"
                          : m.suggestedForProjectId !== store.activeProjectId
                            ? "Switched projects — can't add"
                            : "+ Add to Signals"}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {thinking && (
                <div className="flex items-center gap-1.5 self-start rounded-xl bg-bg px-3 py-2.5">
                  <Dot delay={0} />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </div>
              )}

              {messages.length <= emptyGreetingCount && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="mb-0.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">SUGGESTED</div>
                  {suggested.map((s) => (
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
              </>
            )}
          </aside>
        </>
      )}

      <style>{`@keyframes blink { 0%, 80%, 100% { opacity: 0.2; } 40% { opacity: 1; } }`}</style>
    </>
  );
}
