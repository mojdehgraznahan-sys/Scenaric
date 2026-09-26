"use client";

// Signals page "Events" view — SignalCardBack, ported from the design prototype's
// components/events.jsx. Back face ONLY — pairs with the existing production SignalCard
// front (page-signals.tsx) via FlipCard, same convention as EventCard's own back face.
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { EventItem, Signal } from "@/lib/types";
import { FlipHint } from "./flip-card";
import { EV_MONO } from "./event-shared";
import { LikelihoodPill } from "./event-card";

export interface SignalCardBackProps {
  sig: Signal;
  events: EventItem[];
  onFlip: () => void;
  onJump: (eventId: string) => void;
  onDetails: () => void;
}

export function SignalCardBack({ sig, events, onFlip, onJump, onDetails }: SignalCardBackProps) {
  const mine = events.filter((e) => e.links.some((l) => l.signalId === sig.id));
  const sorted = [...mine.filter((e) => e.status === "observed"), ...mine.filter((e) => e.status === "possible")];

  return (
    <div onClick={onFlip} className="flex flex-1 min-w-0 cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-[#FAFAF9] p-3.5">
      <div className={cn(EV_MONO, "text-text-3")}>LINKED EVENTS</div>
      <div className="text-[12.5px] font-semibold leading-snug text-brand-dark">{sig.title}</div>
      <div className="flex flex-1 flex-col gap-1.5">
        {sorted.map((e) => {
          const possible = e.status === "possible";
          const link = e.links.find((l) => l.signalId === sig.id);
          return (
            <button
              key={e.id}
              onClick={(x) => {
                x.stopPropagation();
                onJump(e.id);
              }}
              className={cn(
                "flex flex-col gap-1 rounded-lg bg-white px-2.5 py-[7px] text-left",
                !possible ? "border border-border" : e.wildcard ? "border border-dashed border-[#C4B5FD]" : "border border-dashed border-[#FDBA74]"
              )}
            >
              <span className="text-[12.5px] font-medium leading-snug text-brand-dark">{e.title}</span>
              <span className="flex flex-wrap items-center gap-1.5">
                {possible ? <LikelihoodPill value={e.likelihood} /> : <span className={cn(EV_MONO, "text-[9.5px] text-[#374151]")}>{e.date.toUpperCase()}</span>}
                {link && <span className="text-[11px] text-muted-foreground">→ {link.toward}</span>}
              </span>
            </button>
          );
        })}
        {sorted.length === 0 && <div className="text-[12px] text-text-3">No events linked yet.</div>}
      </div>
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={(x) => {
            x.stopPropagation();
            onDetails();
          }}
        >
          Timeline &amp; details
        </Button>
        <FlipHint label="FORCE" />
      </div>
    </div>
  );
}
