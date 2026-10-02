"use client";

// Signals Library v2 (design/handoff/2026-09-28) — ported from the reference build's
// SLAddEventModal. One modal for both a past occurrence and a future one; as the user types a
// headline (debounced, length >= 12), suggestForceForEvent (ai-forces.ts) proposes which
// existing force it pulls on and toward which pole — the same job the old KB "merge into
// signal" modal made the user do by hand (see page-signals.tsx's mergeInsight prefill).
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/chip";
import { Stars } from "@/lib/icons";
import type { EventItem, Signal, SteepCategory } from "@/lib/types";
import { slPole } from "./pole";

const STEEP_CATEGORIES: SteepCategory[] = ["Social", "Technology", "Economic", "Ecological", "Political"];

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-0.5 rounded-md bg-[#F3F4F6] p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-md border-0 px-2.5 py-1.5 text-xs font-medium",
            value === v ? "bg-white font-semibold text-brand-dark shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "bg-transparent text-muted-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export interface AddEventModalPreset {
  sigId?: string;
  side?: "a" | "b";
  title?: string;
  // Knowledge Base's "+ Merge into Signal →" prefill (page-signals.tsx's mergeInsight flow) —
  // the insight's own quote/text, landed in "What it would mean" for the user to turn into a
  // real headline rather than guessing one for them.
  body?: string;
}

export interface AddEventInput {
  title: string;
  body: string;
  status: "observed" | "possible";
  occurredOn: string | null;
  windowLabel: string | null;
  source: string | null;
  likelihood: "Low" | "Medium" | "High" | null;
  impact: number;
  category: SteepCategory | null;
  target: { sigId: string; side: "a" | "b" } | null;
}

export interface AddEventModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signals: Signal[];
  preset?: AddEventModalPreset | null;
  onSuggestForce: (input: { title: string; body: string }) => Promise<{ signalId: string; side: "a" | "b"; rationale: string } | null>;
  onSubmit: (input: AddEventInput) => Promise<EventItem>;
  onAdded: (ev: EventItem) => void;
}

export function AddEventModal({ open, onOpenChange, signals, preset, onSuggestForce, onSubmit, onAdded }: AddEventModalProps) {
  const [title, setTitle] = React.useState(preset?.title ?? "");
  const [body, setBody] = React.useState("");
  const [status, setStatus] = React.useState<"observed" | "possible">("possible");
  const [date, setDate] = React.useState("");
  const [source, setSource] = React.useState("");
  const [likelihood, setLikelihood] = React.useState<"Low" | "Medium" | "High">("Medium");
  const [impact, setImpact] = React.useState(3);
  const [category, setCategory] = React.useState<SteepCategory>("Political");
  const [target, setTarget] = React.useState<{ sigId: string; side: "a" | "b" } | null>(
    preset?.sigId ? { sigId: preset.sigId, side: preset.side ?? "b" } : null
  );
  const [touched, setTouched] = React.useState(!!preset?.sigId);
  const [suggestion, setSuggestion] = React.useState<{ signalId: string; side: "a" | "b"; rationale: string } | null>(null);
  const [thinking, setThinking] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setTitle(preset?.title ?? "");
    setBody(preset?.body ?? "");
    setStatus("possible");
    setDate("");
    setSource("");
    setLikelihood("Medium");
    setImpact(3);
    setCategory("Political");
    setTarget(preset?.sigId ? { sigId: preset.sigId, side: preset.side ?? "b" } : null);
    setTouched(!!preset?.sigId);
    setSuggestion(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preset]);

  React.useEffect(() => {
    if (touched || title.trim().length < 12) return;
    let live = true;
    const t = setTimeout(async () => {
      setThinking(true);
      try {
        const s = await onSuggestForce({ title, body });
        if (!live) return;
        setSuggestion(s);
        setTarget(s ? { sigId: s.signalId, side: s.side } : null);
      } catch (err) {
        console.error("[signals] force suggestion failed", err);
      } finally {
        if (live) setThinking(false);
      }
    }, 550);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [title, body, touched, onSuggestForce]);

  const sig = target ? signals.find((s) => s.id === target.sigId) : undefined;
  const ok = title.trim().length >= 8 && !saving;

  const submit = async () => {
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const ev = await onSubmit({
        title: title.trim(),
        body: body.trim(),
        status,
        occurredOn: status === "observed" ? date.trim() || new Date().toISOString().slice(0, 10) : null,
        windowLabel: status === "possible" ? date.trim() || "Within horizon" : null,
        source: status === "observed" ? source.trim() || null : null,
        likelihood: status === "possible" ? likelihood : null,
        impact,
        category: sig ? null : category,
        target: sig && target ? target : null,
      });
      onAdded(ev);
      onOpenChange(false);
    } catch (err) {
      console.error("[signals] failed to add event", err);
      setError("Couldn't add the event — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-40px)] max-w-[540px] overflow-y-auto rounded-2xl p-6">
        <div className="mb-1 flex items-start justify-between gap-2">
          <div>
            <DialogTitle className="text-lg font-semibold tracking-[-0.01em]">Add an event</DialogTitle>
            <div className="mt-1 text-[12.5px] text-muted-foreground">Something that happened, or could happen. One headline, one occurrence.</div>
          </div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div>
            <Label htmlFor="event-title" className="mb-1.5 block text-xs">
              Headline
            </Label>
            <Input
              id="event-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Malaysia caps foreign ownership of data centres at 49%"
            />
          </div>
          <Seg
            value={status}
            onChange={setStatus}
            options={[
              ["observed", "It happened"],
              ["possible", "It could happen"],
            ]}
          />
          {status === "observed" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="event-date" className="mb-1.5 block text-xs">
                  When
                </Label>
                <Input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="event-source" className="mb-1.5 block text-xs">
                  Source
                </Label>
                <Input id="event-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Reuters" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-end gap-3">
              <div>
                <Label htmlFor="event-window" className="mb-1.5 block text-xs">
                  By when
                </Label>
                <Input id="event-window" value={date} onChange={(e) => setDate(e.target.value)} placeholder="e.g. 2027–28" />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs">How likely</Label>
                <Seg
                  value={likelihood}
                  onChange={setLikelihood}
                  options={[
                    ["Low", "Low"],
                    ["Medium", "Medium"],
                    ["High", "High"],
                  ]}
                />
              </div>
            </div>
          )}
          <div>
            <Label className="mb-1.5 block text-xs">Impact on your decision</Label>
            <div className="flex h-9 items-center">
              <Stars value={impact} size={16} onChange={setImpact} />
            </div>
          </div>
          <div>
            <Label htmlFor="event-body" className="mb-1.5 block text-xs">
              What it would mean <span className="font-normal normal-case text-text-3">· optional</span>
            </Label>
            <Textarea id="event-body" rows={2} value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[60px]" placeholder="Who is affected, and how" />
          </div>

          <div className="flex flex-col gap-2.5 rounded-[10px] border border-border bg-[#FAFAF9] p-3">
            <span className="font-mono text-[10px] tracking-[0.06em] text-text-3">WHICH FORCE DOES IT PULL ON?</span>
            {thinking && <span className="animate-pulse text-[12.5px] text-brand-orange700">✦ Finding the force this pulls on…</span>}
            {!thinking && suggestion && !touched && sig && (
              <span className="text-[12.5px] leading-[1.5] text-[#7C2D12]">
                ✦ Suggested: <b>{sig.title}</b>, toward <b>{slPole(sig, suggestion.side)}</b>. {suggestion.rationale}
              </span>
            )}
            {!thinking && !suggestion && !touched && title.trim().length >= 12 && (
              <span className="text-xs text-muted-foreground">No clear match. Pick a force or leave it in the inbox to group later.</span>
            )}
            <Select
              value={target?.sigId ?? "none"}
              onValueChange={(v) => {
                setTouched(true);
                setTarget(v === "none" ? null : { sigId: v, side: target?.side ?? "b" });
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Leave in inbox — group it later" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Leave in inbox — group it later</SelectItem>
                {signals.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sig && target && (
              <Seg
                value={target.side}
                onChange={(v) => {
                  setTouched(true);
                  setTarget({ ...target, side: v });
                }}
                options={[
                  ["a", `← ${slPole(sig, "a")}`],
                  ["b", `${slPole(sig, "b")} →`],
                ]}
              />
            )}
            {!sig && (
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
            )}
          </div>
          {error && <div className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-[11px] py-2 text-[12.5px] text-[#EF4444]">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!ok} onClick={submit}>
              {saving ? "Adding…" : sig ? "Add event" : "Add to inbox"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
