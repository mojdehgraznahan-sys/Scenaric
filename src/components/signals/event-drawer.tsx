"use client";

// Signals Library v2 (design/handoff/2026-09-28) — ported from the reference build's
// SLEventDrawer, replacing the old flip-card back face entirely (no more Signal<->Event flip;
// clicking any event dot/row opens this instead). Overlay + fixed right panel, same convention
// as ask-ai.tsx's drawer (fixed bottom-4 right-4 top-4, rounded-[18px]).
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/chip";
import { Stars } from "@/lib/icons";
import type { EventItem, Signal } from "@/lib/types";
import { slPole, eventCategory } from "./pole";

const LIKELIHOOD_BADGE: Record<"Low" | "Medium" | "High", string> = {
  High: "bg-brand-orangeLight text-brand-orange700",
  Medium: "bg-[#FFFBEB] text-[#B45309]",
  Low: "bg-[#ECFDF5] text-[#065F46]",
};

export interface EventDrawerProps {
  ev: EventItem;
  signals: Signal[];
  onClose: () => void;
  onLink: (eventId: string, signalId: string, side: "a" | "b") => void;
  onUnlink: (eventId: string, signalId: string) => void;
  onMarkHappened: (eventId: string) => void;
}

export function EventDrawer({ ev, signals, onClose, onLink, onUnlink, onMarkHappened }: EventDrawerProps) {
  const linkedIds = new Set(ev.links.map((l) => l.signalId));
  const attachable = signals.filter((s) => !linkedIds.has(s.id));
  const [attachTo, setAttachTo] = React.useState(attachable[0]?.id ?? "");
  const [attachSide, setAttachSide] = React.useState<"a" | "b">("b");
  const attachSig = signals.find((s) => s.id === attachTo);
  const possible = ev.status === "possible";

  return (
    <div onClick={onClose} className="fade-in fixed inset-0 z-[150] bg-[rgba(15,23,42,0.25)]">
      <aside
        onClick={(e) => e.stopPropagation()}
        className="slide-up fixed bottom-4 right-4 top-4 z-[151] flex w-[min(420px,calc(100%-2rem))] flex-col gap-4 overflow-y-auto rounded-[18px] border border-border bg-white p-[22px] shadow-[0_20px_60px_rgba(15,23,42,0.25),0_6px_16px_rgba(15,23,42,0.08)]"
      >
        <div className="flex items-center justify-between">
          <Chip category={eventCategory(ev, signals)} />
          <button onClick={onClose} aria-label="Close" className="border-0 bg-transparent p-0 text-base text-muted-foreground">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={cn("font-mono text-[10.5px] tracking-[0.06em]", ev.wildcard ? "text-[#7C3AED]" : "text-text-3")}>
            {ev.wildcard ? "WILDCARD" : possible ? "COULD HAPPEN" : "HAPPENED"} · {(ev.date || "").toUpperCase()}
            {ev.source ? ` · ${ev.source.toUpperCase()}` : ""}
          </span>
          <h3 className="text-[19px] font-semibold leading-[1.3] tracking-[-0.01em]">{ev.title}</h3>
          {ev.body && <p className="text-[13.5px] leading-[1.6] text-[#374151]">{ev.body}</p>}
          {ev.precursor && (
            <p className="text-[12.5px] text-muted-foreground">
              <span className="font-mono text-[10px] text-text-3">EARLY SIGN </span>
              {ev.precursor}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5 rounded-[10px] border border-border p-[11px]">
            <span className="font-mono text-[10px] text-text-3">IMPACT</span>
            <Stars value={ev.impact ?? 0} size={13} />
          </div>
          <div className="flex flex-col items-start gap-1.5 rounded-[10px] border border-border p-[11px]">
            <span className="font-mono text-[10px] text-text-3">LIKELIHOOD</span>
            {possible ? (
              <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", LIKELIHOOD_BADGE[ev.likelihood ?? "Low"])}>
                {ev.likelihood ?? "Not set"}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#374151]">Happened</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] text-text-3">PULLS ON</span>
          {ev.links.map((l) => {
            const s = signals.find((x) => x.id === l.signalId);
            if (!s) return null;
            const other: "a" | "b" = l.side === "a" ? "b" : "a";
            return (
              <div key={l.signalId} className="flex flex-col gap-2 rounded-[10px] border border-border p-[11px]">
                <span className="flex flex-wrap items-center gap-2">
                  <Chip category={s.category} />
                  <span className="text-[13px] font-semibold">{s.title}</span>
                </span>
                <span className="text-[12.5px] text-muted-foreground">
                  toward <b className="font-semibold text-brand-dark">{slPole(s, l.side)}</b>
                </span>
                <span className="flex gap-3">
                  <button onClick={() => onLink(ev.id, s.id, other)} className="border-0 bg-transparent p-0 text-xs font-medium text-brand-orange hover:underline">
                    Switch to &quot;{slPole(s, other)}&quot;
                  </button>
                  <button onClick={() => onUnlink(ev.id, s.id)} className="border-0 bg-transparent p-0 text-xs font-medium text-muted-foreground hover:underline">
                    Unlink
                  </button>
                </span>
              </div>
            );
          })}
          {ev.links.length === 0 && <span className="text-[12.5px] text-muted-foreground">In the inbox. Attach it to a force:</span>}
          {attachable.length > 0 && (
            <div className="flex flex-col gap-2 rounded-[10px] border border-dashed border-border p-[11px]">
              <Select value={attachTo} onValueChange={setAttachTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {attachable.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {attachSig && (
                <div className="flex gap-0.5 rounded-md bg-[#F3F4F6] p-0.5">
                  {(["a", "b"] as const).map((side) => (
                    <button
                      key={side}
                      onClick={() => setAttachSide(side)}
                      className={cn(
                        "flex-1 whitespace-nowrap rounded-md border-0 px-2.5 py-1.5 text-xs font-medium",
                        attachSide === side ? "bg-white font-semibold text-brand-dark shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "bg-transparent text-muted-foreground"
                      )}
                    >
                      {side === "a" ? `← ${slPole(attachSig, "a")}` : `${slPole(attachSig, "b")} →`}
                    </button>
                  ))}
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                disabled={!attachSig}
                onClick={() => attachSig && onLink(ev.id, attachSig.id, attachSide)}
              >
                {ev.links.length ? "Also pulls on this force" : "Attach"}
              </Button>
            </div>
          )}
        </div>
        {possible && (
          <Button variant="soft" className="self-start" onClick={() => onMarkHappened(ev.id)}>
            Mark as happened
          </Button>
        )}
      </aside>
    </div>
  );
}
