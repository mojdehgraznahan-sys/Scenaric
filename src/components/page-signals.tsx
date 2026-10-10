"use client";

// Signals Library v2 — event-first capture, ported from
// design/handoff/2026-09-28/Signals Library Standalone.html. Forces ("signals") show a
// tug-of-war spectrum between two named poles; events pull toward one side or sit in the
// Inbox until grouped. No flip-cards, no tabs — Suggestions/Scores (Ask AI's Find/Rank
// review queues) are restyled panels on this same page rather than separate tabs.
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { getInsight } from "@/lib/actions/insights";
import {
  listResearchSuggestions,
  confirmResearchSuggestion,
  dismissResearchSuggestion,
  type ResearchSuggestionRow,
} from "@/lib/actions/ai-research-suggestions";
import {
  listSignalScoreProposals,
  confirmSignalScoreProposal,
  dismissSignalScoreProposal,
  confirmAllSignalScoreProposals,
  dismissAllInBatch,
  type SignalScoreProposalRow,
} from "@/lib/actions/ai-signals-rank";
import {
  suggestForceForEvent,
  groupInboxIntoForces,
  listForceProposals,
  confirmForceProposal,
  dismissForceProposal,
  generateForPole,
  listEventProposals,
  confirmEventProposal,
  dismissEventProposal,
  type ForceProposalRow,
  type EventProposalRow,
} from "@/lib/actions/ai-forces";
import type { EventItem, Signal, SteepCategory } from "@/lib/types";
import { eventCategory, slPole } from "@/components/signals/pole";
import { EventDot } from "@/components/signals/spectrum";
import { ForceCard } from "@/components/signals/force-card";
import { Inbox, GroupProposals } from "@/components/signals/inbox";
import { AddEventModal, type AddEventModalPreset, type AddEventInput } from "@/components/signals/add-event-modal";
import { AddForceModal } from "@/components/signals/add-force-modal";
import { EventDrawer } from "@/components/signals/event-drawer";

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

const BADGE_BASE = "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";

export function PageSignals() {
  const store = useStore();
  const signals = store.signals;
  const events = store.events;
  const navigate = useNavigate();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filter, setFilter] = React.useState<"All" | SteepCategory>("All");
  const [openEventId, setOpenEventId] = React.useState<string | null>(null);
  const [addingEvent, setAddingEvent] = React.useState<AddEventModalPreset | null>(null);
  const [addEventOpen, setAddEventOpen] = React.useState(false);
  const [addingForce, setAddingForce] = React.useState(false);
  const [addingToMatrixId, setAddingToMatrixId] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const showToast = React.useCallback((message: string) => setToast(message), []);
  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3800);
    return () => clearTimeout(t);
  }, [toast]);

  const openEvent = events.find((e) => e.id === openEventId) ?? null;
  const inbox = React.useMemo(() => events.filter((e) => e.links.length === 0), [events]);
  const forces = filter === "All" ? signals : signals.filter((s) => s.category === filter);
  const inboxFiltered = filter === "All" ? inbox : inbox.filter((e) => eventCategory(e, signals) === filter);

  /* ─────────────────────────── Knowledge Base "+ Merge into Signal →" ─────────────────────────── */
  // Lands here as /signals?mergeInsight={id} (page-knowledge.tsx). Instead of the old
  // merge-or-create modal, prefill the new Add Event modal's "what it would mean" field with
  // the insight's own text and let its inline suggestForceForEvent debounce do the matching.
  React.useEffect(() => {
    const insightId = searchParams.get("mergeInsight");
    if (!insightId) return;
    router.replace("/signals");
    (async () => {
      try {
        const insight = await getInsight(insightId);
        if (!insight) return;
        setAddingEvent({ title: "", body: insight.quote || insight.text });
        setAddEventOpen(true);
      } catch (err) {
        console.error("[signals] failed to load insight for merge", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* ─────────────────────────── Deep link: open a specific event's drawer ─────────────────────────── */
  // Lands here as /signals?openEvent={id} (Storyline's "View in Signals" card link) — same
  // read-param-then-replace pattern as mergeInsight above.
  React.useEffect(() => {
    const eventId = searchParams.get("openEvent");
    if (!eventId) return;
    router.replace("/signals");
    setOpenEventId(eventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /* ─────────────────────────── Suggestions (research_suggestions) ─────────────────────────── */
  // "Find" prompts (Ask AI, ⌘I) stage results here — unchanged data model/logic from before the
  // rebuild, just rendered as a panel on this page instead of behind a "Suggestions" tab.
  const [researchSuggestions, setResearchSuggestions] = React.useState<ResearchSuggestionRow[]>([]);
  const [workingSuggestionId, setWorkingSuggestionId] = React.useState<string | null>(null);

  const refreshResearchSuggestions = React.useCallback(async () => {
    if (!store.activeProjectId) return;
    setResearchSuggestions(await listResearchSuggestions(store.activeProjectId, ["driving_forces", "find"]));
  }, [store.activeProjectId]);

  React.useEffect(() => {
    refreshResearchSuggestions();
  }, [refreshResearchSuggestions]);

  React.useEffect(() => {
    if (!store.activeProjectId) return;
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projectId === store.activeProjectId) refreshResearchSuggestions();
    };
    window.addEventListener("fm:signals-updated", onUpdated);
    return () => window.removeEventListener("fm:signals-updated", onUpdated);
  }, [store.activeProjectId, refreshResearchSuggestions]);

  const onConfirmResearchSuggestion = async (id: string) => {
    if (!store.activeProjectId) return;
    setWorkingSuggestionId(id);
    try {
      await confirmResearchSuggestion(store.activeProjectId, id);
      await Promise.all([refreshResearchSuggestions(), store.refreshSignals(store.activeProjectId)]);
    } catch (err) {
      console.error("[signals] failed to confirm research suggestion", err);
    } finally {
      setWorkingSuggestionId(null);
    }
  };

  const onDismissResearchSuggestion = async (id: string) => {
    if (!store.activeProjectId) return;
    setWorkingSuggestionId(id);
    try {
      await dismissResearchSuggestion(store.activeProjectId, id);
      await refreshResearchSuggestions();
    } catch (err) {
      console.error("[signals] failed to dismiss research suggestion", err);
    } finally {
      setWorkingSuggestionId(null);
    }
  };

  /* ─────────────────────────── Scores (signal_score_proposals) ─────────────────────────── */
  const [scoreProposals, setScoreProposals] = React.useState<SignalScoreProposalRow[]>([]);
  const [workingProposalId, setWorkingProposalId] = React.useState<string | null>(null);
  const [workingBatchId, setWorkingBatchId] = React.useState<string | null>(null);

  const refreshScoreProposals = React.useCallback(async () => {
    if (!store.activeProjectId) return;
    setScoreProposals(await listSignalScoreProposals(store.activeProjectId));
  }, [store.activeProjectId]);

  React.useEffect(() => {
    refreshScoreProposals();
  }, [refreshScoreProposals]);

  React.useEffect(() => {
    if (!store.activeProjectId) return;
    const onUpdated = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.projectId === store.activeProjectId) refreshScoreProposals();
    };
    window.addEventListener("fm:signals-updated", onUpdated);
    return () => window.removeEventListener("fm:signals-updated", onUpdated);
  }, [store.activeProjectId, refreshScoreProposals]);

  const onConfirmScoreProposal = async (id: string) => {
    if (!store.activeProjectId) return;
    setWorkingProposalId(id);
    try {
      await confirmSignalScoreProposal(store.activeProjectId, id);
      await Promise.all([refreshScoreProposals(), store.refreshSignals(store.activeProjectId)]);
    } catch (err) {
      console.error("[signals] failed to confirm score proposal", err);
    } finally {
      setWorkingProposalId(null);
    }
  };

  const onDismissScoreProposal = async (id: string) => {
    if (!store.activeProjectId) return;
    setWorkingProposalId(id);
    try {
      await dismissSignalScoreProposal(store.activeProjectId, id);
      await refreshScoreProposals();
    } catch (err) {
      console.error("[signals] failed to dismiss score proposal", err);
    } finally {
      setWorkingProposalId(null);
    }
  };

  const onConfirmAllInBatch = async (batchId: string) => {
    if (!store.activeProjectId) return;
    setWorkingBatchId(batchId);
    try {
      await confirmAllSignalScoreProposals(store.activeProjectId, batchId);
      await Promise.all([refreshScoreProposals(), store.refreshSignals(store.activeProjectId)]);
    } catch (err) {
      console.error("[signals] failed to confirm score proposal batch", err);
    } finally {
      setWorkingBatchId(null);
    }
  };

  const onDismissAllInBatch = async (batchId: string) => {
    if (!store.activeProjectId) return;
    setWorkingBatchId(batchId);
    try {
      await dismissAllInBatch(store.activeProjectId, batchId);
      await refreshScoreProposals();
    } catch (err) {
      console.error("[signals] failed to dismiss score proposal batch", err);
    } finally {
      setWorkingBatchId(null);
    }
  };

  /* ─────────────────────────── Inbox → "Group into forces" (force_proposals) ─────────────────────────── */
  const [forceProposals, setForceProposals] = React.useState<ForceProposalRow[]>([]);
  const [grouping, setGrouping] = React.useState(false);
  const [groupWorkingId, setGroupWorkingId] = React.useState<string | null>(null);
  const [lastLeftoverIds, setLastLeftoverIds] = React.useState<string[]>([]);

  const refreshForceProposals = React.useCallback(async () => {
    if (!store.activeProjectId) return;
    setForceProposals(await listForceProposals(store.activeProjectId));
  }, [store.activeProjectId]);

  React.useEffect(() => {
    refreshForceProposals();
  }, [refreshForceProposals]);

  const onGroupInbox = async () => {
    if (!store.activeProjectId || inbox.length === 0) return;
    setGrouping(true);
    setLastLeftoverIds([]);
    try {
      const result = await groupInboxIntoForces(store.activeProjectId, inbox.map((e) => e.id));
      setForceProposals((prev) => [...result.proposals, ...prev]);
      setLastLeftoverIds(result.leftoverEventIds);
      if (result.proposals.length === 0 && result.leftoverEventIds.length === 0) showToast("Nothing to group yet.");
    } catch (err) {
      console.error("[signals] group inbox failed", err);
      showToast("Couldn't group events. Try again.");
    } finally {
      setGrouping(false);
    }
  };

  const onConfirmForceProposal = async (p: ForceProposalRow) => {
    if (!store.activeProjectId) return;
    setGroupWorkingId(p.id);
    try {
      await confirmForceProposal(store.activeProjectId, p.id);
      setForceProposals((prev) => prev.filter((x) => x.id !== p.id));
      await Promise.all([store.refreshSignals(store.activeProjectId), store.refreshEvents(store.activeProjectId)]);
    } catch (err) {
      console.error("[signals] confirm force proposal failed", err);
      showToast("Couldn't confirm that proposal — try again.");
    } finally {
      setGroupWorkingId(null);
    }
  };

  const onDismissForceProposal = async (p: ForceProposalRow) => {
    if (!store.activeProjectId) return;
    setGroupWorkingId(p.id);
    try {
      await dismissForceProposal(store.activeProjectId, p.id);
      setForceProposals((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      console.error("[signals] dismiss force proposal failed", err);
    } finally {
      setGroupWorkingId(null);
    }
  };

  /* ─────────────────────────── Per-pole "✦ Suggest" (event_proposals) ─────────────────────────── */
  const [eventProposals, setEventProposals] = React.useState<EventProposalRow[]>([]);
  const [busyPole, setBusyPole] = React.useState<Record<string, "a" | "b" | null>>({});

  const refreshEventProposals = React.useCallback(async () => {
    if (!store.activeProjectId) return;
    setEventProposals(await listEventProposals(store.activeProjectId));
  }, [store.activeProjectId]);

  React.useEffect(() => {
    refreshEventProposals();
  }, [refreshEventProposals]);

  const onGenerateForPole = async (sig: Signal, side: "a" | "b") => {
    if (!store.activeProjectId) return;
    setBusyPole((b) => ({ ...b, [sig.id]: side }));
    try {
      const result = await generateForPole(store.activeProjectId, sig.id, side);
      if (!result.sufficientEvidence) {
        showToast(`No credible event found toward "${slPole(sig, side)}" within your horizon.`);
      } else {
        setEventProposals((prev) => [...result.proposals, ...prev]);
      }
    } catch (err) {
      console.error("[signals] generate for pole failed", err);
      showToast("Couldn't suggest events — try again.");
    } finally {
      setBusyPole((b) => ({ ...b, [sig.id]: null }));
    }
  };

  const onAcceptEventProposal = async (p: EventProposalRow) => {
    if (!store.activeProjectId) return;
    try {
      await confirmEventProposal(store.activeProjectId, p.id);
      setEventProposals((prev) => prev.filter((x) => x.id !== p.id));
      await store.refreshEvents(store.activeProjectId);
    } catch (err) {
      console.error("[signals] confirm event proposal failed", err);
      showToast("Couldn't add that event — try again.");
    }
  };

  const onDismissEventProposal = async (p: EventProposalRow) => {
    if (!store.activeProjectId) return;
    try {
      await dismissEventProposal(store.activeProjectId, p.id);
      setEventProposals((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      console.error("[signals] dismiss event proposal failed", err);
    }
  };

  /* ─────────────────────────── Add Event / Add Force / drawer ─────────────────────────── */
  const onSuggestForce = React.useCallback(
    async (input: { title: string; body: string }) => {
      if (!store.activeProjectId) return null;
      return suggestForceForEvent(store.activeProjectId, input);
    },
    [store.activeProjectId]
  );

  const onSubmitAddEvent = async (input: AddEventInput): Promise<EventItem> => {
    if (!store.activeProjectId) throw new Error("No active project.");
    return store.createEvent({
      projectId: store.activeProjectId,
      title: input.title,
      description: input.body || undefined,
      category: input.category,
      status: input.status,
      occurredOn: input.occurredOn,
      windowLabel: input.windowLabel,
      source: input.source ?? undefined,
      likelihood: input.likelihood,
      impact: input.impact,
      links: input.target ? [{ signalId: input.target.sigId, side: input.target.side }] : [],
    });
  };

  const onAddForce = async (input: { title: string; category: SteepCategory; poleA: string; poleB: string; body: string }) => {
    if (!store.activeProjectId) throw new Error("No active project.");
    await store.createSignal({
      projectId: store.activeProjectId,
      category: input.category,
      source: "Manual",
      title: input.title,
      poleA: input.poleA,
      poleB: input.poleB,
      body: input.body,
    });
    showToast("Force added.");
  };

  const onLinkEvent = (eventId: string, signalId: string, side: "a" | "b") => {
    store.linkEvent(eventId, signalId, side).catch((err) => {
      console.error("[signals] failed to link event", err);
      showToast("Couldn't update that link — try again.");
    });
  };

  const onUnlinkEvent = (eventId: string, signalId: string) => {
    store.unlinkEvent(eventId, signalId).catch((err) => {
      console.error("[signals] failed to unlink event", err);
      showToast("Couldn't unlink that event — try again.");
    });
  };

  const onMarkHappened = (eventId: string) => {
    store
      .updateEvent({ id: eventId, status: "observed", occurredOn: new Date().toISOString().slice(0, 10), likelihood: null })
      .catch((err) => {
        console.error("[signals] failed to mark event happened", err);
        showToast("Couldn't update that event — try again.");
      });
  };

  // Same "score-first-if-needed" safety the old page had for "+ Add to Matrix": a scored
  // signal already has a dot (getMatrixData auto-positions it); an unscored one needs scoring
  // first so the user never lands on the Matrix without the signal actually being there.
  const onPlaceOnMatrix = async (s: Signal) => {
    if (s.impact != null && s.uncertainty != null) {
      navigate(`/matrix?focus=${s.id}`);
      return;
    }
    if (!store.activeProjectId) return;
    setAddingToMatrixId(s.id);
    try {
      await store.scoreSignal(store.activeProjectId, s.id);
      navigate(`/matrix?focus=${s.id}`);
    } catch (err) {
      console.error("[signals] failed to score signal for Place on matrix", err);
      showToast("Couldn't add to Matrix — try again.");
    } finally {
      setAddingToMatrixId(null);
    }
  };

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-[18px] shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Signals Library</h2>
            <div className="mt-0.5 max-w-[620px] text-[13px] text-muted-foreground">
              Add what&apos;s happening, or what could. Each event pulls on a force, and every force can go two ways.
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setAddingForce(true)}>
              Add force
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setAddingEvent({});
                setAddEventOpen(true);
              }}
            >
              + Add event
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <span className="ml-auto flex flex-wrap items-center gap-3 text-[11.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <EventDot ev={{ status: "observed", wildcard: false }} />
              Happened
            </span>
            <span className="inline-flex items-center gap-1.5">
              <EventDot ev={{ status: "possible", wildcard: false }} />
              Could happen
            </span>
            <span className="inline-flex items-center gap-1.5">
              <EventDot ev={{ status: "possible", wildcard: true }} />
              Wildcard
            </span>
          </span>
        </div>

        {store.signalsLoading && store.eventsLoading && signals.length === 0 && events.length === 0 && (
          <div className="text-center text-xs text-muted-foreground">Loading your signals…</div>
        )}

        <Inbox items={inboxFiltered} total={inbox.length} onOpen={setOpenEventId} onGroup={onGroupInbox} grouping={grouping}>
          {(forceProposals.length > 0 || lastLeftoverIds.length > 0) && (
            <GroupProposals
              proposals={forceProposals}
              signals={signals}
              events={events}
              leftoverEventIds={lastLeftoverIds}
              workingId={groupWorkingId}
              onConfirm={onConfirmForceProposal}
              onDismiss={onDismissForceProposal}
            />
          )}
        </Inbox>

        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="whitespace-nowrap text-sm font-semibold">Forces · {forces.length}</span>
          <span className="text-xs text-text-3">Each force can go two ways. Events show which way it&apos;s being pulled.</span>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
          {forces.map((s) => (
            <ForceCard
              key={s.id}
              sig={s}
              events={events}
              proposals={eventProposals.filter((p) => p.signal_id === s.id)}
              busySide={busyPole[s.id] ?? null}
              onOpen={setOpenEventId}
              onAdd={(side) => {
                setAddingEvent(side ? { sigId: s.id, side } : {});
                setAddEventOpen(true);
              }}
              onGenerate={(side) => onGenerateForPole(s, side)}
              onAcceptProposal={onAcceptEventProposal}
              onDismissProposal={onDismissEventProposal}
              onMatrix={addingToMatrixId === s.id ? undefined : () => onPlaceOnMatrix(s)}
            />
          ))}
        </div>
        {forces.length === 0 && <div className="text-[12.5px] text-text-3">No forces in this category yet.</div>}

        {/* Suggestions/Scores (Ask AI's Find/Rank review queues) sit below Forces, not above —
            they populate a beat after first paint (a separate fetch each), and rendering them
            above the primary content caused the whole page to visibly jump/reflow downward
            the instant they arrived, reading as if the view had switched. */}
        {researchSuggestions.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">Suggestions · {researchSuggestions.length}</span>
            {researchSuggestions.map((s) => (
              <div key={s.id} className="rounded-[9px] border border-[#FDE68A] bg-white px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-brand-dark">{s.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.04em] text-text-3">
                      <span className="rounded bg-[#F9FAFB] px-1.5 py-0.5 font-medium text-text-2">{s.category ? "Driving force" : "Key force"}</span>
                      <span>{s.category ?? s.actor_type}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{s.body}</div>
                    {s.citation_url && (
                      <a href={s.citation_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-[11px] text-brand-orange">
                        {s.citation_title || s.citation_url}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => onDismissResearchSuggestion(s.id)} disabled={workingSuggestionId === s.id}>
                      Dismiss
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => onConfirmResearchSuggestion(s.id)} disabled={workingSuggestionId === s.id}>
                      Confirm
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {scoreProposals.length > 0 && (
          <div className="flex flex-col gap-3.5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">Scores</span>
            {Object.entries(
              scoreProposals.reduce<Record<string, SignalScoreProposalRow[]>>((acc, p) => {
                (acc[p.batch_id] ??= []).push(p);
                return acc;
              }, {})
            ).map(([batchId, rows]) => (
              <div key={batchId} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">
                    {rows[0].dimension === "impact" ? "Impact" : "Uncertainty"} proposals · {rows.length}
                  </span>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => onDismissAllInBatch(batchId)} disabled={workingBatchId === batchId}>
                      Dismiss all
                    </Button>
                    <Button variant="primary" size="sm" onClick={() => onConfirmAllInBatch(batchId)} disabled={workingBatchId === batchId}>
                      Confirm all
                    </Button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {rows.map((p) => {
                    const signal = signals.find((s) => s.id === p.signal_id);
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "rounded-[9px] border px-3 py-2 text-xs",
                          p.low_confidence || p.disagrees_with_user_classification ? "border-[#FDE68A] bg-white" : "border-border bg-white"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-[13px] font-semibold text-brand-dark">{signal?.title ?? "Unknown signal"}</span>
                              <span className={cn(BADGE_BASE, "bg-[#F3F4F6] text-text-2")}>
                                {p.dimension === "impact" ? `Impact ${p.proposed_impact}` : p.proposed_uncertainty}
                              </span>
                              {p.low_confidence && <span className={cn(BADGE_BASE, "bg-brand-orangeLight text-brand-orange700")}>Low confidence</span>}
                              {p.disagrees_with_user_classification && (
                                <span className={cn(BADGE_BASE, "bg-brand-orangeLight text-brand-orange700")}>Disagrees with you</span>
                              )}
                            </div>
                            <p className="mt-1 text-muted-foreground">{p.rationale}</p>
                            {p.disagrees_with_user_classification && <p className="mt-0.5 text-brand-orange700">{p.disagrees_with_user_classification}</p>}
                          </div>
                          <div className="flex flex-shrink-0 gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => onDismissScoreProposal(p.id)} disabled={workingProposalId === p.id}>
                              Dismiss
                            </Button>
                            <Button variant="primary" size="sm" onClick={() => onConfirmScoreProposal(p.id)} disabled={workingProposalId === p.id}>
                              Confirm
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {openEvent && (
        <EventDrawer ev={openEvent} signals={signals} onClose={() => setOpenEventId(null)} onLink={onLinkEvent} onUnlink={onUnlinkEvent} onMarkHappened={onMarkHappened} />
      )}

      <AddEventModal
        open={addEventOpen}
        onOpenChange={setAddEventOpen}
        signals={signals}
        preset={addingEvent}
        onSuggestForce={onSuggestForce}
        onSubmit={onSubmitAddEvent}
        onAdded={(ev) => showToast(ev.links.length > 0 ? "Event added." : "Added to the inbox.")}
      />
      <AddForceModal open={addingForce} onOpenChange={setAddingForce} onAdd={onAddForce} />

      {toast && (
        <div role="status" className="fixed bottom-5 left-5 z-[250] max-w-[420px] rounded-[10px] bg-brand-dark px-3.5 py-2.5 text-[13px] text-white shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
          {toast}
        </div>
      )}
    </div>
  );
}
