"use client";

// Storyline supporting pieces — side panel, toast, empty state, column header,
// arrow popover, endpoint handle, quadrant mini, onboarding tooltip.
// Faithful port of the handoff page-storyline.jsx; dynamic/computed bits stay inline.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { FM_DATA } from "@/lib/data";
import type { Quadrant, Scenario, Signal } from "@/lib/types";
import type { Database } from "@/lib/supabase/types";
import { PHASES } from "@/lib/storyline-mapping";
import { findSignalForGap, type FindSignalCandidate } from "@/lib/actions/ai-storyline";
import {
  CARD_W,
  RELATIONSHIPS,
  CONFIDENCES,
  DEFAULT_COLUMN_LABELS,
  QUADRANT_LABELS,
  type StoryNode,
  type StoryEdge,
} from "./data";

type PlausibilityCheckRow = Database["public"]["Tables"]["plausibility_checks"]["Row"];
type SignpostRow = Database["public"]["Tables"]["signposts"]["Row"];

export function Divider() {
  return <div className="my-[18px] h-px bg-border" />;
}

export function QuadrantMini({ active = "TR", color = "#F97316" }: { active?: Quadrant; color?: string }) {
  const cells: Quadrant[] = ["TL", "TR", "BL", "BR"];
  return (
    <div
      className="grid h-9 w-9 flex-shrink-0 grid-cols-2 grid-rows-2 gap-0.5 rounded-md border border-border bg-white p-0.5"
      aria-label={`Quadrant ${active} active`}
    >
      {cells.map((q) => (
        <div key={q} className="rounded-[2px]" style={{ background: q === active ? color : "#F3F4F6" }} />
      ))}
    </div>
  );
}

export function EndpointHandle({
  cx,
  cy,
  onPointerDown,
  title,
}: {
  cx: number;
  cy: number;
  onPointerDown: (e: React.PointerEvent) => void;
  title: string;
}) {
  return (
    <div
      title={title}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-[14] h-3 w-3 rounded-full border-2 border-brand-orange bg-white shadow-[0_1px_3px_rgba(15,23,42,0.10)]"
      style={{ left: cx - 6, top: cy - 6, cursor: "grab", touchAction: "none" }}
    />
  );
}

export interface StorylineToastState {
  msg: string;
  kind: "success" | "error";
  ts: number;
}

export function StorylineToast({ toast }: { toast: StorylineToastState | null }) {
  if (!toast) return null;
  const isError = toast.kind === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      key={toast.ts}
      className={cn(
        "fm-toast-in fixed bottom-6 right-6 z-[200] inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-medium tracking-[-0.005em] shadow-[0_10px_30px_rgba(15,23,42,0.18),0_2px_6px_rgba(15,23,42,0.10)]",
        isError ? "border-[#FECACA] bg-[#FEF2F2] text-[#EF4444]" : "border-brand-ink2 bg-brand-dark text-white"
      )}
    >
      {isError ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {toast.msg}
    </div>
  );
}

export function ColumnHeader({
  index,
  label,
  range,
  desc,
  scenarioColor,
  onChange,
}: {
  index: number;
  label: string;
  range: string;
  desc: string;
  scenarioColor: string;
  onChange: (v: string) => void;
}) {
  const [hover, setHover] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [draft, setDraft] = React.useState(label);
  React.useEffect(() => {
    setDraft(label);
  }, [label]);

  return (
    <div className="relative">
      <div className="mb-1.5 flex items-center gap-2.5">
        <span
          className="inline-flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold text-white"
          style={{ background: scenarioColor }}
        >
          {index + 1}
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false);
            const v = (draft || "").trim() || DEFAULT_COLUMN_LABELS[index];
            setDraft(v);
            if (v !== label) onChange(v);
          }}
          onFocus={() => setFocused(true)}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(label);
              e.currentTarget.blur();
            }
          }}
          spellCheck={false}
          aria-label={`Column ${index + 1} label`}
          className="-mx-1 -my-0.5 min-w-0 flex-1 cursor-text rounded border-0 bg-transparent px-1 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.6px] text-muted-foreground outline-none transition-shadow duration-[120ms]"
          style={{
            boxShadow: focused ? "inset 0 -1px 0 #F97316" : hover ? "inset 0 -1px 0 #D1D5DB" : "none",
          }}
        />
        {(hover || focused) && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none flex-shrink-0">
            <path d="M 12 20 h 9" />
            <path d="M 16.5 3.5 a 2.121 2.121 0 0 1 3 3 L 7 19 l -4 1 1 -4 L 16.5 3.5 z" />
          </svg>
        )}
      </div>
      <div className="mb-0.5 pl-8 font-mono text-[11px] text-text-3">{range}</div>
      <div className="pl-8 text-[12.5px] leading-[1.45] text-muted-foreground">{desc}</div>
    </div>
  );
}

export function ArrowPopover({
  edge,
  x,
  y,
  containerWidth,
  onChange,
  onRemove,
  onClose,
}: {
  edge: StoryEdge;
  x: number;
  y: number;
  containerWidth: number;
  onChange: (patch: Partial<StoryEdge>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const POP_W = 260;

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = setTimeout(() => window.addEventListener("mousedown", onDown), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const left = Math.max(8, Math.min((containerWidth || 1700) - POP_W - 8, x - POP_W / 2));
  const top = y + 14;

  return (
    <div
      ref={ref}
      className="slide-up absolute z-40 rounded-xl border border-border bg-white p-3.5 shadow-[0_10px_30px_rgba(15,23,42,0.10),0_2px_6px_rgba(15,23,42,0.06)]"
      onClick={(e) => e.stopPropagation()}
      style={{ left, top, width: POP_W }}
    >
      {/* Pointer notch */}
      <div
        className="absolute h-3 w-3 rotate-45 border-l border-t border-border bg-white"
        style={{ left: Math.min(POP_W - 24, Math.max(12, x - left - 6)), top: -7 }}
      />

      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-3">Connection</span>
        <button onClick={onClose} aria-label="Close" className="flex rounded border-0 bg-transparent p-0.5 text-text-3">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>
      </div>

      {/* Relationship dropdown */}
      <label className="mb-[5px] block text-[11px] font-medium text-muted-foreground">Relationship</label>
      <div className="relative mb-3">
        <select
          value={edge.relationship || "Leads to"}
          onChange={(e) => onChange({ relationship: e.target.value })}
          className="w-full cursor-pointer appearance-none rounded-md border border-border bg-white py-2 pl-[11px] pr-[30px] text-[13px] text-brand-dark outline-none"
        >
          {RELATIONSHIPS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-[11px] top-1/2 -translate-y-1/2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* Confidence segmented */}
      <label className="mb-[5px] block text-[11px] font-medium text-muted-foreground">Confidence</label>
      <div className="mb-3 grid grid-cols-3 gap-0 rounded-md bg-[#F3F4F6] p-0.5">
        {CONFIDENCES.map((c) => {
          const active = (edge.confidence || "Moderate") === c;
          return (
            <button
              key={c}
              onClick={() => onChange({ confidence: c })}
              className={cn(
                "rounded-md border-0 px-2 py-1.5 text-xs transition-[background,color] duration-[120ms]",
                active ? "bg-white font-semibold text-brand-dark shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "bg-transparent font-medium text-muted-foreground"
              )}
            >
              {c}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] text-text-3">
          {edge.from} → {edge.to}
        </span>
        <button
          onClick={onRemove}
          className="inline-flex items-center gap-[5px] border-0 bg-transparent px-0.5 py-1 text-xs font-medium text-[#EF4444]"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M 19 6 l -1 14 a 2 2 0 0 1 -2 2 H 8 a 2 2 0 0 1 -2 -2 L 5 6" />
            <path d="M 10 11 v 6" />
            <path d="M 14 11 v 6" />
          </svg>
          Remove connection
        </button>
      </div>
    </div>
  );
}

function EmptyChainIllustration() {
  return (
    <svg width="220" height="120" viewBox="0 0 220 120" fill="none" aria-hidden>
      <defs>
        <filter id="emptyShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dy="2" result="off" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.18" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="110" cy="62" r="58" stroke="#FFF7ED" strokeWidth="1.5" fill="none" />
      <circle cx="110" cy="62" r="40" stroke="#FED7AA" strokeWidth="1" strokeDasharray="2 4" fill="none" opacity="0.7" />
      <path d="M 36 78 C 60 30, 95 30, 110 60 C 125 90, 160 90, 184 42" stroke="#F97316" strokeWidth="2" fill="none" strokeLinecap="round" filter="url(#emptyShadow)" />
      <path d="M 180 38 L 189 40 L 184 47 Z" fill="#F97316" />
      <g filter="url(#emptyShadow)">
        <circle cx="36" cy="78" r="11" fill="#FFF7ED" stroke="#F97316" strokeWidth="2" />
        <circle cx="110" cy="60" r="13" fill="#FFF7ED" stroke="#F97316" strokeWidth="2" />
        <circle cx="184" cy="42" r="11" fill="#FFF7ED" stroke="#F97316" strokeWidth="2" />
      </g>
      <circle cx="36" cy="78" r="3" fill="#F97316" />
      <circle cx="110" cy="60" r="3.5" fill="#F97316" />
      <circle cx="184" cy="42" r="3" fill="#F97316" />
    </svg>
  );
}

export interface StorylineEmptyStateProps {
  status: "empty" | "generating" | "failed";
  errorMessage?: string | null;
  onGenerate: () => void;
  onBrowseLibrary: () => void;
}

export function StorylineEmptyState({ status, errorMessage, onGenerate, onBrowseLibrary }: StorylineEmptyStateProps) {
  if (status === "generating") {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-[60px]">
        <div className="slide-up flex w-full max-w-[480px] flex-col items-center text-center">
          <Icons.Refresh size={32} className="animate-spin" stroke="#F97316" />
          <h3 className="mb-2 mt-5 text-xl font-semibold tracking-[-0.01em] text-brand-dark">Generating your storyline</h3>
          <p className="m-0 max-w-[420px] text-sm leading-[1.55] text-muted-foreground [text-wrap:pretty]">
            Building the causal chain and researching current plausibility — this can take a minute or two.
          </p>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex min-h-full items-center justify-center px-6 py-[60px]">
        <div className="slide-up flex w-full max-w-[480px] flex-col items-center text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h3 className="mb-2 mt-5 text-xl font-semibold tracking-[-0.01em] text-brand-dark">Storyline generation failed</h3>
          <p className="m-0 max-w-[420px] text-sm leading-[1.55] text-muted-foreground [text-wrap:pretty]">
            {errorMessage || "Something went wrong while generating this storyline."}
          </p>
          <button
            onClick={onGenerate}
            className="mt-[22px] inline-flex items-center gap-2 rounded-md border-0 bg-brand-orange px-4 py-2.5 text-[13.5px] font-semibold text-white transition-[background] duration-[120ms] hover:bg-brand-orangeHover"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6 py-[60px]">
      <div className="slide-up flex w-full max-w-[480px] flex-col items-center text-center">
        <EmptyChainIllustration />
        <h3 className="mb-2.5 mt-[26px] text-2xl font-semibold tracking-[-0.01em] text-brand-dark [text-wrap:balance]">
          Build your scenario storyline
        </h3>
        <p className="m-0 max-w-[420px] text-sm leading-[1.55] text-muted-foreground [text-wrap:pretty]">
          Drag signals from your library to show how this future unfolds. Connect them with arrows to map cause and
          effect.
        </p>
        <div className="mt-[22px] flex flex-wrap justify-center gap-2.5">
          <button
            onClick={onBrowseLibrary}
            className="inline-flex items-center gap-2 rounded-md border-0 bg-brand-orange px-4 py-2.5 text-[13.5px] font-semibold text-white transition-[background,transform] duration-[120ms] hover:bg-brand-orangeHover"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            Browse Signals Library
          </button>
          <button
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-4 py-2.5 text-[13.5px] font-medium text-brand-dark transition-[border,background] duration-[120ms] hover:border-border-strong hover:bg-[#FAFAFA]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 z" />
              <path d="M19 17 L19.8 19.2 L22 20 L19.8 20.8 L19 23 L18.2 20.8 L16 20 L18.2 19.2 z" />
            </svg>
            Generate storyline
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingTooltip({
  anchor,
  onDismiss,
}: {
  anchor: { left: number; right: number; top: number; bottom: number; midY: number };
  onDismiss: () => void;
}) {
  const TIP_W = 240;
  return (
    <div
      role="dialog"
      className="slide-up absolute z-30 rounded-[10px] bg-brand-dark p-3 text-xs leading-[1.5] text-white shadow-[0_10px_30px_rgba(15,23,42,0.18),0_2px_8px_rgba(15,23,42,0.10)]"
      style={{ left: anchor.right + 14, top: anchor.top - 6, width: TIP_W }}
    >
      <span aria-hidden className="absolute left-[-6px] top-[18px] h-3 w-3 rotate-45 rounded-[2px] bg-brand-dark" />
      <div className="flex items-start gap-2">
        <div className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-md bg-brand-orange/[0.18] text-[#FDBA74]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        </div>
        <div className="min-w-0 flex-1 pr-3.5">
          <div className="mb-0.5 text-[12.5px] font-semibold text-white">Connect this signal</div>
          <div className="text-[#D1D5DB]">
            Drag from the right edge to connect this signal to another. Build the causal chain that leads to your
            scenario.
          </div>
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss tooltip"
        className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-[5px] border-0 bg-transparent text-text-3 hover:bg-white/[0.08] hover:text-white"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="6" y1="18" x2="18" y2="6" />
        </svg>
      </button>
    </div>
  );
}

/* ─────────────────────── Side panel ─────────────────────── */

export interface StorylineSidePanelProps {
  open: boolean;
  onToggle: () => void;
  scenario: Scenario;
  scenarioId: string;
  nodes: StoryNode[];
  edges: StoryEdge[];
  plausibility: PlausibilityCheckRow | null;
  onRefreshGrounding: () => void;
  refreshing: boolean;
  signposts: SignpostRow[];
  showToast: (msg: string, kind?: "success" | "error") => void;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function StorylineSidePanel({
  open,
  onToggle,
  scenario,
  scenarioId,
  nodes,
  edges,
  plausibility,
  onRefreshGrounding,
  refreshing,
  signposts,
  showToast,
}: StorylineSidePanelProps) {
  const [reaxReview, setReaxReview] = React.useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("fm.reaxReview") || "[]");
    } catch {
      return [];
    }
  });
  React.useEffect(() => {
    const sync = () => {
      try {
        setReaxReview(JSON.parse(localStorage.getItem("fm.reaxReview") || "[]"));
      } catch {}
    };
    window.addEventListener("fm:persist", sync);
    return () => window.removeEventListener("fm:persist", sync);
  }, []);
  const allSignals: Signal[] = FM_DATA.signals;
  const reviewSignals = reaxReview.map((id) => allSignals.find((s) => s.id === id)).filter(Boolean) as Signal[];
  const clearReview = (id: string) => {
    const next = reaxReview.filter((x) => x !== id);
    setReaxReview(next);
    try {
      localStorage.setItem("fm.reaxReview", JSON.stringify(next));
    } catch {}
  };
  const quadrantLabel = QUADRANT_LABELS[scenario.quadrant] || "Critical";

  const backwardEdges = edges.filter((e) => {
    const a = nodes.find((n) => n.id === e.from);
    const b = nodes.find((n) => n.id === e.to);
    if (!a || !b) return false;
    return PHASES.indexOf(a.phase as (typeof PHASES)[number]) > PHASES.indexOf(b.phase as (typeof PHASES)[number]);
  });

  // First empty phase that a later, populated phase implies should have had something —
  // the one gap "Find signals" targets. No interior gap (chain empty, or every phase
  // populated) means nothing to search for.
  const presentPhases = new Set(nodes.map((n) => n.phase));
  const gapPhaseIdx = PHASES.findIndex((p, i) => !presentPhases.has(p) && PHASES.slice(i + 1).some((later) => presentPhases.has(later)));
  const gapPhase = gapPhaseIdx >= 0 ? PHASES[gapPhaseIdx] : null;

  const [gapLoading, setGapLoading] = React.useState(false);
  const [gapCandidates, setGapCandidates] = React.useState<FindSignalCandidate[] | null>(null);
  const [gapMessage, setGapMessage] = React.useState<string | null>(null);
  React.useEffect(() => {
    setGapCandidates(null);
    setGapMessage(null);
  }, [gapPhase]);

  const runFindSignals = async () => {
    if (!gapPhase) return;
    setGapLoading(true);
    setGapCandidates(null);
    setGapMessage(null);
    try {
      const result = await findSignalForGap({
        scenarioId,
        phase: gapPhase,
        gapDescription: `No signals are placed in the ${gapPhase.replace("_", "-")} phase yet, between phases that do have signals.`,
      });
      if (!result.sufficientEvidence || result.candidates.length === 0) {
        setGapMessage(result.gap || "No matching signals found for this gap.");
      } else {
        setGapCandidates(result.candidates);
      }
    } catch (err) {
      console.error("[storyline] find-signal-for-gap failed", err);
      showToast("Couldn't search for signals", "error");
    } finally {
      setGapLoading(false);
    }
  };

  if (!open) {
    return (
      <aside className="flex w-10 flex-shrink-0 flex-col items-center border-l border-border bg-white pt-4">
        <button
          onClick={onToggle}
          title="Expand context panel"
          aria-label="Expand context panel"
          className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-border bg-white text-muted-foreground"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="mt-3.5 font-mono text-[10.5px] uppercase tracking-[0.6px] text-text-3 [writing-mode:vertical-rl] [transform:rotate(180deg)]">
          Scenario context
        </div>
      </aside>
    );
  }

  return (
    <aside className="scroll-y slide-up relative w-[300px] flex-shrink-0 overflow-auto border-l border-border bg-white p-5">
      <button
        onClick={onToggle}
        title="Collapse panel"
        aria-label="Collapse context panel"
        className="absolute right-3.5 top-3.5 z-[2] flex h-[26px] w-[26px] items-center justify-center rounded-md border border-border bg-white text-muted-foreground"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* 1. Scenario header */}
      <section className="pr-[30px]">
        <div className="font-mono text-[11px] font-semibold uppercase tracking-[0.6px] text-brand-orange">Scenario</div>
        <h3 className="mb-2.5 mt-1 text-[18px] font-semibold leading-[1.25] tracking-[-0.01em] text-brand-dark">{scenario.name}</h3>
        <div className="flex items-start gap-2.5">
          <QuadrantMini active={scenario.quadrant} color={scenario.color} />
          <div className="flex-1 text-xs leading-[1.45] text-muted-foreground">
            From <span className="font-medium text-brand-dark">{quadrantLabel}</span> quadrant
            {(scenario.axisA?.label || scenario.axisB?.label) && (
              <div className="mt-0.5 text-text-3">
                ({scenario.axisA?.label || "—"} × {scenario.axisB?.label || "—"})
              </div>
            )}
          </div>
        </div>
      </section>

      <Divider />

      {/* 2. Plausibility */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-brand-dark">Plausibility</span>
          <span className="font-mono text-xs font-semibold text-brand-orange">{plausibility ? `${plausibility.score}%` : "—"}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-brand-orange transition-[width] duration-[600ms] ease-[cubic-bezier(.4,.0,.2,1)]"
            style={{ width: (plausibility?.score ?? 0) + "%" }}
          />
        </div>
        {plausibility ? (
          <>
            <p className="mt-2 text-xs leading-[1.5] text-muted-foreground [text-wrap:pretty]">{plausibility.rationale}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[10.5px] text-text-3">Checked {timeAgo(plausibility.checked_at)}</span>
              <button
                onClick={onRefreshGrounding}
                disabled={refreshing}
                className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[12px] font-medium text-brand-orange disabled:opacity-50"
              >
                <Icons.Refresh size={11} className={refreshing ? "animate-spin" : undefined} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-text-3">Not yet checked.</span>
            <button
              onClick={onRefreshGrounding}
              disabled={refreshing}
              className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[12px] font-medium text-brand-orange disabled:opacity-50"
            >
              <Icons.Refresh size={11} className={refreshing ? "animate-spin" : undefined} />
              {refreshing ? "Checking…" : "Check plausibility"}
            </button>
          </div>
        )}
      </section>

      <Divider />

      {/* 3. Signposts to watch */}
      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.6px] text-muted-foreground">Signposts to watch</span>
          <span className="text-[11px] text-text-3">{signposts.length}</span>
        </div>
        {signposts.length === 0 ? (
          <div className="py-1 text-[11.5px] text-text-3">None yet — refresh plausibility to generate some.</div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {signposts.map((sp) => {
              const citations = Array.isArray(sp.citations) ? (sp.citations as { title?: string; url?: string }[]) : [];
              const citation = citations[0];
              return (
                <li key={sp.id} className="flex gap-2.5">
                  <Icons.Eye size={16} stroke="#F97316" className="mt-px flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] leading-[1.4] text-brand-dark [text-wrap:pretty]">{sp.name}</div>
                    {citation?.url && (
                      <a
                        href={citation.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 block truncate text-[11px] text-brand-orange hover:underline"
                      >
                        {citation.title || citation.url}
                      </a>
                    )}
                    <span className="mt-[5px] inline-block rounded-full bg-bg px-[7px] py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                      {sp.status}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Divider />

      {/* 4. Gaps in chain */}
      <section>
        <div className="mb-2.5 font-mono text-xs font-semibold uppercase tracking-[0.6px] text-muted-foreground">Gaps in chain</div>

        {reviewSignals.length > 0 && (
          <div className="mb-2.5 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-[#F59E0B]" />
              <span className="text-xs font-semibold text-[#92400E]">
                {reviewSignals.length} signal{reviewSignals.length === 1 ? "" : "s"} need review
              </span>
            </div>
            <div className="mb-1.5 text-xs leading-[1.5] text-[#78350F]">
              Re-axis couldn&apos;t place these confidently. Drag them into the right column, then mark resolved.
            </div>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {reviewSignals.map((s) => (
                <li key={s.id} className="flex items-center gap-1.5 text-[11.5px] text-[#92400E]">
                  <span className="flex-1 truncate">— {s.title}</span>
                  <button onClick={() => clearReview(s.id)} className="flex-shrink-0 border-0 bg-transparent text-[11px] font-medium text-[#B45309]">
                    Resolve
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {backwardEdges.length > 0 && (
          <div className="mb-2.5 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span className="text-xs font-semibold text-[#92400E]">
                {backwardEdges.length} backward connection{backwardEdges.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="text-xs leading-[1.5] text-[#78350F]">
              These arrows point earlier in causal time. Common when a feedback loop or late-stage signal influences a
              precursor.
            </div>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
              {backwardEdges.slice(0, 3).map((e) => {
                const a = nodes.find((n) => n.id === e.from);
                const b = nodes.find((n) => n.id === e.to);
                return (
                  <li key={e.from + ">" + e.to} className="truncate font-mono text-[11.5px] tracking-[0.01em] text-[#92400E]">
                    — {((a && a.title) || e.from).slice(0, 22)} → {((b && b.title) || e.to).slice(0, 22)}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {gapPhase && (
          <div className="rounded-[10px] border border-brand-orange100 bg-brand-orangeLight p-3">
            <div className="mb-1.5 flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span className="text-xs font-semibold tracking-[-0.005em] text-brand-orange700">Gap detected</span>
            </div>
            <div className="text-[12.5px] leading-[1.5] text-[#7C2D12] [text-wrap:pretty]">
              No signals are placed in the <strong className="font-semibold text-brand-dark">{gapPhase.replace("_", "-")}</strong> phase yet.
            </div>
            <button
              onClick={runFindSignals}
              disabled={gapLoading}
              className="mt-2.5 inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[13px] font-semibold text-brand-orange disabled:opacity-50"
            >
              {gapLoading ? "Searching…" : "Find signals"}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>

            {gapMessage && <div className="mt-2 text-[11.5px] text-[#7C2D12]">{gapMessage}</div>}

            {gapCandidates && gapCandidates.length > 0 && (
              <ul className="m-0 mt-2.5 flex list-none flex-col gap-2 border-t border-brand-orange100 p-0 pt-2.5">
                {gapCandidates.map((c) => (
                  <li key={c.signalId}>
                    <div className="text-[12.5px] font-semibold text-brand-dark">{c.title}</div>
                    <div className="text-[11.5px] leading-[1.4] text-[#7C2D12]">{c.rationale}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </aside>
  );
}

export { CARD_W };
