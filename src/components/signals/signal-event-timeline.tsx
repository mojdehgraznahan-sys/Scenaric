"use client";

// Signals page "Events" view — per-signal event timeline, ported from the design prototype's
// components/events.jsx (EventRow/TodayDivider/SignalEventTimeline). Not mentioned anywhere in
// scenaric.pdf's prose — only discovered from the literal prototype code — but it's clearly
// what "Timeline & details" (SignalCardBack's footer button) should open: extends the existing
// signal detail modal in page-signals.tsx rather than a second modal.
import { cn } from "@/lib/utils";
import { Chip } from "@/components/chip";
import type { EventItem, Signal } from "@/lib/types";
import { EV_MONO } from "./event-shared";
import { LikelihoodPill, EventTag } from "./event-card";

interface EventRowProps {
  ev: EventItem;
  sigId?: string;
  signals: Signal[];
  showSignals?: boolean;
}

export function EventRow({ ev, sigId, signals, showSignals }: EventRowProps) {
  const possible = ev.status === "possible";
  const link = sigId ? ev.links.find((l) => l.signalId === sigId) : undefined;
  return (
    <div className="grid grid-cols-[64px_14px_minmax(0,1fr)] items-start gap-2">
      <div className={cn(EV_MONO, "pt-0.5 text-right", possible ? "text-brand-orange700" : "text-muted-foreground")}>{ev.date}</div>
      <div className="flex justify-center pt-1">
        <span
          className={cn("h-[9px] w-[9px] rounded-full", !possible && "bg-[#374151]")}
          style={possible ? { background: "#fff", border: `1.5px dashed ${ev.wildcard ? "#8B5CF6" : "#F97316"}` } : undefined}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="text-[13px] font-medium leading-snug text-brand-dark">{ev.title}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {link && (
            <span className="text-[11.5px] text-muted-foreground">
              pushes toward <b className="font-semibold text-brand-dark">{link.toward}</b>
            </span>
          )}
          {showSignals &&
            ev.links.map((l) => {
              const s = signals.find((x) => x.id === l.signalId);
              return s ? (
                <Chip key={l.signalId} category={s.category} className="text-[10.5px]">
                  {s.title} → {l.toward}
                </Chip>
              ) : null;
            })}
          {possible && <LikelihoodPill value={ev.likelihood} />}
          {ev.indicatorId && <EventTag tone="ind">INDICATOR</EventTag>}
          {ev.wildcard && <EventTag tone="wild">WILDCARD</EventTag>}
          {!possible && ev.source && <span className={cn(EV_MONO, "text-text-3")}>{ev.source.toUpperCase()}</span>}
        </div>
        {ev.precursor && <div className="text-[11.5px] text-muted-foreground">Early sign: {ev.precursor}</div>}
      </div>
    </div>
  );
}

export function TodayDivider() {
  return (
    <div className="my-0.5 grid grid-cols-[64px_minmax(0,1fr)] items-center gap-2">
      <div className={cn(EV_MONO, "text-right font-semibold text-brand-orange")}>TODAY</div>
      <div className="h-px" style={{ background: "repeating-linear-gradient(90deg,#F97316 0 4px,transparent 4px 8px)" }} />
    </div>
  );
}

export interface SignalEventTimelineProps {
  sigId: string;
  events: EventItem[];
  signals: Signal[];
}

// Observed evidence above the TODAY divider, possible events ahead below it.
export function SignalEventTimeline({ sigId, events, signals }: SignalEventTimelineProps) {
  const mine = events.filter((e) => e.links.some((l) => l.signalId === sigId));
  const observed = mine.filter((e) => e.status === "observed");
  const possible = mine.filter((e) => e.status === "possible");

  if (mine.length === 0) {
    return (
      <div className="py-1.5 text-[12.5px] text-text-3">
        No events linked yet. Attach past news as evidence, or add possible future events to watch.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {observed.length > 0 && <div className={cn(EV_MONO, "text-text-3")}>EVIDENCE · OBSERVED</div>}
      {observed.map((e) => (
        <EventRow key={e.id} ev={e} sigId={sigId} signals={signals} />
      ))}
      <TodayDivider />
      {possible.length > 0 && <div className={cn(EV_MONO, "text-text-3")}>AHEAD · POSSIBLE</div>}
      {possible.map((e) => (
        <EventRow key={e.id} ev={e} sigId={sigId} signals={signals} />
      ))}
      {possible.length === 0 && <div className="text-[12px] text-text-3">No possible events yet.</div>}
    </div>
  );
}
