"use client";

// Signals Library v2 (design/handoff/2026-09-28) — ported from the reference build's
// SLForceCard/SLDraftRow. Per-side event lists (max 3 shown, "Show N more"), "✦ Suggest"/
// "+ Add" on an empty side, and the tug-of-war Spectrum header.
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/chip";
import { Stars } from "@/lib/icons";
import type { EventItem, Signal } from "@/lib/types";
import type { EventProposalRow } from "@/lib/actions/ai-forces";
import { isPoleOk, arePolesWeak } from "@/lib/poles";
import { slPole } from "./pole";
import { Spectrum, EventRow } from "./spectrum";

// CLAUDE_CODE_MATRIX_POLES_PROMPTS.md — shown in place of the Spectrum header whenever a
// force's poles are too generic/duplicate/title-equal to compare (lib/poles.ts's
// arePolesWeak), so a weak force can be fixed from the Signals Library too, not only the
// Matrix (which has its own copy of this same editor, MXPoleEditor, for its unrelated "mx-*"
// styling system).
function WeakPoleEditor({ sig, onSave }: { sig: Signal; onSave: (poles: [string, string]) => Promise<void> }) {
  const prefill = (pole: string) => (isPoleOk(sig.title, pole) ? pole : "");
  const [a, setA] = React.useState(prefill(sig.poleA));
  const [b, setB] = React.useState(prefill(sig.poleB));
  const [saving, setSaving] = React.useState(false);
  React.useEffect(() => {
    setA(prefill(sig.poleA));
    setB(prefill(sig.poleB));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig.id]);
  const ok = isPoleOk(sig.title, a) && isPoleOk(sig.title, b) && a.trim().toLowerCase() !== b.trim().toLowerCase();
  const save = async () => {
    setSaving(true);
    try {
      await onSave([a.trim(), b.trim()]);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] p-2.5">
      <span className="text-[12px] font-semibold text-[#92400E]">Name both ends of this force</span>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-[#92400E]">← One end</span>
          <Input value={a} onChange={(e) => setA(e.target.value)} placeholder="e.g. Dependence falls fast" className="h-8 text-[12.5px]" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10.5px] text-[#92400E]">Other end →</span>
          <Input value={b} onChange={(e) => setB(e.target.value)} placeholder="e.g. Dependence deepens" className="h-8 text-[12.5px]" />
        </label>
      </div>
      <Button variant="primary" size="sm" className="self-start px-2.5 py-1" disabled={!ok || saving} onClick={save}>
        {saving ? "Saving…" : "Save ends"}
      </Button>
    </div>
  );
}

const LIKELIHOOD_BADGE: Record<"Low" | "Medium" | "High", string> = {
  High: "bg-brand-orangeLight text-brand-orange700",
  Medium: "bg-[#FFFBEB] text-[#B45309]",
  Low: "bg-[#ECFDF5] text-[#065F46]",
};

function DraftRow({ d, onAccept, onDismiss }: { d: EventProposalRow; onAccept: () => void; onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-[#FDBA74] bg-[#FFFBF5] p-2.5">
      <span className="font-mono text-[9px] tracking-[0.06em] text-brand-orange700">AI SUGGESTION · {(d.window_label ?? "").toUpperCase()}</span>
      <span className="text-[12.5px] font-medium leading-[1.35]">{d.title}</span>
      <span className="flex items-center gap-1.5">
        {d.likelihood && <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", LIKELIHOOD_BADGE[d.likelihood])}>{d.likelihood}</span>}
        <Button variant="primary" size="sm" className="ml-auto px-2.5 py-1" onClick={onAccept}>
          Add
        </Button>
        <Button variant="ghost" size="sm" className="px-2 py-1" onClick={onDismiss} aria-label="Dismiss">
          ✕
        </Button>
      </span>
    </div>
  );
}

export interface ForceCardProps {
  sig: Signal;
  events: EventItem[];
  proposals: EventProposalRow[];
  busySide: "a" | "b" | null;
  onOpen: (eventId: string) => void;
  onAdd: (side: "a" | "b" | null) => void;
  onGenerate: (side: "a" | "b") => void;
  onAcceptProposal: (p: EventProposalRow) => void;
  onDismissProposal: (p: EventProposalRow) => void;
  onMatrix?: () => void;
  onSavePoles: (poles: [string, string]) => Promise<void>;
}

export function ForceCard({ sig, events, proposals, busySide, onOpen, onAdd, onGenerate, onAcceptProposal, onDismissProposal, onMatrix, onSavePoles }: ForceCardProps) {
  const [more, setMore] = React.useState(false);
  const mine = events.filter((e) => e.links.some((l) => l.signalId === sig.id));
  const order = (list: EventItem[]) => [...list.filter((e) => e.status === "observed"), ...list.filter((e) => e.status !== "observed")];
  const bySide = (side: "a" | "b") =>
    order(mine.filter((e) => e.links.find((l) => l.signalId === sig.id)?.side === side));
  const sides = { a: bySide("a"), b: bySide("b") };
  const hidden = Math.max(0, sides.a.length - 3) + Math.max(0, sides.b.length - 3);
  const observed = mine.filter((e) => e.status === "observed").length;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2.5 rounded-[10px] border border-border bg-white p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chip category={sig.category} />
        <span className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-text-3">IMPACT</span>
          <Stars value={sig.impact ?? 0} size={11} />
          {sig.uncertainty && (
            <span title="Uncertainty" className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", LIKELIHOOD_BADGE[sig.uncertainty])}>
              {sig.uncertainty}
            </span>
          )}
        </span>
      </div>
      <div className="text-[15px] font-semibold leading-[1.3] tracking-[-0.01em]" title={sig.body || ""}>
        {sig.title}
      </div>
      {arePolesWeak(sig.title, [sig.poleA, sig.poleB]) ? <WeakPoleEditor sig={sig} onSave={onSavePoles} /> : <Spectrum sig={sig} a={sides.a} b={sides.b} onOpen={onOpen} />}
      <div className="grid grid-cols-2 gap-2.5">
        {(["a", "b"] as const).map((side) => {
          const list = sides[side];
          const shown = more ? list : list.slice(0, 3);
          const ds = proposals.filter((p) => p.side === side);
          return (
            <div key={side} className="flex min-w-0 flex-col gap-1">
              {shown.map((e) => (
                <EventRow key={e.id} ev={e} onOpen={onOpen} />
              ))}
              {ds.map((d) => (
                <DraftRow key={d.id} d={d} onAccept={() => onAcceptProposal(d)} onDismiss={() => onDismissProposal(d)} />
              ))}
              {list.length === 0 && ds.length === 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-2.5">
                  <span className="text-[11.5px] leading-[1.45] text-muted-foreground">
                    Nothing pulling toward <b className="font-semibold text-brand-dark">{slPole(sig, side)}</b> yet.
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <Button
                      variant="soft"
                      size="sm"
                      className={cn("px-2.5 py-1", busySide === side && "animate-pulse")}
                      disabled={busySide === side}
                      onClick={() => onGenerate(side)}
                    >
                      {busySide === side ? "Thinking…" : "✦ Suggest"}
                    </Button>
                    <Button variant="ghost" size="sm" className="px-2.5 py-1" onClick={() => onAdd(side)}>
                      + Add
                    </Button>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hidden > 0 && (
        <button onClick={() => setMore((m) => !m)} className="self-start border-0 bg-transparent p-0 text-xs font-medium text-brand-orange hover:underline">
          {more ? "Show fewer" : `Show ${hidden} more`}
        </button>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[#F3F4F6] pt-2.5">
        <span className="text-[11.5px] text-muted-foreground">
          {mine.length} {mine.length === 1 ? "event" : "events"}
          {observed ? ` · ${observed} happened` : ""}
        </span>
        <span className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" className="px-2.5 py-1" onClick={() => onAdd(null)}>
            + Add event
          </Button>
          {onMatrix && (
            <button onClick={onMatrix} className="border-0 bg-transparent p-0 text-xs font-medium text-brand-orange hover:underline">
              Place on matrix →
            </button>
          )}
        </span>
      </div>
    </div>
  );
}
