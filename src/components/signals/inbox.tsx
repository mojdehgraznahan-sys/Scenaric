"use client";

// Signals Library v2 (design/handoff/2026-09-28) — ported from the reference build's
// SLInbox/SLProposals. Events with no linked force sit here; "Group into forces" (AI) proposes
// either brand-new forces (clustering several inbox events) or attaching one to an existing
// force+side — both land in force_proposals for review, never written directly (Steps 2/3
// confirm-before-merge shape).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/chip";
import type { EventItem, Signal } from "@/lib/types";
import type { ForceProposalRow } from "@/lib/actions/ai-forces";
import { EventDot } from "./spectrum";

export function Inbox({
  items,
  total,
  onOpen,
  onGroup,
  grouping,
  children,
}: {
  items: EventItem[];
  total: number;
  onOpen: (id: string) => void;
  onGroup: () => void;
  grouping: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-[#FED7AA] bg-[#FFFBF5] p-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold">Inbox · {total}</span>
          <span className="text-xs text-[#7C2D12]">Events not yet tied to a force. Group them and the forces behind them appear.</span>
        </div>
        <Button variant="primary" size="sm" className={cn("ml-auto", grouping && "animate-pulse")} disabled={!total || grouping} onClick={onGroup}>
          {grouping ? "Grouping…" : "✦ Group into forces"}
        </Button>
      </div>
      {items.length > 0 && (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {items.map((e) => (
            <button
              key={e.id}
              onClick={() => onOpen(e.id)}
              className="flex flex-col gap-1.5 rounded-[10px] border border-border bg-white p-[11px] text-left"
            >
              <span className="flex items-center justify-between gap-1.5">
                <Chip category={e.category ?? "Political"} className="px-[7px] py-px text-[10.5px]" />
                <EventDot ev={e} />
              </span>
              <span className="text-[13px] font-semibold leading-[1.35]">{e.title}</span>
              <span className="font-mono text-[9.5px] tracking-[0.06em] text-text-3">{(e.date || "").toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}
      {!total && <span className="text-xs text-[#9A3412]">Every event is tied to a force.</span>}
      {children}
    </section>
  );
}

export function GroupProposals({
  proposals,
  signals,
  events,
  leftoverEventIds = [],
  workingId,
  onConfirm,
  onDismiss,
}: {
  proposals: ForceProposalRow[];
  signals: Signal[];
  events: EventItem[];
  leftoverEventIds?: string[];
  workingId: string | null;
  onConfirm: (p: ForceProposalRow) => void;
  onDismiss: (p: ForceProposalRow) => void;
}) {
  const evById = (id: string) => events.find((e) => e.id === id);
  const stateLabel = (p: ForceProposalRow, yes: string) =>
    p.status === "dismissed" ? (
      <span className="font-mono text-[10px] text-text-3">DISMISSED</span>
    ) : (
      <span className="font-mono text-[10px] text-[#15803D]">✓ {yes}</span>
    );

  const newForces = proposals.filter((p) => p.kind === "new_force");
  const attach = proposals.filter((p) => p.kind === "attach");

  if (newForces.length === 0 && attach.length === 0 && leftoverEventIds.length === 0) {
    return <div className="border-t border-[#FED7AA] pt-3 text-xs text-[#7C2D12]">Nothing to group.</div>;
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-[#FED7AA] pt-3">
      {newForces.map((p) => {
        const members = p.member_links;
        const one = members.every((m) => m.side === members[0]?.side);
        return (
          <div key={p.id} className={cn("flex flex-col gap-2.5 rounded-[10px] border border-[#FED7AA] bg-white p-3", p.status === "dismissed" && "opacity-55")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] text-brand-orange700">PROPOSED FORCE</span>
              {p.category && <Chip category={p.category} className="px-[7px] py-px text-[10.5px]" />}
            </div>
            <div className="text-[15px] font-semibold leading-[1.3]">{p.title}</div>
            <div className="flex items-center justify-between gap-2.5 text-xs font-semibold">
              <span>← {p.pole_a}</span>
              <span>{p.pole_b} →</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(["a", "b"] as const).map((side) => (
                <div key={side} className="flex flex-col gap-1.5">
                  {members
                    .filter((m) => m.side === side)
                    .map((m) => {
                      const e = evById(m.event_id);
                      return e ? (
                        <span key={m.event_id} className="flex gap-1.5 text-xs leading-[1.35]">
                          <span className="flex pt-[3px]">
                            <EventDot ev={e} />
                          </span>
                          {e.title}
                        </span>
                      ) : null;
                    })}
                </div>
              ))}
            </div>
            <div className="text-xs leading-[1.5] text-muted-foreground">{p.rationale}</div>
            {one && <div className="text-[11.5px] text-[#92400E]">These only pull one way. Once it&apos;s created, use ✦ Suggest on the empty side.</div>}
            {p.status !== "proposed" ? (
              stateLabel(p, "FORCE CREATED")
            ) : (
              <div className="flex gap-1.5">
                <Button variant="primary" size="sm" disabled={workingId === p.id} onClick={() => onConfirm(p)}>
                  Create force
                </Button>
                <Button variant="ghost" size="sm" disabled={workingId === p.id} onClick={() => onDismiss(p)}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {attach.map((p) => {
        const e = p.event_id ? evById(p.event_id) : undefined;
        const s = p.target_signal_id ? signals.find((x) => x.id === p.target_signal_id) : undefined;
        if (!e || !s || !p.target_side) return null;
        const poleLabel = p.target_side === "a" ? s.poleA : s.poleB;
        return (
          <div key={p.id} className={cn("flex flex-col gap-1.5 rounded-[10px] border border-border bg-white p-3", p.status === "dismissed" && "opacity-55")}>
            <span className="font-mono text-[10px] text-text-3">ATTACH TO EXISTING FORCE</span>
            <span className="text-[13px] font-semibold leading-[1.35]">{e.title}</span>
            <span className="text-xs text-muted-foreground">
              pulls <b className="font-semibold text-brand-dark">{s.title}</b> toward <b className="font-semibold text-brand-dark">{poleLabel}</b>
            </span>
            <span className="text-xs leading-[1.5] text-muted-foreground">{p.rationale}</span>
            {p.status !== "proposed" ? (
              stateLabel(p, "ATTACHED")
            ) : (
              <div className="flex gap-1.5">
                <Button variant="primary" size="sm" disabled={workingId === p.id} onClick={() => onConfirm(p)}>
                  Attach
                </Button>
                <Button variant="ghost" size="sm" disabled={workingId === p.id} onClick={() => onDismiss(p)}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>
        );
      })}
      {leftoverEventIds.length > 0 && (
        <div className="text-xs leading-[1.5] text-[#7C2D12]">
          Couldn&apos;t place: {leftoverEventIds.map((id) => evById(id)?.title).filter(Boolean).join(" · ")}. Add a force for it, or leave it in the inbox.
        </div>
      )}
    </div>
  );
}

