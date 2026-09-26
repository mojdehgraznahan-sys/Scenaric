"use client";

// Signals page — "+ Add Signal" modal, extracted from page-signals.tsx's inline Dialog and
// extended with the design prototype's (components/events.jsx) event-detection banner: when
// the title reads like an event (looksLikeEvent), default to "Add as event" instead of a force.
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Signal, SteepCategory } from "@/lib/types";
import { looksLikeEvent } from "./event-shared";

const STEEP_CATEGORIES: SteepCategory[] = ["Social", "Technology", "Economic", "Ecological", "Political"];

export interface AddSignalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signals: Signal[];
  onAddSignal: (input: { category: SteepCategory; source: string; title: string; body: string }) => Promise<void>;
  onAddEvent: (input: {
    title: string;
    status: "observed" | "possible";
    targetSignalId: string;
    toward: string;
    likelihood?: "Low" | "Medium" | "High";
  }) => Promise<void>;
}

export function AddSignalModal({ open, onOpenChange, signals, onAddSignal, onAddEvent }: AddSignalModalProps) {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [category, setCategory] = React.useState<SteepCategory>("Technology");
  const [source, setSource] = React.useState("");
  const [targetSignalId, setTargetSignalId] = React.useState(signals[0]?.id ?? "");
  const [toward, setToward] = React.useState("");
  const [likelihood, setLikelihood] = React.useState<"Low" | "Medium" | "High">("Medium");
  const [override, setOverride] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hit = looksLikeEvent(title);
  const asEvent = !!hit && !override;
  const ok = title.trim().length >= 6 && (!asEvent || (targetSignalId && toward.trim().length > 0));

  const reset = () => {
    setTitle("");
    setBody("");
    setCategory("Technology");
    setSource("");
    setTargetSignalId(signals[0]?.id ?? "");
    setToward("");
    setLikelihood("Medium");
    setOverride(false);
    setError(null);
  };

  const submit = async () => {
    if (!ok || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (asEvent && hit) {
        await onAddEvent({
          title: title.trim(),
          status: hit.status,
          targetSignalId,
          toward: toward.trim(),
          likelihood: hit.status === "possible" ? likelihood : undefined,
        });
      } else {
        await onAddSignal({ category, source: source.trim() || "Manual entry", title: title.trim(), body: body.trim() });
      }
      onOpenChange(false);
      reset();
    } catch (err) {
      console.error("[signals] failed to add", err);
      setError(asEvent ? "Couldn't add the event — try again." : "Couldn't create the signal — try again.");
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
      <DialogContent className="max-w-[480px] rounded-2xl p-6">
        <DialogTitle className="mb-4 text-lg font-semibold tracking-[-0.01em]">Add signal</DialogTitle>
        <div className="flex flex-col gap-3.5">
          <div>
            <Label htmlFor="signal-title" className="mb-1.5 block text-xs">
              Force
            </Label>
            <Input
              id="signal-title"
              autoFocus
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setOverride(false);
              }}
              placeholder="e.g. Direction of SEA foreign-ownership regulation"
            />
            <p className="mt-1.5 text-[11px] text-text-3">A driver that could plausibly go more than one way over your horizon.</p>
          </div>

          {hit && (
            <div className="flex flex-col gap-2.5 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] p-3">
              <div className="text-[12.5px] leading-normal text-[#92400E]">
                This reads like an <b>{hit.status === "observed" ? "observed" : "possible"} event</b> — it {hit.why}. Events attach to a force
                as {hit.status === "observed" ? "evidence" : "something to watch"}, so the matrix stays made of forces.
              </div>
              {asEvent ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="mb-1 block text-[11.5px] text-[#92400E]">Attach to force</Label>
                      <Select value={targetSignalId} onValueChange={setTargetSignalId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a force" />
                        </SelectTrigger>
                        <SelectContent>
                          {signals.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="event-toward" className="mb-1 block text-[11.5px] text-[#92400E]">
                        Pushes it toward
                      </Label>
                      <Input id="event-toward" value={toward} onChange={(e) => setToward(e.target.value)} placeholder="e.g. Openness" />
                    </div>
                  </div>
                  {hit.status === "possible" && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11.5px] text-[#92400E]">Likelihood</span>
                      {(["Low", "Medium", "High"] as const).map((l) => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setLikelihood(l)}
                          className={cn(
                            "rounded-md border px-2.5 py-1 text-[12px]",
                            likelihood === l ? "border-brand-orange bg-brand-orange text-white" : "border-border bg-white text-muted-foreground"
                          )}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => setOverride(true)} className="self-start text-[11.5px] text-[#92400E] underline">
                    It&apos;s a force — add as a signal anyway
                  </button>
                </>
              ) : (
                <div className="text-[11.5px] text-[#92400E]">Adding as a signal.</div>
              )}
            </div>
          )}

          {!asEvent && (
            <>
              <div>
                <Label htmlFor="signal-body" className="mb-1.5 block text-xs">
                  Description
                </Label>
                <Textarea
                  id="signal-body"
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What happens. Why it matters. (1–2 sentences)"
                  className="min-h-[70px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block text-xs">STEEP category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as SteepCategory)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STEEP_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="signal-source" className="mb-1.5 block text-xs">
                    Source
                  </Label>
                  <Input id="signal-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Internal research, …" />
                </div>
              </div>
            </>
          )}

          {error && <div className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-[11px] py-2 text-[12.5px] text-[#EF4444]">{error}</div>}

          <div className="mt-1 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={submit} disabled={!ok || submitting}>
              {submitting ? "Adding…" : asEvent ? "Add as event" : "Add signal"}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
          {!asEvent && (
            <div className="text-center text-[11.5px] text-muted-foreground">
              Impact and uncertainty are scored by AI after adding — use <span className="font-medium text-brand-dark">Score now</span> once it
              appears unscored.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
