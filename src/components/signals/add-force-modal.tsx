"use client";

// Signals Library v2 (design/handoff/2026-09-28) — ported from the reference build's
// SLAddForceModal. A force can go two ways over the horizon — both poles are required up
// front; impact/uncertainty are never collected here, the same auto-score-on-create
// fire-and-forget store.createSignal already does for every signal handles it.
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/chip";
import { cn } from "@/lib/utils";
import type { SteepCategory } from "@/lib/types";

const STEEP_CATEGORIES: SteepCategory[] = ["Social", "Technology", "Economic", "Ecological", "Political"];

export interface AddForceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (input: { title: string; category: SteepCategory; poleA: string; poleB: string; body: string }) => Promise<void>;
}

export function AddForceModal({ open, onOpenChange, onAdd }: AddForceModalProps) {
  const [title, setTitle] = React.useState("");
  const [poleA, setPoleA] = React.useState("");
  const [poleB, setPoleB] = React.useState("");
  const [category, setCategory] = React.useState<SteepCategory>("Political");
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const reset = () => {
    setTitle("");
    setPoleA("");
    setPoleB("");
    setCategory("Political");
    setBody("");
    setError(null);
  };

  const ok = title.trim().length >= 4 && poleA.trim().length > 0 && poleB.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!ok) return;
    setSubmitting(true);
    setError(null);
    try {
      await onAdd({ title: title.trim(), category, poleA: poleA.trim(), poleB: poleB.trim(), body: body.trim() });
      reset();
      onOpenChange(false);
    } catch (err) {
      console.error("[signals] failed to add force", err);
      setError("Couldn't add the force — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-[500px] rounded-2xl p-6">
        <div className="mb-1">
          <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">Add a force</DialogTitle>
          <div className="mt-1 text-[12.5px] text-muted-foreground">
            A force can go two ways over your horizon. Name both, and events will pull toward one or the other.
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div>
            <Label htmlFor="force-title" className="mb-1.5 block text-xs">
              Force
            </Label>
            <Input
              id="force-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Digital sovereignty across SEA"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="force-pole-a" className="mb-1.5 block text-xs">
                ← One way
              </Label>
              <Input id="force-pole-a" value={poleA} onChange={(e) => setPoleA(e.target.value)} placeholder="e.g. Open data flows" />
            </div>
            <div>
              <Label htmlFor="force-pole-b" className="mb-1.5 block text-xs">
                The other way →
              </Label>
              <Input id="force-pole-b" value={poleB} onChange={(e) => setPoleB(e.target.value)} placeholder="e.g. Digital walls" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STEEP_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn("rounded-full border-0 bg-transparent p-0", category === c && "outline outline-2 outline-offset-1 outline-brand-dark")}
              >
                <Chip category={c} />
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="force-body" className="mb-1.5 block text-xs">
              Why it matters <span className="font-normal normal-case text-text-3">· optional</span>
            </Label>
            <Textarea id="force-body" rows={2} value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[60px]" />
          </div>
          {error && <div className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-[11px] py-2 text-[12.5px] text-[#EF4444]">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!ok} onClick={submit}>
              {submitting ? "Adding…" : "Add force"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
