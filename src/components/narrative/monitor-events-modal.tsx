"use client";

// Narrative page's "Monitor events" — picks which of the project's existing events should be
// tracked on Monitoring for this scenario (event_scenario_links), replacing the old "Track
// indicators" button. Visually modeled on Storyline's event-picker-modal.tsx LibraryTab
// (search/STEEP filter/status filter/grouped-by-force list/checkboxes), but does NOT reuse
// that component directly — picking a force here must never add a node to the Storyline
// causal chain, a different commit than this one.
import * as React from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { Chip } from "@/components/chip";
import { eventCategory } from "@/components/signals/pole";
import { addEventToMonitoring, removeEventFromMonitoring, type MonitoredEventRow } from "@/lib/actions/event-monitoring";
import { suggestEventsToMonitor, type SuggestEventCandidate } from "@/lib/actions/ai-event-monitoring";
import { PHASES, type Phase } from "@/lib/storyline-mapping";
import { PHASE_LABEL } from "@/components/decision-ui";
import type { EventItem, SteepCategory } from "@/lib/types";

const STEEP_CATS: SteepCategory[] = ["Social", "Technology", "Economic", "Ecological", "Political"];
const UNASSIGNED_GROUP = "__unassigned__";

export interface MonitorEventsModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  scenarioId: string;
  initiallyMonitored: MonitoredEventRow[];
  onSaved: (addedEventIds: string[]) => void;
}

export function MonitorEventsModal({ open, onClose, projectId, scenarioId, initiallyMonitored, onSaved }: MonitorEventsModalProps) {
  const store = useStore();
  const [search, setSearch] = React.useState("");
  const [filterCat, setFilterCat] = React.useState<"All" | SteepCategory>("All");
  const [filterStatus, setFilterStatus] = React.useState<"All" | "observed" | "possible">("All");
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);
  // No picker at all previously — every event added here silently got 'precursors'
  // regardless of how far along it actually is, which left Draft Route (and, once built,
  // Suggest Initiatives) with a misleading phase signal for anything tracked via this modal
  // instead of Storyline. Keyed by event id so each one can carry its own phase.
  const [phaseByEventId, setPhaseByEventId] = React.useState<Map<string, Phase>>(new Map());

  const [suggesting, setSuggesting] = React.useState(false);
  const [suggestGap, setSuggestGap] = React.useState<string | null>(null);
  const [suggestions, setSuggestions] = React.useState<SuggestEventCandidate[]>([]);

  const initialIds = React.useMemo(() => new Set(initiallyMonitored.map((m) => m.eventId)), [initiallyMonitored]);

  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setFilterCat("All");
    setFilterStatus("All");
    setChecked(new Set(initialIds));
    setPhaseByEventId(new Map(initiallyMonitored.map((m) => [m.eventId, m.phase])));
    setSuggestions([]);
    setSuggestGap(null);
  }, [open, initialIds, initiallyMonitored]);

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

  const library = store.events;
  const signals = store.signals;

  const filtered = library.filter((e) => {
    const cat = eventCategory(e, signals);
    if (filterCat !== "All" && cat !== filterCat) return false;
    if (filterStatus !== "All" && e.status !== filterStatus) return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (e.title || "").toLowerCase().includes(q) || (e.source || "").toLowerCase().includes(q) || (e.body || "").toLowerCase().includes(q);
  });

  const byForce = new Map<string, EventItem[]>();
  for (const e of filtered) {
    const forceIds = e.links.length > 0 ? e.links.map((l) => l.signalId) : [UNASSIGNED_GROUP];
    for (const fid of forceIds) {
      if (!byForce.has(fid)) byForce.set(fid, []);
      byForce.get(fid)!.push(e);
    }
  }
  const groups = signals.filter((s) => byForce.has(s.id)).map((s) => ({ id: s.id, title: s.title, events: byForce.get(s.id)! }));
  if (byForce.has(UNASSIGNED_GROUP)) groups.push({ id: UNASSIGNED_GROUP, title: "Unassigned", events: byForce.get(UNASSIGNED_GROUP)! });

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPhaseByEventId((prev) => (prev.has(id) ? prev : new Map(prev).set(id, "precursors")));
  };

  const setPhase = (id: string, phase: Phase) => {
    setPhaseByEventId((prev) => new Map(prev).set(id, phase));
  };

  const runSuggest = async () => {
    setSuggesting(true);
    setSuggestGap(null);
    try {
      const result = await suggestEventsToMonitor(scenarioId);
      if (!result.sufficientEvidence) {
        setSuggestGap(result.gap || "The model found insufficient evidence for discriminating events.");
        setSuggestions([]);
        return;
      }
      setSuggestions(result.candidates);
    } catch (err) {
      console.error("[monitor-events] suggest failed", err);
      setSuggestGap("Couldn't reach the AI — try again.");
    } finally {
      setSuggesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const added = Array.from(checked).filter((id) => !initialIds.has(id));
      const removed = Array.from(initialIds).filter((id) => !checked.has(id));
      // Re-syncs every currently-checked event's phase, not just newly-added ones —
      // syncEventScenarioLink upserts on (event_id, scenario_id), so this also picks up a
      // phase edit on an already-monitored event, not only the picker's own default.
      await Promise.all([
        ...Array.from(checked).map((id) => addEventToMonitoring(projectId, scenarioId, id, phaseByEventId.get(id) ?? "precursors")),
        ...removed.map((id) => removeEventFromMonitoring(scenarioId, id)),
      ]);
      onSaved(added);
      onClose();
    } catch (err) {
      console.error("[monitor-events] save failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Monitor events"
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
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-brand-dark">Monitor events</h2>
          <div className="mt-1 text-[13.5px] text-muted-foreground">Pick which events are worth tracking on Monitoring for this scenario.</div>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={runSuggest}
            disabled={suggesting}
            className="flex w-fit items-center gap-1.5 rounded-[7px] border border-brand-orange100 bg-brand-orangeLight px-3 py-1.5 text-[12.5px] font-medium text-brand-orange700 hover:bg-[#FFEDD5] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {suggesting ? "Thinking…" : "✦ Suggest events to monitor"}
          </button>
          {suggestGap && <div className="text-[12px] text-muted-foreground">{suggestGap}</div>}
          {suggestions.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1.5 rounded-[10px] border border-brand-orange100 bg-brand-orangeLight/40 p-2 pl-0">
              {suggestions.map((s) => {
                const isChecked = checked.has(s.eventId);
                return (
                  <li
                    key={s.eventId}
                    onClick={() => toggle(s.eventId)}
                    className={cn("ml-2 flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 transition-colors", isChecked ? "border-brand-orange bg-white" : "border-transparent bg-white/60")}
                  >
                    <span className="mt-0.5">
                      <PickerCheckbox checked={isChecked} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-brand-dark">{s.title}</div>
                      <div className="mt-0.5 text-[11.5px] leading-[1.4] text-text-3">{s.rationale}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
          <div className="relative">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events by name, source, or keyword..."
              className="w-full rounded-md border border-border py-[9px] pl-8 pr-3 text-[13.5px] outline-none focus:border-brand-orange focus:shadow-[0_0_0_3px_rgba(249,115,22,0.12)]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
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
            <div className="flex rounded-md border border-border bg-white p-0.5">
              {(["All", "observed", "possible"] as const).map((s) => {
                const active = filterStatus === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={cn("rounded-[5px] px-2.5 py-1 text-[11.5px] font-medium", active ? "bg-brand-orangeLight text-brand-orange700" : "text-muted-foreground")}
                  >
                    {s === "All" ? "All" : s === "observed" ? "Observed" : "Possible"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="scroll-y max-h-[360px] flex-1 overflow-auto rounded-[10px] border border-[#F3F4F6] bg-[#FAFAFA]">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-text-3">No events match. Try adjusting filters.</div>
            ) : (
              <div className="flex flex-col gap-2 p-1.5">
                {groups.map((group) => (
                  <div key={group.id}>
                    <div className="px-1.5 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em] text-text-3">
                      {group.title} <span className="text-[#C9CDD4]">· {group.events.length}</span>
                    </div>
                    <ul className="m-0 flex list-none flex-col gap-1 p-0">
                      {group.events.map((e) => {
                        const isChecked = checked.has(e.id);
                        return (
                          <li
                            key={group.id + ":" + e.id}
                            onClick={() => toggle(e.id)}
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2.5 transition-[background,border-color] duration-[120ms]",
                              isChecked ? "border-brand-orange bg-brand-orangeLight" : "border-border bg-white"
                            )}
                          >
                            <PickerCheckbox checked={isChecked} />
                            <Chip category={eventCategory(e, signals)} className="flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[13px] font-medium text-brand-dark">{e.title}</div>
                              <div className="font-mono text-[11px] tracking-[0.02em] text-text-3">{e.source || e.date}</div>
                            </div>
                            {isChecked && (
                              <select
                                value={phaseByEventId.get(e.id) ?? "precursors"}
                                onClick={(ev) => ev.stopPropagation()}
                                onChange={(ev) => setPhase(e.id, ev.target.value as Phase)}
                                className="flex-shrink-0 rounded-md border border-border bg-white px-1.5 py-1 text-[11px] text-text-3"
                                aria-label={`Storyline phase for ${e.title}`}
                              >
                                {PHASES.map((p) => (
                                  <option key={p} value={p}>
                                    {PHASE_LABEL[p]}
                                  </option>
                                ))}
                              </select>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#F3F4F6] pt-3.5">
          <span className="text-[13px] text-muted-foreground">{checked.size === 1 ? "1 event monitored" : `${checked.size} events monitored`}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-[7px] border-0 bg-transparent px-3.5 py-2 text-[13.5px] font-medium text-muted-foreground hover:bg-bg hover:text-brand-dark">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-[7px] border-0 bg-brand-orange px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-orangeHover disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
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
