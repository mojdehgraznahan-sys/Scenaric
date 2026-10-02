"use client";

// Signals Library v2 (design/handoff/2026-09-28) — ported from the reference build's
// SLDot/SLMeta/SLEventRow/SLSpectrum. The tug-of-war track: events sit on the side of the
// pole they pull toward, positioned by index along each side rather than by any numeric score
// (there's no "how strongly" dimension here — only which side, and how many).
import { cn } from "@/lib/utils";
import type { EventItem, Signal } from "@/lib/types";
import { slPole } from "./pole";

export function EventDot({ ev, size = 10 }: { ev: Pick<EventItem, "status" | "wildcard">; size?: number }) {
  const possible = ev.status === "possible";
  const color = ev.wildcard ? "#8B5CF6" : "#F97316";
  return (
    <span
      className="inline-block flex-shrink-0 rounded-full box-border"
      style={{
        width: size,
        height: size,
        background: possible ? "#fff" : "#1E1B2E",
        border: possible ? `1.5px dashed ${color}` : "none",
      }}
    />
  );
}

const LIKELIHOOD_BADGE: Record<"Low" | "Medium" | "High", string> = {
  High: "bg-brand-orangeLight text-brand-orange700",
  Medium: "bg-[#FFFBEB] text-[#B45309]",
  Low: "bg-[#ECFDF5] text-[#065F46]",
};

export function EventMeta({ ev }: { ev: Pick<EventItem, "status" | "wildcard" | "date" | "likelihood"> }) {
  const possible = ev.status === "possible";
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={cn("font-mono text-[9.5px] tracking-[0.06em]", ev.wildcard ? "text-[#7C3AED]" : "text-text-3")}>
        {ev.wildcard ? "WILDCARD · " : possible ? "COULD HAPPEN · " : "HAPPENED · "}
        {(ev.date || "").toUpperCase()}
      </span>
      {possible && ev.likelihood && (
        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", LIKELIHOOD_BADGE[ev.likelihood])}>
          {ev.likelihood}
        </span>
      )}
    </span>
  );
}

export function EventRow({ ev, onOpen }: { ev: EventItem; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(ev.id)}
      className="flex w-full items-start gap-2 rounded-[7px] border-0 bg-transparent p-1.5 text-left hover:bg-[#F9FAFB]"
    >
      <span className="flex pt-1">
        <EventDot ev={ev} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[12.5px] font-medium leading-[1.35]">{ev.title}</span>
        <EventMeta ev={ev} />
      </span>
    </button>
  );
}

// The tug-of-war track — events on side "a" walk in from the left, side "b" from the right.
export function Spectrum({ sig, a, b, onOpen }: { sig: Signal; a: EventItem[]; b: EventItem[]; onOpen: (id: string) => void }) {
  const pos = (i: number, n: number) => 5 + i * Math.min(11, 36 / Math.max(1, n));
  const dots: [EventItem, number][] = [
    ...a.map((e, i): [EventItem, number] => [e, pos(i, a.length)]),
    ...b.map((e, i): [EventItem, number] => [e, 100 - pos(i, b.length)]),
  ];
  return (
    <div>
      <div className="flex items-center justify-between gap-2.5 text-xs font-semibold leading-tight">
        <span className="flex min-w-0 gap-1">
          <span className="text-[#9CA3AF]">←</span>
          {slPole(sig, "a")}
        </span>
        <span className="flex min-w-0 gap-1 text-right">
          {slPole(sig, "b")}
          <span className="text-[#9CA3AF]">→</span>
        </span>
      </div>
      <div className="relative h-[26px]">
        <div className="absolute left-0 right-0 top-3 h-0.5 rounded-full bg-border" />
        <div className="absolute left-1/2 top-1.5 h-3.5 w-px bg-[#D1D5DB]" />
        {dots.map(([e, x]) => (
          <button
            key={e.id}
            title={e.title}
            onClick={() => onOpen(e.id)}
            className="absolute top-[7px] flex h-3 w-3 border-0 bg-transparent p-0 cursor-pointer"
            style={{ left: `calc(${x}% - 6px)` }}
          >
            <EventDot ev={e} size={12} />
          </button>
        ))}
      </div>
    </div>
  );
}
