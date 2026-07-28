"use client";

// Signals Library — faithful Tailwind/shadcn port of the handoff page-signals.jsx.
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icons, Stars } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip } from "@/components/chip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { getInsight, type InsightRow } from "@/lib/actions/insights";
import { getSource } from "@/lib/actions/sources";
import { suggestSignalCategory } from "@/lib/actions/ai-signals";
import type { Signal, SteepCategory } from "@/lib/types";

const STEEP_CATEGORIES: SteepCategory[] = ["Social", "Technology", "Economic", "Ecological", "Political"];

interface NewSignalForm {
  category: SteepCategory;
  title: string;
  source: string;
  body: string;
  impact: number; // 0 = unset
  uncertainty: "" | "Low" | "Medium" | "High";
}

const EMPTY_FORM: NewSignalForm = { category: "Technology", title: "", source: "", body: "", impact: 0, uncertainty: "" };

function citationFor(insight: InsightRow, sourceName: string | null): string {
  if (insight.speaker_name) return `${insight.source_type ?? "Knowledge Base"} — ${insight.speaker_name}`;
  if (sourceName) return sourceName;
  return insight.source_type ?? "Knowledge Base";
}

const CATEGORIES: Array<"All" | SteepCategory> = ["All", "Social", "Technology", "Economic", "Ecological", "Political"];

// Filter-pill classes (literal strings so Tailwind JIT keeps them).
const PILL: Record<string, { active: string; inactive: string }> = {
  All: { active: "bg-brand-orange text-white border-brand-orange", inactive: "bg-white text-muted-foreground border-border" },
  Social: { active: "bg-steep-social text-white border-steep-social", inactive: "bg-[#F5F3FF] text-steep-social border-[rgba(139,92,246,0.4)]" },
  Technology: { active: "bg-steep-technology text-white border-steep-technology", inactive: "bg-[#EFF6FF] text-steep-technology border-[rgba(59,130,246,0.4)]" },
  Economic: { active: "bg-steep-economic text-white border-steep-economic", inactive: "bg-[#ECFDF5] text-steep-economic border-[rgba(16,185,129,0.4)]" },
  Ecological: { active: "bg-steep-ecological text-white border-steep-ecological", inactive: "bg-[#F0FDFA] text-steep-ecological border-[rgba(20,184,166,0.4)]" },
  Political: { active: "bg-steep-political text-white border-steep-political", inactive: "bg-[#FEF2F2] text-steep-political border-[rgba(239,68,68,0.4)]" },
};

function uncertaintyBadge(u: Signal["uncertainty"]) {
  if (u === "High") return "bg-brand-orangeLight text-brand-orange700";
  if (u === "Medium") return "bg-[#FFFBEB] text-[#B45309]";
  return "bg-[#ECFDF5] text-[#065F46]";
}

const BADGE_BASE = "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";

export function PageSignals() {
  const store = useStore();
  const signals = store.signals;
  const navigate = useNavigate();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filter, setFilter] = React.useState<"All" | SteepCategory>("All");
  const [selected, setSelected] = React.useState<Signal | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [form, setForm] = React.useState<NewSignalForm>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestResult, setSuggestResult] = React.useState<string | null>(null);

  // "+ Merge into Signal" from a Knowledge Base insight card lands here as
  // /signals?mergeInsight={id} — see src/components/page-knowledge.tsx.
  const [mergeInsight, setMergeInsight] = React.useState<InsightRow | null>(null);
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [mergeMode, setMergeMode] = React.useState<"existing" | "new">("new");
  const [mergeTargetId, setMergeTargetId] = React.useState("");
  const [mergeForm, setMergeForm] = React.useState<NewSignalForm>(EMPTY_FORM);
  const [mergeError, setMergeError] = React.useState<string | null>(null);
  const [mergeSubmitting, setMergeSubmitting] = React.useState(false);
  const [categorySuggesting, setCategorySuggesting] = React.useState(false);
  // Guards against a slow AI response landing after the user has already picked a
  // category themselves — set on the category Select's onValueChange, never reset while
  // this modal instance is open.
  const categoryTouchedRef = React.useRef(false);

  React.useEffect(() => {
    const insightId = searchParams.get("mergeInsight");
    if (!insightId) return;
    // Clear the param immediately (replace, not push) so a refresh never reopens this —
    // the fetch below still uses the id it captured before the param is gone.
    router.replace("/signals");
    categoryTouchedRef.current = false;
    (async () => {
      try {
        const insight = await getInsight(insightId);
        if (!insight) return;
        const source = insight.source_id ? await getSource(insight.source_id) : null;
        setMergeInsight(insight);
        setMergeMode(signals.length > 0 ? "existing" : "new");
        setMergeTargetId(signals[0]?.id ?? "");
        setMergeForm({
          category: insight.category && insight.category !== "local_actor" ? insight.category : "Technology",
          title: "",
          source: citationFor(insight, source?.name ?? null),
          body: insight.text,
          impact: 0,
          uncertainty: "",
        });
        setMergeOpen(true);

        // AI's first attempt at the category, per the project's own focal question —
        // replaces the instant fallback above once it lands, unless the user already
        // picked one themselves in the meantime.
        if (store.activeProjectId) {
          setCategorySuggesting(true);
          suggestSignalCategory({ projectId: store.activeProjectId, text: insight.text })
            .then(({ category }) => {
              if (!categoryTouchedRef.current) setMergeForm((f) => ({ ...f, category }));
            })
            .catch((err) => console.error("[signals] category suggestion failed", err))
            .finally(() => setCategorySuggesting(false));
        }
      } catch (err) {
        console.error("[signals] failed to load insight for merge", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const onMergeIntoExisting = async () => {
    if (!mergeInsight || !mergeTargetId) {
      setMergeError("Choose a signal to merge into.");
      return;
    }
    const target = signals.find((s) => s.id === mergeTargetId);
    if (!target) {
      setMergeError("Choose a signal to merge into.");
      return;
    }
    setMergeSubmitting(true);
    setMergeError(null);
    try {
      const quote = mergeInsight.quote || mergeInsight.text;
      await store.updateSignal({ id: target.id, body: `${target.body}\n\n— ${quote}`.trim() });
      setMergeOpen(false);
      setMergeInsight(null);
    } catch (err) {
      console.error("[signals] failed to merge insight into signal", err);
      setMergeError("Couldn't merge into that signal — try again.");
    } finally {
      setMergeSubmitting(false);
    }
  };

  const onCreateFromInsight = async () => {
    if (!mergeForm.title.trim()) {
      setMergeError("Title is required.");
      return;
    }
    if (!store.activeProjectId) {
      setMergeError("No active project.");
      return;
    }
    setMergeSubmitting(true);
    setMergeError(null);
    try {
      await store.createSignal({
        projectId: store.activeProjectId,
        category: mergeForm.category,
        source: mergeForm.source.trim() || "Knowledge Base",
        title: mergeForm.title.trim(),
        body: mergeForm.body.trim(),
        origin: "insight",
      });
      setMergeOpen(false);
      setMergeInsight(null);
    } catch (err) {
      console.error("[signals] failed to create signal from insight", err);
      setMergeError("Couldn't create the signal — try again.");
    } finally {
      setMergeSubmitting(false);
    }
  };

  const filtered = filter === "All" ? signals : signals.filter((s) => s.category === filter);
  const unscoredCount = signals.filter((s) => s.impact == null || s.uncertainty == null).length;

  // Detail-modal editing (in place, not a separate dialog) — see the detail modal below.
  const [editOpen, setEditOpen] = React.useState(false);
  const [editForm, setEditForm] = React.useState<NewSignalForm>(EMPTY_FORM);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = React.useState(false);

  const onStartEdit = () => {
    if (!selected) return;
    setEditForm({
      title: selected.title,
      body: selected.body,
      category: selected.category,
      source: selected.source,
      impact: selected.impact ?? 0,
      uncertainty: selected.uncertainty ?? "",
    });
    setEditError(null);
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!selected) return;
    if (!editForm.title.trim()) {
      setEditError("Title is required.");
      return;
    }
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await store.updateSignal({
        id: selected.id,
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        category: editForm.category,
        source: editForm.source.trim(),
        impact: editForm.impact > 0 ? editForm.impact : null,
        uncertainty: editForm.uncertainty || null,
      });
      setSelected(updated);
      setEditOpen(false);
    } catch (err) {
      console.error("[signals] failed to save signal edit", err);
      setEditError("Couldn't save — try again.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const onSubmitSignal = async () => {
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!store.activeProjectId) {
      setFormError("No active project.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await store.createSignal({
        projectId: store.activeProjectId,
        category: form.category,
        source: form.source.trim() || "Manual entry",
        title: form.title.trim(),
        body: form.body.trim(),
        impact: form.impact > 0 ? form.impact : null,
        uncertainty: form.uncertainty || null,
      });
      setAddOpen(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      console.error("[signals] failed to create signal", err);
      setFormError("Couldn't create the signal — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDeleteSignal = async (id: string) => {
    await store.deleteSignal(id);
    setSelected(null);
  };

  const onSuggestSignals = async () => {
    if (!store.activeProjectId) return;
    setSuggesting(true);
    setSuggestResult(null);
    try {
      const suggestion = await store.suggestSignals(store.activeProjectId);
      if (suggestion.created === 0) {
        setSuggestResult("No new signals to suggest right now.");
      } else {
        const scoring = await store.scoreUnscoredSignals(store.activeProjectId);
        setSuggestResult(`Suggested ${suggestion.created} signal(s), scored ${scoring.scored}.`);
      }
    } catch (err) {
      console.error("[signals] suggestion failed", err);
      setSuggestResult("Couldn't suggest signals right now — try again in a moment.");
    } finally {
      setSuggesting(false);
    }
  };

  const onScoreUnscored = async () => {
    if (!store.activeProjectId) return;
    setSuggesting(true);
    setSuggestResult(null);
    try {
      const scoring = await store.scoreUnscoredSignals(store.activeProjectId);
      setSuggestResult(scoring.scored === 0 ? "Couldn't score those signals — try again." : `Scored ${scoring.scored} signal(s).`);
    } catch (err) {
      console.error("[signals] scoring failed", err);
      setSuggestResult("Couldn't score signals right now — try again in a moment.");
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-card p-[18px] shadow-card">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Signals Library</h2>
            <div className="mt-0.5 text-[13px] text-muted-foreground">
              STEEP forces. Rank by impact and uncertainty to find scenario axes.
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <Icons.Filter size={12} /> Sort
            </Button>
            <Button
              variant="soft"
              size="sm"
              onClick={onSuggestSignals}
              disabled={suggesting || !store.activeProjectId}
            >
              <Icons.Sparkle size={12} /> {suggesting ? "Suggesting…" : "Suggest signals"}
            </Button>
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)}>
              <Icons.Plus size={12} /> Add Signal
            </Button>
          </div>
        </div>

        {suggestResult && (
          <div className="mb-3.5 rounded-[10px] border border-border bg-[#F9FAFB] px-3 py-2 text-xs text-muted-foreground">
            {suggestResult}
          </div>
        )}

        {/* Filter pills */}
        <div className="mb-[18px] flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = filter === c;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn("rounded-full border px-3 py-[5px] text-xs font-medium", active ? PILL[c].active : PILL[c].inactive)}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Cards */}
        {store.signalsLoading && signals.length === 0 && (
          <div className="mb-3 text-center text-xs text-muted-foreground">Loading signals…</div>
        )}
        {!store.signalsLoading && unscoredCount > 0 && (
          <div className="mb-3.5 flex items-center justify-between rounded-[10px] border border-border bg-[#F9FAFB] px-3.5 py-2.5">
            <span className="text-xs text-muted-foreground">
              {unscoredCount} signal{unscoredCount === 1 ? "" : "s"} not yet scored.
            </span>
            <Button variant="ghost" size="sm" onClick={onScoreUnscored} disabled={suggesting}>
              {suggesting ? "Scoring…" : "Score now"}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              className="flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-white p-3.5 transition-[border,transform] duration-[120ms] hover:border-border-strong"
            >
              <div className="flex items-center justify-between">
                <Chip category={s.category} />
                <span className="font-mono text-[10.5px] text-text-3">{s.source}</span>
              </div>
              <div className="text-sm font-semibold leading-[1.3] tracking-[-0.01em] text-brand-dark">{s.title}</div>
              <div className="flex-1 text-[12.5px] leading-[1.5] text-muted-foreground">{s.body}</div>
              {s.impact != null && s.uncertainty != null ? (
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-mono text-[11px] text-text-3">IMPACT</span>
                  <Stars value={s.impact} size={11} />
                  <span className={cn("ml-auto", BADGE_BASE, uncertaintyBadge(s.uncertainty))}>{s.uncertainty}</span>
                </div>
              ) : (
                <div className="mt-1 flex items-center">
                  <span className={cn(BADGE_BASE, "bg-[#F3F4F6] text-[#4B5563]")}>Not yet scored</span>
                </div>
              )}
              <div className="mt-1 flex items-center gap-1.5">
                <Button
                  variant="soft"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/matrix");
                  }}
                >
                  + Add to Matrix
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSignal(s.id);
                  }}
                  aria-label={`Delete ${s.title}`}
                >
                  <Icons.Trash size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail modal */}
      <Dialog
        open={!!selected}
        onOpenChange={(o) => {
          if (!o) {
            setSelected(null);
            setEditOpen(false);
          }
        }}
      >
        {selected && !editOpen && (
          <DialogContent className="max-w-[540px] rounded-2xl p-6">
            <div className="mb-3 flex items-center justify-between">
              <Chip category={selected.category} />
              <Button variant="ghost" size="sm" onClick={onStartEdit}>
                Edit
              </Button>
            </div>
            <DialogTitle className="mb-1.5 text-xl font-semibold tracking-[-0.01em]">{selected.title}</DialogTitle>
            <div className="mb-3.5 font-mono text-[11.5px] text-text-3">SOURCE · {selected.source.toUpperCase()}</div>
            <p className="mb-[18px] text-sm leading-[1.6] text-[#374151]">{selected.body}</p>
            {selected.impact != null && selected.uncertainty != null ? (
              <div className="mb-[18px] grid grid-cols-2 gap-3">
                <div className="rounded-[10px] border border-border p-3">
                  <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">IMPACT</div>
                  <div className="mt-1.5 flex items-center gap-1">
                    <Stars value={selected.impact} size={14} />
                    <span className="ml-1 text-[13px] font-semibold">{selected.impact}/5</span>
                  </div>
                </div>
                <div className="rounded-[10px] border border-border p-3">
                  <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">UNCERTAINTY</div>
                  <div className="mt-1.5">
                    <span className={cn(BADGE_BASE, "text-[11px]", uncertaintyBadge(selected.uncertainty))}>
                      {selected.uncertainty}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-[18px] rounded-[10px] border border-border p-3">
                <span className={cn(BADGE_BASE, "bg-[#F3F4F6] text-[#4B5563]")}>Not yet scored</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  setSelected(null);
                  navigate("/matrix");
                }}
              >
                Place on matrix →
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        )}

        {selected && editOpen && (
          <DialogContent className="max-w-[480px] rounded-2xl p-6">
            <DialogTitle className="mb-4 text-lg font-semibold tracking-[-0.01em]">Edit signal</DialogTitle>
            <div className="flex flex-col gap-3.5">
              <div>
                <Label htmlFor="edit-title" className="mb-1.5 block text-xs">
                  Title
                </Label>
                <Input id="edit-title" autoFocus value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="edit-body" className="mb-1.5 block text-xs">
                  Description
                </Label>
                <Textarea
                  id="edit-body"
                  rows={3}
                  value={editForm.body}
                  onChange={(e) => setEditForm((f) => ({ ...f, body: e.target.value }))}
                  className="min-h-[70px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block text-xs">STEEP category</Label>
                  <Select value={editForm.category} onValueChange={(v) => setEditForm((f) => ({ ...f, category: v as SteepCategory }))}>
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
                  <Label htmlFor="edit-source" className="mb-1.5 block text-xs">
                    Source
                  </Label>
                  <Input id="edit-source" value={editForm.source} onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block text-xs">Impact</Label>
                  <div className="flex h-9 items-center">
                    <Stars value={editForm.impact} size={16} onChange={(v) => setEditForm((f) => ({ ...f, impact: v }))} />
                  </div>
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs">Uncertainty</Label>
                  <div className="grid grid-cols-3 gap-0.5 rounded-md bg-[#F3F4F6] p-0.5">
                    {(["Low", "Medium", "High"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setEditForm((f) => ({ ...f, uncertainty: u }))}
                        className={cn(
                          "rounded-md border-0 px-2 py-1.5 text-xs font-medium",
                          editForm.uncertainty === u ? "bg-white font-semibold text-brand-dark shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "bg-transparent text-muted-foreground"
                        )}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {editError && (
                <div className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-[11px] py-2 text-[12.5px] text-[#EF4444]">{editError}</div>
              )}
              <div className="mt-1 flex gap-2">
                <Button variant="primary" className="flex-1" onClick={onSaveEdit} disabled={editSubmitting}>
                  {editSubmitting ? "Saving…" : "Save"}
                </Button>
                <Button variant="ghost" onClick={() => setEditOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Add Signal modal */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) {
            setForm(EMPTY_FORM);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-w-[480px] rounded-2xl p-6">
          <DialogTitle className="mb-4 text-lg font-semibold tracking-[-0.01em]">Add signal</DialogTitle>
          <div className="flex flex-col gap-3.5">
            <div>
              <Label htmlFor="signal-title" className="mb-1.5 block text-xs">
                Title
              </Label>
              <Input
                id="signal-title"
                autoFocus
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. ASEAN ratifies the digital trade pact"
              />
            </div>
            <div>
              <Label htmlFor="signal-body" className="mb-1.5 block text-xs">
                Description
              </Label>
              <Textarea
                id="signal-body"
                rows={3}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="What happens. Why it matters. (1–2 sentences)"
                className="min-h-[70px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs">STEEP category</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as SteepCategory }))}>
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
                <Input
                  id="signal-source"
                  value={form.source}
                  onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                  placeholder="Internal research, …"
                />
              </div>
            </div>
            {formError && (
              <div className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-[11px] py-2 text-[12.5px] text-[#EF4444]">
                {formError}
              </div>
            )}
            <div className="mt-1 flex gap-2">
              <Button variant="primary" className="flex-1" onClick={onSubmitSignal} disabled={submitting}>
                {submitting ? "Adding…" : "Add signal"}
              </Button>
              <Button variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
            </div>
            <div className="text-center text-[11.5px] text-muted-foreground">
              Impact and uncertainty are scored by AI after adding — use{" "}
              <span className="font-medium text-brand-dark">Score now</span> once it appears unscored.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge into Signal modal */}
      <Dialog
        open={mergeOpen}
        onOpenChange={(o) => {
          setMergeOpen(o);
          if (!o) {
            setMergeInsight(null);
            setMergeError(null);
          }
        }}
      >
        {mergeInsight && (
          <DialogContent className="max-w-[480px] rounded-2xl p-6">
            <DialogTitle className="mb-3 text-lg font-semibold tracking-[-0.01em]">Merge into signal</DialogTitle>
            <div className="mb-4 rounded-[10px] border border-border bg-[#F9FAFB] p-3 text-[12.5px] italic leading-[1.5] text-brand-dark">
              &quot;{mergeInsight.quote || mergeInsight.text}&quot;
            </div>

            <div className="mb-3.5 grid grid-cols-2 gap-0.5 rounded-md bg-[#F3F4F6] p-0.5">
              <button
                onClick={() => setMergeMode("existing")}
                disabled={signals.length === 0}
                className={cn(
                  "rounded-md border-0 px-2 py-1.5 text-xs font-medium disabled:opacity-40",
                  mergeMode === "existing" ? "bg-white font-semibold text-brand-dark shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "bg-transparent text-muted-foreground"
                )}
              >
                Merge into existing
              </button>
              <button
                onClick={() => setMergeMode("new")}
                className={cn(
                  "rounded-md border-0 px-2 py-1.5 text-xs font-medium",
                  mergeMode === "new" ? "bg-white font-semibold text-brand-dark shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "bg-transparent text-muted-foreground"
                )}
              >
                Create new signal
              </button>
            </div>

            {mergeMode === "existing" ? (
              <div className="flex flex-col gap-3.5">
                <div>
                  <Label className="mb-1.5 block text-xs">Signal</Label>
                  <Select value={mergeTargetId} onValueChange={setMergeTargetId}>
                    <SelectTrigger>
                      <SelectValue />
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
                {mergeError && (
                  <div className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-[11px] py-2 text-[12.5px] text-[#EF4444]">
                    {mergeError}
                  </div>
                )}
                <div className="mt-1 flex gap-2">
                  <Button variant="primary" className="flex-1" onClick={onMergeIntoExisting} disabled={mergeSubmitting}>
                    {mergeSubmitting ? "Merging…" : "Merge"}
                  </Button>
                  <Button variant="ghost" onClick={() => setMergeOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3.5">
                <div>
                  <Label htmlFor="merge-title" className="mb-1.5 block text-xs">
                    Title
                  </Label>
                  <Input
                    id="merge-title"
                    autoFocus
                    value={mergeForm.title}
                    onChange={(e) => setMergeForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. ASEAN ratifies the digital trade pact"
                  />
                </div>
                <div>
                  <Label htmlFor="merge-body" className="mb-1.5 block text-xs">
                    Description
                  </Label>
                  <Textarea
                    id="merge-body"
                    rows={3}
                    value={mergeForm.body}
                    onChange={(e) => setMergeForm((f) => ({ ...f, body: e.target.value }))}
                    className="min-h-[70px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1.5 block text-xs">
                      STEEP category {categorySuggesting && <span className="font-normal normal-case text-text-3">— suggesting…</span>}
                    </Label>
                    <Select
                      value={mergeForm.category}
                      onValueChange={(v) => {
                        categoryTouchedRef.current = true;
                        setMergeForm((f) => ({ ...f, category: v as SteepCategory }));
                      }}
                      disabled={categorySuggesting}
                    >
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
                    <Label htmlFor="merge-source" className="mb-1.5 block text-xs">
                      Source
                    </Label>
                    <Input
                      id="merge-source"
                      value={mergeForm.source}
                      onChange={(e) => setMergeForm((f) => ({ ...f, source: e.target.value }))}
                    />
                  </div>
                </div>
                {mergeError && (
                  <div className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-[11px] py-2 text-[12.5px] text-[#EF4444]">
                    {mergeError}
                  </div>
                )}
                <div className="mt-1 flex gap-2">
                  <Button variant="primary" className="flex-1" onClick={onCreateFromInsight} disabled={mergeSubmitting}>
                    {mergeSubmitting ? "Creating…" : "Create & merge"}
                  </Button>
                  <Button variant="ghost" onClick={() => setMergeOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
