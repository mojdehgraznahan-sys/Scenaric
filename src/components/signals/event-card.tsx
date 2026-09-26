"use client";

// Signals page "Events" view — EventCard front/back, ported from the design prototype's
// components/events.jsx. Two deliberate substitutions vs. the literal prototype: production's
// existing Stars/Chip components instead of the prototype's raw SVG/`.chip-*` classes, and
// the existing severity-badge treatment (event-shared.ts) instead of new `.badge-high/mid/low`
// CSS classes — both already established production styles, reused per the build plan's own
// "reuse existing styles" instruction.
import { cn } from "@/lib/utils";
import { Stars } from "@/lib/icons";
import { Chip } from "@/components/chip";
import type { EventItem, Signal, SteepCategory } from "@/lib/types";
import { FlipCard, FlipHint } from "./flip-card";
import { EV_MONO, SEVERITY_BADGE_BASE, severityBadgeClass } from "./event-shared";

export function eventCategory(ev: EventItem, signals: Signal[]): SteepCategory {
  if (ev.category) return ev.category;
  const first = ev.links[0];
  const linked = first && signals.find((s) => s.id === first.signalId);
  return linked ? linked.category : "Political";
}

const TAG_TONE_CLASS: Record<"ind" | "wild" | "obs", string> = {
  ind: "bg-[#EFF6FF] text-[#1D4ED8]",
  wild: "bg-[#F5F3FF] text-[#7C3AED]",
  obs: "bg-[#F3F4F6] text-[#374151]",
};

export function EventTag({ children, tone }: { children: React.ReactNode; tone: "ind" | "wild" | "obs" }) {
  return <span className={cn("rounded-full px-[7px] py-0.5 text-[9.5px]", EV_MONO, TAG_TONE_CLASS[tone])}>{children}</span>;
}

export function LikelihoodPill({ value }: { value: "Low" | "Medium" | "High" | null }) {
  if (!value) return null;
  const n = value === "High" ? 3 : value === "Medium" ? 2 : 1;
  return (
    <span
      title="Likelihood of this event — never applied to scenarios"
      className="inline-flex items-center gap-[5px] rounded-full border border-border bg-white px-2 py-0.5 font-mono text-[9.5px] text-muted-foreground"
    >
      <span className="flex gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-2 w-1 rounded-[1px]", i <= n ? "bg-brand-orange" : "bg-border")} />
        ))}
      </span>
      {value.toUpperCase()}
    </span>
  );
}

// Shown on the signal card's front footer, next to an "EVENTS ↻" flip hint — "● N evidence"
// (solid dot, observed) + "◌ N ahead" (dashed dot, possible). Renders nothing when the signal
// has zero linked events (the FlipHint itself still shows regardless, so the user can flip to
// see "No events linked yet.").
export function EventCount({ sigId, events }: { sigId: string; events: EventItem[] }) {
  const mine = events.filter((e) => e.links.some((l) => l.signalId === sigId));
  const observed = mine.filter((e) => e.status === "observed").length;
  const possible = mine.length - observed;
  if (mine.length === 0) return null;
  return (
    <div className="flex gap-2.5 text-[11px] text-muted-foreground">
      {observed > 0 && (
        <span className="inline-flex items-center gap-1">
          <span className="h-[7px] w-[7px] rounded-full bg-[#374151]" />
          {observed} evidence
        </span>
      )}
      {possible > 0 && (
        <span className="inline-flex items-center gap-1">
          <span className="h-[7px] w-[7px] rounded-full border-[1.5px] border-dashed border-brand-orange" />
          {possible} ahead
        </span>
      )}
    </div>
  );
}

export interface EventCardProps {
  ev: EventItem;
  signals: Signal[];
  flipped: boolean;
  onFlip: () => void;
  focused?: boolean;
  onJump: (signalId: string) => void;
}

export function EventCard({ ev, signals, flipped, onFlip, focused, onJump }: EventCardProps) {
  const possible = ev.status === "possible";
  const cat = eventCategory(ev, signals);
  const statusText = ev.wildcard ? "WILDCARD" : possible ? "POSSIBLE" : "OBSERVED";

  const front = (
    <div onClick={onFlip} className="flex flex-1 min-w-0 cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-white p-3.5">
      <div className="flex items-center justify-between gap-2">
        <Chip category={cat} />
        <span className={cn(EV_MONO, "whitespace-nowrap", ev.wildcard ? "text-[#7C3AED]" : "text-text-3")}>
          {statusText} · {ev.date}
        </span>
      </div>
      <div className="text-[14px] font-semibold leading-tight tracking-[-0.01em] text-brand-dark">{ev.title}</div>
      <div className="flex-1 text-[12.5px] leading-normal text-muted-foreground">{ev.body}</div>
      {ev.precursor && (
        <div className="text-[12px] leading-snug text-muted-foreground">
          <span className="font-mono text-[11px] text-text-3">EARLY SIGN </span>
          {ev.precursor}
        </div>
      )}
      <div className="mt-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="w-[78px] font-mono text-[11px] text-text-3">IMPACT</span>
          <Stars value={ev.impact ?? 0} size={11} />
          {!possible && ev.source && <span className="ml-auto font-mono text-[10.5px] text-text-3">{ev.source.toUpperCase()}</span>}
        </div>
        <div
          className="flex items-center gap-2"
          title={possible ? "Likelihood of this event happening" : "This event has already happened"}
        >
          <span className="w-[78px] font-mono text-[11px] text-text-3">LIKELIHOOD</span>
          {possible ? (
            <>
              <span className="flex gap-0.5">
                {[1, 2, 3].map((i) => {
                  const n = ev.likelihood === "High" ? 3 : ev.likelihood === "Medium" ? 2 : ev.likelihood === "Low" ? 1 : 0;
                  return <span key={i} className={cn("h-1.5 w-2.5 rounded-sm", i <= n ? "bg-brand-orange" : "bg-border")} />;
                })}
              </span>
              <span className={cn(SEVERITY_BADGE_BASE, severityBadgeClass(ev.likelihood), "ml-auto")}>{ev.likelihood ?? "Not set"}</span>
            </>
          ) : (
            <span className={cn(SEVERITY_BADGE_BASE, "ml-auto bg-[#F3F4F6] text-[#374151]")}>Occurred</span>
          )}
        </div>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 border-t border-[#F3F4F6] pt-2">
        <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          {ev.links.length} linked {ev.links.length === 1 ? "force" : "forces"}
          {ev.indicatorId && <EventTag tone="ind">INDICATOR</EventTag>}
        </span>
        <FlipHint label="FORCES" />
      </div>
    </div>
  );

  const back = (
    <div onClick={onFlip} className="flex flex-1 min-w-0 cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-[#FAFAF9] p-3.5">
      <div className={cn(EV_MONO, "text-text-3")}>LINKED FORCES</div>
      <div className="text-[12.5px] font-semibold leading-snug text-brand-dark">{ev.title}</div>
      <div className="flex flex-1 flex-col gap-1.5">
        {ev.links.map((l) => {
          const s = signals.find((x) => x.id === l.signalId);
          if (!s) return null;
          return (
            <button
              key={l.signalId}
              onClick={(e) => {
                e.stopPropagation();
                onJump(s.id);
              }}
              className="flex flex-col gap-1 rounded-lg border border-border bg-white px-2.5 py-2 text-left"
            >
              <span className="flex items-center gap-1.5">
                <Chip category={s.category} />
                <span className="text-[12.5px] font-semibold leading-tight text-brand-dark">{s.title}</span>
              </span>
              <span className="text-[11.5px] text-muted-foreground">
                pushes toward <b className="font-semibold text-brand-dark">{l.toward}</b> →
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end">
        <FlipHint label="EVENT" />
      </div>
    </div>
  );

  return <FlipCard id={`evt:${ev.id}`} flipped={flipped} front={front} back={back} focused={focused} onFlip={onFlip} />;
}
