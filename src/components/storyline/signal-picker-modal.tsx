"use client";

// Signal picker modal — surfaces from Storyline's "+ Add Signal to Chain".
// Two tabs: pick from library OR create new. Both converge on a "place in column" +
// "connect from" selector, then commit through the canvas callbacks. Faithful port of
// signal-picker-modal.jsx (uses the store's signals as the library).
import * as React from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { Chip } from "@/components/chip";
import { ImpactStars } from "./signal-card";
import { toBackendPhase } from "./story-adapter";
import { createStorylineNode, updateStorylineNode, createStorylineEdge } from "@/lib/actions/storyline";
import type { Signal, SteepCategory } from "@/lib/types";
import type { StoryNode, StoryEdge, StoryPhase } from "./data";

const STEEP_CATS: SteepCategory[] = ["Social", "Technology", "Economic", "Ecological", "Political"];
const UNCERTAINTY_BADGE: Record<string, { bg: string; fg: string }> = {
  High: { bg: "#FEF2F2", fg: "#EF4444" },
  Medium: { bg: "#FFFBEB", fg: "#F59E0B" },
  Low: { bg: "#ECFDF5", fg: "#10B981" },
};

export interface SignalPickerModalProps {
  open: boolean;
  onClose: () => void;
  scenarioId: string;
  nodes: StoryNode[];
  edges: StoryEdge[];
  phases: StoryPhase[];
  columnLabels: string[];
  setNodes: (updater: StoryNode[] | ((prev: StoryNode[]) => StoryNode[])) => void;
  setEdges: (updater: StoryEdge[] | ((prev: StoryEdge[]) => StoryEdge[])) => void;
  showToast: (msg: string, kind?: "success" | "error") => void;
  // Set when opened from a specific phase column's "+ Add signal" slot — wins over
  // defaultColumn's fewest-nodes heuristic below, but still just seeds the same editable
  // dropdown rather than skipping it.
  initialPlacement?: string;
}

interface NewSignalForm {
  title: string;
  body: string;
  category: SteepCategory;
  source: string;
  impact: number;
  uncertainty: "Low" | "Medium" | "High";
}

export function SignalPickerModal({ open, onClose, scenarioId, nodes, phases, columnLabels, setNodes, setEdges, showToast, initialPlacement }: SignalPickerModalProps) {
  const store = useStore();
  const [tab, setTab] = React.useState<"library" | "create">("library");
  const [search, setSearch] = React.useState("");
  const [filterCat, setFilterCat] = React.useState<"All" | SteepCategory>("All");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const defaultColumn = React.useMemo(() => {
    const counts = phases.map((p) => ({ id: p.id, count: nodes.filter((n) => n.phase === p.id).length }));
    counts.sort((a, b) => a.count - b.count);
    return counts[0] ? counts[0].id : phases[0] && phases[0].id;
  }, [nodes, phases]);
  const [placement, setPlacement] = React.useState(defaultColumn);
  const [connectFrom, setConnectFrom] = React.useState("");

  const [form, setForm] = React.useState<NewSignalForm>({ title: "", body: "", category: "Technology", source: "", impact: 3, uncertainty: "Medium" });
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTab("library");
      setSearch("");
      setFilterCat("All");
      setSelected(new Set());
      setPlacement(initialPlacement ?? defaultColumn);
      setConnectFrom("");
      setForm({ title: "", body: "", category: "Technology", source: "", impact: 3, uncertainty: "Medium" });
      setFormError(null);
    }
  }, [open, defaultColumn, initialPlacement]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const library = store.signals;
  const chainTitles = new Set(nodes.map((n) => (n.title || "").toLowerCase()));

  const filtered = library.filter((s) => {
    if (filterCat !== "All" && s.category !== filterCat) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (s.title || "").toLowerCase().includes(q) || (s.source || "").toLowerCase().includes(q) || (s.body || "").toLowerCase().includes(q);
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Local-state commit only — the backend write already happened by the time this is called
  // (both callers below await creation first, same "write, then render" pattern as
  // canvas.tsx's insertBetween, needed because real node ids come from the server).
  const commitAdd = (newChainNodes: StoryNode[], movedIds: Set<string>, newEdges: StoryEdge[] = []) => {
    if (newChainNodes.length === 0 && movedIds.size === 0) return;
    setNodes((prev) => {
      const updated = prev.map((n) => (movedIds.has(n.id) ? { ...n, phase: placement } : n));
      const phaseStart = updated.findIndex((n) => n.phase === placement);
      const insertAt =
        phaseStart === -1
          ? updated.length
          : (() => {
              let idx = phaseStart;
              while (idx < updated.length && updated[idx].phase === placement) idx++;
              return idx;
            })();
      return [...updated.slice(0, insertAt), ...newChainNodes, ...updated.slice(insertAt)];
    });

    if (newEdges.length > 0) {
      setEdges((es) => [...es, ...newEdges]);
    }

    const colLabelIdx = phases.findIndex((p) => p.id === placement);
    const colLabel = columnLabels[colLabelIdx] || (phases[colLabelIdx] && phases[colLabelIdx].id) || placement;
    const total = newChainNodes.length + movedIds.size;
    showToast(total === 1 ? `Added 1 signal to ${colLabel}` : `Added ${total} signals to ${colLabel}`);
    onClose();
  };

  const handleAddFromLibrary = async () => {
    if (selected.size === 0) return;
    const picked = library.filter((s) => selected.has(s.id));
    // Signals already represented in the chain (matched by whether a node already links to
    // this signal_id) move to the new placement instead of creating a duplicate node.
    const alreadyInChain = new Map(nodes.filter((n) => n.signalId).map((n) => [n.signalId as string, n.id]));
    const toMove = picked.filter((s) => alreadyInChain.has(s.id));
    const toCreate = picked.filter((s) => !alreadyInChain.has(s.id));

    setSubmitting(true);
    try {
      const movedIds = new Set<string>();
      for (const s of toMove) {
        const nodeId = alreadyInChain.get(s.id)!;
        await updateStorylineNode({ id: nodeId, phase: toBackendPhase(placement) });
        movedIds.add(nodeId);
      }

      const newChainNodes: StoryNode[] = [];
      const newEdges: StoryEdge[] = [];
      for (const s of toCreate) {
        const created = await createStorylineNode({ scenarioId, phase: toBackendPhase(placement), signalId: s.id });
        if (connectFrom) {
          const edge = await createStorylineEdge({ scenarioId, fromNodeId: connectFrom, toNodeId: created.id, relationship: "Leads to", confidence: "Moderate" });
          newEdges.push({ id: edge.id, from: connectFrom, to: created.id, relationship: edge.relationship, confidence: edge.confidence });
        }
        newChainNodes.push({
          id: created.id,
          phase: placement,
          cat: created.category,
          title: created.title,
          body: created.body || "",
          year: created.year != null ? String(created.year) : "—",
          source: s.source,
          impact: s.impact ?? undefined,
          uncertainty: s.uncertainty ?? undefined,
          strength: 0.65,
          signalId: s.id,
        });
      }
      commitAdd(newChainNodes, movedIds, newEdges);
    } catch (err) {
      console.error("[signal-picker] failed to add signal(s) to chain", err);
      showToast("Couldn't add those signals", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateNew = async () => {
    if (!form.title.trim()) {
      setFormError("Title is required.");
      return;
    }
    if (!store.activeProjectId) {
      setFormError("No active project.");
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      const newSignal = await store.createSignal({
        projectId: store.activeProjectId,
        category: form.category,
        source: form.source.trim() || "Internal research",
        title: form.title.trim(),
        body: form.body.trim(),
        impact: form.impact,
        uncertainty: form.uncertainty,
      });
      const created = await createStorylineNode({ scenarioId, phase: toBackendPhase(placement), signalId: newSignal.id });
      const newEdges: StoryEdge[] = [];
      if (connectFrom) {
        const edge = await createStorylineEdge({ scenarioId, fromNodeId: connectFrom, toNodeId: created.id, relationship: "Leads to", confidence: "Moderate" });
        newEdges.push({ id: edge.id, from: connectFrom, to: created.id, relationship: edge.relationship, confidence: edge.confidence });
      }
      commitAdd(
        [
          {
            id: created.id,
            phase: placement,
            cat: created.category,
            title: created.title,
            body: created.body || "",
            year: "—",
            source: newSignal.source,
            impact: newSignal.impact ?? undefined,
            uncertainty: newSignal.uncertainty ?? undefined,
            strength: 0.65,
            signalId: newSignal.id,
          },
        ],
        new Set(),
        newEdges
      );
    } catch (err) {
      console.error("[signal-picker] failed to create signal", err);
      setFormError("Couldn't create the signal — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalSelectedCount = selected.size;
  const primaryDisabled = submitting || (tab === "library" ? totalSelectedCount === 0 : !form.title.trim());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add signal to storyline"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fade-in fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(30,27,46,0.40)] p-6 backdrop-blur-[4px]"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="slide-up relative flex max-h-[calc(100vh-48px)] w-full max-w-[720px] flex-col rounded-xl bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25),0_8px_24px_rgba(15,23,42,0.12)]"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-0 bg-transparent text-muted-foreground hover:bg-bg hover:text-brand-dark"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>

        <div className="pr-8">
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-brand-dark">Add signal to storyline</h2>
          <div className="mt-1 text-[13.5px] text-muted-foreground">Pick from your Signals Library or create a new one.</div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-1 border-b border-border">
          {([{ id: "library", label: "From Library" }, { id: "create", label: "Create new" }] as const).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px border-b-2 px-3.5 py-2.5 text-[13.5px]",
                  active ? "border-brand-orange font-semibold text-brand-dark" : "border-transparent font-medium text-muted-foreground"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="mt-4 flex flex-1 flex-col overflow-hidden">
          {tab === "library" ? (
            <LibraryTab search={search} setSearch={setSearch} filterCat={filterCat} setFilterCat={setFilterCat} filtered={filtered} selected={selected} toggleSelect={toggleSelect} chainTitles={chainTitles} />
          ) : (
            <CreateTab form={form} setForm={setForm} error={formError} />
          )}
        </div>

        {/* Placement selector */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#F3F4F6] pt-3.5">
          <PickerField label="Add to column">
            <PickerSelect value={placement} onChange={setPlacement} options={phases.map((p, i) => ({ value: p.id, label: columnLabels[i] || p.id }))} />
          </PickerField>
          <PickerField label="Connect from existing signal (optional)">
            <PickerSelect
              value={connectFrom}
              onChange={setConnectFrom}
              options={[{ value: "", label: "— No connection —" }, ...nodes.map((n) => ({ value: n.id, label: truncate(n.title, 44) }))]}
            />
          </PickerField>
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#F3F4F6] pt-3.5">
          <span className="text-[13px] text-muted-foreground">
            {tab === "library"
              ? totalSelectedCount === 1
                ? "1 signal selected"
                : `${totalSelectedCount} signals selected`
              : form.title.trim()
                ? "Ready to create"
                : "Fill the form to create"}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-[7px] border-0 bg-transparent px-3.5 py-2 text-[13.5px] font-medium text-muted-foreground hover:bg-bg hover:text-brand-dark">
              Cancel
            </button>
            <button
              onClick={tab === "library" ? handleAddFromLibrary : handleCreateNew}
              disabled={primaryDisabled}
              className="rounded-[7px] border-0 bg-brand-orange px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-orangeHover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {tab === "library" ? "Add to chain" : "Create & add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Library tab ─────────── */
function LibraryTab({
  search,
  setSearch,
  filterCat,
  setFilterCat,
  filtered,
  selected,
  toggleSelect,
  chainTitles,
}: {
  search: string;
  setSearch: (v: string) => void;
  filterCat: "All" | SteepCategory;
  setFilterCat: (v: "All" | SteepCategory) => void;
  filtered: Signal[];
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  chainTitles: Set<string>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search signals by name, source, or keyword..."
          autoFocus
          className="w-full rounded-md border border-border py-[9px] pl-8 pr-3 text-[13.5px] outline-none focus:border-brand-orange focus:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]"
        />
      </div>

      {/* STEEP filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {(["All", ...STEEP_CATS] as const).map((cat) => {
          const active = filterCat === cat;
          if (cat === "All") {
            return (
              <button
                key="All"
                onClick={() => setFilterCat("All")}
                className={cn("rounded-full border px-[11px] py-1 text-[11.5px] font-medium", active ? "border-brand-orange bg-brand-orangeLight text-brand-orange700" : "border-border bg-white text-muted-foreground")}
              >
                All
              </button>
            );
          }
          return (
            <button key={cat} onClick={() => setFilterCat(cat)}>
              <Chip category={cat} className={active ? "outline outline-2 outline-offset-1 outline-brand-orange" : ""} />
            </button>
          );
        })}
      </div>

      {/* Signal list */}
      <div className="scroll-y max-h-[400px] flex-1 overflow-auto rounded-[10px] border border-[#F3F4F6] bg-[#FAFAFA]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-text-3">No signals match. Try adjusting filters.</div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1 p-1.5">
            {filtered.map((s) => {
              const isSelected = selected.has(s.id);
              const isInChain = chainTitles.has((s.title || "").toLowerCase());
              const u = UNCERTAINTY_BADGE[s.uncertainty || "Medium"] || UNCERTAINTY_BADGE.Medium;
              return (
                <li
                  key={s.id}
                  onClick={() => toggleSelect(s.id)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 transition-[background,border-color,opacity] duration-[120ms]",
                    isSelected ? "border-brand-orange bg-brand-orangeLight" : "border-border bg-white",
                    isInChain && !isSelected && "opacity-60"
                  )}
                >
                  <PickerCheckbox checked={isSelected} />
                  <Chip category={s.category} className="flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-brand-dark">{s.title}</div>
                    <div className="font-mono text-[11px] tracking-[0.02em] text-text-3">{s.source}</div>
                  </div>
                  <ImpactStars value={s.impact || 3} size={10} />
                  <span className="flex-shrink-0 rounded-full px-[7px] py-0.5 text-[10px] font-semibold" style={{ background: u.bg, color: u.fg }}>
                    {s.uncertainty || "Medium"}
                  </span>
                  {isInChain && (
                    <span className="flex-shrink-0 rounded-full bg-bg px-[7px] py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.02em] text-muted-foreground">In chain</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ─────────── Create-new tab ─────────── */
function CreateTab({ form, setForm, error }: { form: NewSignalForm; setForm: React.Dispatch<React.SetStateAction<NewSignalForm>>; error: string | null }) {
  const update = (patch: Partial<NewSignalForm>) => setForm((f) => ({ ...f, ...patch }));
  const inputCls = "w-full rounded-[7px] border border-border bg-white px-[11px] py-2 text-[13px] outline-none focus:border-brand-orange";
  return (
    <div className="scroll-y flex max-h-[460px] flex-col gap-3 overflow-auto pr-1">
      <PickerField label="Signal title" required>
        <input value={form.title} onChange={(e) => update({ title: e.target.value })} placeholder="e.g. ASEAN ratifies the digital trade pact" autoFocus className={inputCls} />
      </PickerField>
      <PickerField label="Description">
        <textarea value={form.body} onChange={(e) => update({ body: e.target.value })} placeholder="What happens. Why it matters. (1–2 sentences)" rows={3} className={cn(inputCls, "min-h-[70px] resize-y")} />
      </PickerField>
      <PickerField label="STEEP category" required>
        <PickerSegmented value={form.category} options={STEEP_CATS} onChange={(v) => update({ category: v as SteepCategory })} />
      </PickerField>
      <div className="grid grid-cols-2 gap-3">
        <PickerField label="Source">
          <input value={form.source} onChange={(e) => update({ source: e.target.value })} placeholder="Reuters, internal research, …" className={inputCls} />
        </PickerField>
        <PickerField label="Impact (1–5)">
          <PickerStarPicker value={form.impact} onChange={(v) => update({ impact: v })} />
        </PickerField>
      </div>
      <PickerField label="Uncertainty">
        <PickerSegmented value={form.uncertainty} options={["Low", "Medium", "High"]} onChange={(v) => update({ uncertainty: v as NewSignalForm["uncertainty"] })} />
      </PickerField>
      {error && <div className="rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-[11px] py-2 text-[12.5px] text-[#EF4444]">{error}</div>}
    </div>
  );
}

/* ─────────── Helpers ─────────── */
function PickerField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-[5px] block text-xs font-medium text-brand-dark">
        {label}
        {required && <span className="ml-[3px] text-brand-orange">*</span>}
      </label>
      {children}
    </div>
  );
}

function PickerSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none rounded-[7px] border border-border bg-white py-2 pl-[11px] pr-[30px] text-[13px] text-brand-dark outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-[11px] top-1/2 -translate-y-1/2">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
}

function PickerSegmented({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-0.5 rounded-md bg-[#F3F4F6] p-0.5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={cn("rounded-md border-0 px-2 py-1.5 text-xs", active ? "bg-white font-semibold text-brand-dark shadow-[0_1px_2px_rgba(15,23,42,0.08)]" : "bg-transparent font-medium text-muted-foreground")}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function PickerStarPicker({ value, onChange, max = 5 }: { value: number; onChange: (v: number) => void; max?: number }) {
  const [hover, setHover] = React.useState(0);
  const display = hover || value;
  return (
    <div onMouseLeave={() => setHover(0)} className="inline-flex gap-1 py-1">
      {Array.from({ length: max }).map((_, i) => {
        const n = i + 1;
        const filled = n <= display;
        return (
          <button key={i} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)} aria-label={`${n} star${n === 1 ? "" : "s"}`} className="flex border-0 bg-transparent p-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "#F97316" : "#E5E7EB"} stroke="none">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

function PickerCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-[1.5px]", checked ? "border-brand-orange bg-brand-orange" : "border-border-strong bg-white")}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </span>
  );
}

function truncate(s: string, n: number) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
