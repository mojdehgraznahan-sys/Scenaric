"use client";

// Strategy v2 (design/2026-10-05/03-strategy/PROMPTS.md) — steer toward the future you want,
// stay ready for the other three. Replaces the old options-only robustness-grid page: that
// grid survives as this page's "Wind tunnel" section (extended with a target-column highlight
// and Robust/Depends-on-target/Hedge verdicts), everything else here (target picker, route
// health, levers, route swimlane, revision card) is new, wired to useDecisions(projectId).
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { useDecisions } from "@/lib/use-decisions";
import { listStrategicOptions, type StrategicOptionWithScores } from "@/lib/actions/strategy";
import { delta, levers, windowPoints, LIKELIHOOD_LEVELS, type LeversResult, type TrackedEvent, type InitiativeKind, type InitiativeWind } from "@/lib/decision-model";
import { toTrackedEvent } from "@/lib/decision-tracking";
import { draftRouteForTarget, type RouteDraftMove } from "@/lib/actions/ai-strategy-route";
import type { InitiativeWithTargets } from "@/lib/actions/initiatives";
import {
  DcActionCard,
  DcBriefing,
  ROUTE_LANES as LANES,
  ROUTE_HORIZONS as HORIZONS,
  ROUTE_HORIZON_LABEL as HORIZON_LABEL,
  ROUTE_MOVE_STATUS_STYLE as MOVE_STATUS_STYLE,
  PHASE_LABEL,
  type ActionCardRow,
  type RouteMoveRow,
  type ScenarioLite,
} from "@/components/decision-ui";

const BADGE_BASE = "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";

function riskBadge(risk: string | null) {
  if (risk === "Low") return "bg-[#ECFDF5] text-[#065F46]";
  if (risk === "Medium") return "bg-[#FFFBEB] text-[#B45309]";
  if (risk === "High") return "bg-brand-orangeLight text-brand-orange700";
  return "bg-[#F3F4F6] text-muted-foreground";
}

export function PageStrategy() {
  const store = useStore();
  const navigate = useNavigate();
  const projectId = store.activeProjectId;
  const scenarios = React.useMemo(() => store.scenarios.filter((s) => !s.archived), [store.scenarios]);
  const scenariosLite: ScenarioLite[] = React.useMemo(() => scenarios.map((s) => ({ id: s.id, name: s.name, color: s.color })), [scenarios]);
  const scenarioById = React.useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios]);

  const { data, loading, setTarget, setLever, actOnCard, createRoute, setRevision, actOnInitiative, suggestMoreInitiatives } = useDecisions(projectId);
  const [briefingOpen, setBriefingOpen] = React.useState(false);
  const [showDone, setShowDone] = React.useState(false);

  // Initiatives (design/strategy_handoff) section state — mirrors the reference's own
  // StInitiatives local state exactly (kind filter, show-dismissed toggle, suggest busy/
  // exhausted), kept local to this page since nothing else reads it yet.
  const [initiativeKind, setInitiativeKind] = React.useState<"all" | InitiativeKind>("all");
  const [showDismissedInitiatives, setShowDismissedInitiatives] = React.useState(false);
  const [suggestingInitiatives, setSuggestingInitiatives] = React.useState(false);
  const [initiativesExhausted, setInitiativesExhausted] = React.useState(false);

  // Guards refreshOptions and the recommendation fetch below against a project switch mid-fetch
  // — without checking this right before committing state, a slow fetch for the project just
  // switched AWAY from can resolve after the new project's own fetch and silently overwrite its
  // Wind tunnel options/AI recommendation with the stale project's data.
  const projectIdRef = React.useRef(projectId);
  React.useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  // Kept as a no-op read (arrives as /strategy?scenarioId={id} from Narrative) — same
  // convention as the page this replaces; pre-filtering the wind tunnel by it is out of scope.
  const searchParams = useSearchParams();
  void searchParams.get("scenarioId");

  // Three tabs under the one fixed header (target picker + route health), synced to
  // ?tab=decisions|plan|wind via router.push (not replace) so browser back/forward moves
  // between tabs, not just pages — the handoff's own acceptance line for this.
  const pathname = usePathname();
  const router = useRouter();
  const rawTab = searchParams.get("tab");
  const tab: "decisions" | "plan" | "wind" = rawTab === "plan" || rawTab === "wind" ? rawTab : "decisions";
  const setTab = React.useCallback(
    (next: "decisions" | "plan" | "wind") => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  // Wind tunnel reuses the existing strategic_options/strategy_scenario_scores data path —
  // this grid predates the decision layer and isn't part of useDecisions.
  const [options, setOptions] = React.useState<StrategicOptionWithScores[]>([]);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [generateNotice, setGenerateNotice] = React.useState<string | null>(null);
  const refreshOptions = React.useCallback(async (id: string) => {
    setOptionsLoading(true);
    try {
      const rows = await listStrategicOptions(id);
      if (projectIdRef.current !== id) return;
      setOptions(rows);
    } catch (err) {
      console.error("[strategy] failed to load strategic options", err);
    } finally {
      if (projectIdRef.current === id) setOptionsLoading(false);
    }
  }, []);
  React.useEffect(() => {
    if (projectId) refreshOptions(projectId);
  }, [projectId, refreshOptions]);

  const onGenerateOptions = async () => {
    if (!projectId || generating) return;
    setGenerating(true);
    setGenerateNotice(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/generate`, { method: "POST" });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      const result: { sufficientEvidence: boolean; gap?: string | null; warnings: { message: string }[] } = await res.json();
      await refreshOptions(projectId);
      if (!result.sufficientEvidence) setGenerateNotice(result.gap || "The model found insufficient evidence to generate strategic options.");
      else if (result.warnings.length > 0) setGenerateNotice(result.warnings.map((w) => w.message).join(" "));
    } catch (err) {
      console.error("[strategy] generate failed", err);
      setGenerateNotice("Something went wrong generating options — try again.");
    } finally {
      setGenerating(false);
    }
  };

  // Option detail modal + "Mark as primary" — pre-existing functionality, kept alongside the
  // new target-column highlight and verdict column rather than dropped by the rebuild.
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | null>(null);
  const selectedOption = options.find((o) => o.id === selectedOptionId) ?? null;
  const [markingPrimary, setMarkingPrimary] = React.useState(false);

  // Ask AI drawer scoping (ask-ai.tsx's context="strategy" branch) — "Stress-test this
  // option" needs the open detail modal's option; "why isn't this robust" needs the clicked
  // non-robust cell. Pre-existing wiring, kept verbatim.
  React.useEffect(() => {
    store.setStrategyAskAiContext({
      selectedOption: selectedOption ? { id: selectedOption.id, name: selectedOption.name } : null,
      selectedCell: store.strategyAskAiContext?.selectedCell ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOption?.id]);
  React.useEffect(() => {
    return () => store.setStrategyAskAiContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCellClick = (option: StrategicOptionWithScores, scenarioId: string, scenarioName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const score = option.scores.find((s) => s.scenario_id === scenarioId);
    if (!score || score.robust) return; // only non-robust cells have a "why" to ask about
    const current = store.strategyAskAiContext;
    const isSame = current?.selectedCell?.optionId === option.id && current.selectedCell.scenarioId === scenarioId;
    store.setStrategyAskAiContext({
      selectedOption: current?.selectedOption ?? null,
      selectedCell: isSame ? null : { optionId: option.id, optionName: option.name, scenarioId, scenarioName },
    });
  };
  const onMarkPrimary = async () => {
    if (!projectId || !selectedOption || markingPrimary) return;
    setMarkingPrimary(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/strategy/${selectedOption.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: true }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status}).`);
      await refreshOptions(projectId);
    } catch (err) {
      console.error("[strategy] mark as primary failed", err);
    } finally {
      setMarkingPrimary(false);
    }
  };

  // GET /projects/:id/strategy/recommendation (pre-existing) — cache hit instantly, only
  // calls the model on a genuine cache miss (ai-strategy-recommendation.ts).
  const [recommendation, setRecommendation] = React.useState<{ rationale: string; primaryOptionId: string | null; pairingOptionId: string | null } | null>(null);
  const [recommendationLoading, setRecommendationLoading] = React.useState(false);
  React.useEffect(() => {
    if (!projectId) return;
    setRecommendationLoading(true);
    fetch(`/api/projects/${projectId}/strategy/recommendation`)
      .then((res) => res.json())
      .then((d: { sufficientEvidence: boolean; rationale: string | null; primaryOptionId: string | null; pairingOptionId: string | null }) => {
        if (projectIdRef.current !== projectId) return;
        setRecommendation(d.sufficientEvidence && d.rationale ? { rationale: d.rationale, primaryOptionId: d.primaryOptionId, pairingOptionId: d.pairingOptionId } : null);
      })
      .catch(() => {
        if (projectIdRef.current === projectId) setRecommendation(null);
      })
      .finally(() => {
        if (projectIdRef.current === projectId) setRecommendationLoading(false);
      });
  }, [projectId]);

  // Draft route modal state — the draft itself lives only here until confirmed (see
  // ai-strategy-route.ts's header comment).
  const [draftOpen, setDraftOpen] = React.useState(false);
  const [draftLoading, setDraftLoading] = React.useState(false);
  const [draftMoves, setDraftMoves] = React.useState<RouteDraftMove[] | null>(null);
  const [draftError, setDraftError] = React.useState<string | null>(null);

  const points = React.useMemo(() => windowPoints(), []);
  const modeled = React.useMemo(() => (data ? data.tracked.map((row) => toTrackedEvent(row, points)) : []), [data, points]);
  const trackedTitleById = React.useMemo(() => new Map((data?.tracked ?? []).map((t) => [t.eventId, t.title])), [data?.tracked]);
  // Surfaces each event-linked move's Storyline/Monitor-Events phase inline — makes the
  // phase<->horizon connection (horizonForPhase, decision-model.ts) visible to a human
  // reviewer, not just baked silently into the Draft Route prompt.
  const trackedPhaseById = React.useMemo(() => new Map((data?.tracked ?? []).map((t) => [t.eventId, t.phase])), [data?.tracked]);
  const trackedLevelById = React.useMemo(() => new Map((data?.tracked ?? []).map((t) => [t.eventId, t.currentLevel])), [data?.tracked]);

  // "No more for now" (suggestMoreInitiatives returning 0 added) is per-target — switching the
  // target future should let the user try again, same as the reference's own exhausted flag
  // never surviving a target change in the mockup (it's scoped to <StInitiatives target=...>,
  // which remounts when target changes; this page isn't tab-split yet, so reset explicitly).
  React.useEffect(() => {
    setInitiativesExhausted(false);
  }, [data?.targetScenarioId]);

  if (!projectId) return <div className="flex-1 p-5 text-sm text-muted-foreground">Select a project to see Strategy.</div>;
  if (loading && !data) return <div className="flex-1 p-5 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="flex-1 p-5 text-sm text-muted-foreground">Couldn&apos;t load Strategy. Try reloading.</div>;

  const target = data.targetScenarioId ? scenarioById.get(data.targetScenarioId) ?? null : null;
  const health = data.targetScenarioId ? data.healthByScenario[data.targetScenarioId] : null;
  const lev: LeversResult = target ? levers(target.id, modeled) : { shape: [], influence: [], watch: [], block: [], unclassified: [] };
  const route = data.route;
  const pending = data.actions.filter((a) => a.status === "pending");
  const handled = data.actions.filter((a) => a.status !== "pending");
  const toneColor = health ? ({ low: "#10B981", mid: "#F59E0B", high: "#EF4444" }[health.tone]) : "#9CA3AF";

  const evidenceTitleFor = (card: ActionCardRow): string | null => {
    if (card.evidence_event_id) return trackedTitleById.get(card.evidence_event_id) ?? null;
    if (card.evidence_discovery_id) return data.inbox.find((d) => d.id === card.evidence_discovery_id)?.title ?? null;
    return null;
  };

  const linkLabel = (m: RouteMoveRow): { kind: string; value: string } => {
    if (m.link_kind === "event") return { kind: "Event", value: trackedTitleById.get(m.link_id) ?? data.inbox.find((d) => d.id === m.link_id)?.title ?? "an event" };
    if (m.link_kind === "signpost") return { kind: "Trigger", value: data.signposts.find((sp) => sp.id === m.link_id)?.name ?? "a signpost" };
    if (m.link_kind === "initiative") {
      const initiative = data.initiatives.find((i) => i.id === m.link_id);
      const primaryTarget = initiative?.targets[0];
      const value = primaryTarget ? (primaryTarget.eventId ? trackedTitleById.get(primaryTarget.eventId) ?? primaryTarget.title : primaryTarget.title) : null;
      return { kind: "Targets", value: value ?? initiative?.title ?? "an initiative" };
    }
    return { kind: "Option", value: options.find((o) => o.id === m.link_id)?.name ?? "an option" };
  };

  const onOpenDraft = async () => {
    if (!target) return;
    setDraftOpen(true);
    setDraftLoading(true);
    setDraftError(null);
    try {
      const moves = await draftRouteForTarget(projectId, target.name, {
        shapeEvents: lev.shape.map((t) => ({ id: t.eventId, title: trackedTitleById.get(t.eventId) ?? "", phase: t.phase })),
        influenceEvents: lev.influence.map((t) => ({ id: t.eventId, title: trackedTitleById.get(t.eventId) ?? "", phase: t.phase })),
        watchEvents: lev.watch.map((t) => ({ id: t.eventId, title: trackedTitleById.get(t.eventId) ?? "", phase: t.phase })),
        blockerEvents: lev.block.map((t) => ({ id: t.eventId, title: trackedTitleById.get(t.eventId) ?? "", phase: t.phase })),
        signposts: data.signposts.filter((sp) => sp.scenario_id === target.id).map((sp) => ({ id: sp.id, title: sp.name })),
        options: options.map((o) => ({ id: o.id, title: o.name })),
      });
      setDraftMoves(moves);
    } catch (err) {
      console.error("[strategy] draft route failed", err);
      setDraftError("Something went wrong drafting a route — try again.");
    } finally {
      setDraftLoading(false);
    }
  };

  const onSuggestInitiatives = async () => {
    if (!target) return;
    setSuggestingInitiatives(true);
    try {
      const added = await suggestMoreInitiatives(target.id);
      if (!added) setInitiativesExhausted(true);
    } catch (err) {
      console.error("[strategy] suggest initiatives failed", err);
    } finally {
      setSuggestingInitiatives(false);
    }
  };

  const onConfirmDraft = async () => {
    if (!target || !draftMoves) return;
    await createRoute(
      target.id,
      draftMoves.map((m) => ({ lane: m.lane, horizon: m.horizon, title: m.title, link_kind: m.linkKind, link_id: m.linkId, pushes: m.pushes }))
    );
    setDraftOpen(false);
    setDraftMoves(null);
  };

  // "Depends on target" / "Hedge" are only meaningful relative to a chosen target; without one,
  // collapse to a simpler Robust/Not-yet-robust reading.
  const verdictFor = (option: StrategicOptionWithScores): { label: string; tone: string } => {
    const robustCount = option.scores.filter((s) => s.robust).length;
    if (robustCount >= 3) return { label: "Robust", tone: "bg-[#ECFDF5] text-[#065F46]" };
    if (target) {
      const inTarget = option.scores.find((s) => s.scenario_id === target.id)?.robust ?? false;
      return inTarget ? { label: "Depends on target", tone: "bg-[#FFFBEB] text-[#B45309]" } : { label: "Hedge", tone: "bg-[#FFFBEB] text-[#B45309]" };
    }
    return robustCount > 0 ? { label: "Partial", tone: "bg-[#FFFBEB] text-[#B45309]" } : { label: "Hedge", tone: "bg-[#FFFBEB] text-[#B45309]" };
  };

  // Warn when a shaping move's linked option is "Depends on target" with no hedge in the same
  // horizon (handoff Prompt 2, Wind tunnel bullet).
  const shapingNeedsHedgeWarning = (m: RouteMoveRow): boolean => {
    if (m.lane !== "shaping" || m.link_kind !== "option") return false;
    const option = options.find((o) => o.id === m.link_id);
    if (!option || verdictFor(option).label !== "Depends on target") return false;
    return !route.some((other) => other.lane === "hedge" && other.horizon === m.horizon);
  };

  const sectionHeader = (title: string, sub?: string, right?: React.ReactNode) => (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-brand-dark">{title}</div>
        {sub && <div className="mt-0.5 max-w-[640px] text-[12.5px] text-muted-foreground">{sub}</div>}
      </div>
      {right}
    </div>
  );

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="flex flex-col gap-4">
        {/* Header + target picker + route health */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-semibold">Strategy</h2>
              <div className="mt-0.5 text-[13px] text-muted-foreground">Steer toward the future you want, and be ready for the other three.</div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setBriefingOpen(true)}>
              <Icons.File size={12} /> Executive briefing
            </Button>
          </div>

          <div className="mt-4 font-mono text-[11px] text-text-3">Target future</div>
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
            {scenarios.map((s) => {
              const on = s.id === target?.id;
              const m = data.momentumByScenario[s.id];
              return (
                <button
                  key={s.id}
                  onClick={() => setTarget(s.id, store.user.id || null)}
                  className="cursor-pointer rounded-[10px] px-3 py-2.5 text-left"
                  style={{ background: on ? "#fff" : "#FAFAFA", border: on ? `1.5px solid ${s.color}` : "1px solid #E5E7EB" }}
                >
                  <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-brand-dark">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    {s.name}
                  </div>
                  <div className="mt-[3px] text-[11.5px] text-muted-foreground">
                    {s.tagline} · {m?.label ?? "Steady"}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-2 text-[12px] text-text-3">
            The target is your strategic choice, not a score on the scenario. All four futures stay on the board, and every move below is still tested against each one.
          </div>

          {target && health && (
            <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
              <div className="pl-3" style={{ borderLeft: `3px solid ${toneColor}` }}>
                <div className="font-mono text-[11px] text-text-3">Route health</div>
                <div className="mt-0.5 text-[20px] font-semibold">{health.label}</div>
              </div>
              <div>
                <div className="font-mono text-[11px] text-text-3">Gaining</div>
                <div className="mt-1 text-[12.5px] leading-[1.45] text-[#374151]">
                  {health.gaining.map((t) => trackedTitleById.get(t.eventId)).filter(Boolean).join(" · ") || "None"}
                </div>
              </div>
              <div>
                <div className="font-mono text-[11px] text-text-3">Pulling you off course</div>
                <div className="mt-1 text-[12.5px] leading-[1.45] text-[#374151]">
                  {[...health.weakening, ...health.blockersRising].map((t) => trackedTitleById.get(t.eventId)).filter(Boolean).join(" · ") || "None"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tab bar — header above stays visible on every tab */}
        <div role="tablist" className="sticky top-0 z-[5] -mt-1 flex gap-1 border-b border-border bg-bg pt-1" style={{ background: "var(--background, #F5F5F5)" }}>
          {(
            [
              ["decisions", "Decisions", pending.length + (data.revision?.status === "proposed" ? 1 : 0), "Actions from Monitoring and proposed revisions"],
              ["plan", "Plan", route.length, "Levers, initiatives and route to the target"],
              ["wind", "Wind tunnel", options.length, "Options tested in all four futures"],
            ] as const
          ).map(([id, label, count, title]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                title={title}
                onClick={() => setTab(id)}
                className="flex items-center gap-1.5 border-0 bg-transparent px-3.5 py-2.5 text-[13.5px]"
                style={{ marginBottom: -1, borderBottom: `2px solid ${on ? "#F97316" : "transparent"}`, color: on ? "#1E1B2E" : "#6B7280", fontWeight: on ? 600 : 500 }}
              >
                {label}
                {count > 0 && (
                  <span
                    className="rounded-full px-1.5 py-[1px] font-mono text-[10.5px]"
                    style={{ background: on ? "#FFF7ED" : "#EEEEEE", color: on ? "#C2410C" : "#6B7280" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {tab === "decisions" && (
        <>
        {/* Recommended actions */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          {sectionHeader(
            "Recommended actions",
            `${pending.length} waiting · sent from Monitoring when the evidence crossed a threshold`,
            handled.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setShowDone((v) => !v)}>
                {showDone ? "Hide" : "Show"} {handled.length} handled
              </Button>
            ) : undefined
          )}
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,300px),1fr))" }}>
            {pending.map((a) => (
              <DcActionCard
                key={a.id}
                card={a}
                status="pending"
                evidenceTitle={evidenceTitleFor(a)}
                scenario={a.scenario_id ? scenariosLite.find((s) => s.id === a.scenario_id) ?? null : null}
                onAct={(card, status) => {
                  actOnCard(card.id, status, store.user.id || null);
                  if (status !== "accepted") return;
                  const effect = card.effect as { navigate?: string; move_id?: string } | null;
                  // A card with effect.navigate leaves Strategy entirely (e.g. "Frame check" ->
                  // Signals); one with effect.move_id changes a route move the user can only
                  // see on the Plan tab — jump there so the effect is actually visible.
                  if (effect?.navigate) navigate(effect.navigate);
                  else if (effect?.move_id) setTab("plan");
                }}
                acceptControl={(card) => <AcceptPopover onAccept={(opts) => actOnCard(card.id, "accepted", store.user.id || null, opts)} />}
              />
            ))}
            {showDone &&
              handled.map((a) => (
                <DcActionCard
                  key={a.id}
                  card={a}
                  status={a.status}
                  compact
                  evidenceTitle={evidenceTitleFor(a)}
                  scenario={a.scenario_id ? scenariosLite.find((s) => s.id === a.scenario_id) ?? null : null}
                  onAct={(card, status) => actOnCard(card.id, status, store.user.id || null)}
                />
              ))}
          </div>
          {!pending.length && !showDone && <div className="text-[13px] text-muted-foreground">Nothing waiting. New recommendations arrive after each daily scan.</div>}
        </div>
        </>
        )}

        {tab === "plan" && (
        <>
        {/* Levers */}
        {target && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            {sectionHeader(`Levers toward ${target.name}`, "The events that lead to your target, grouped by what you can do about each one.")}
            {lev.unclassified.length > 0 && (
              <UnclassifiedLevers items={lev.unclassified} titleById={trackedTitleById} onClassify={(eventId, lever) => setLever(eventId, lever)} />
            )}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
              <LeverColumn title="Shape" sub="You make these happen yourself." items={lev.shape} kind="support" titleById={trackedTitleById} />
              <LeverColumn title="Influence" sub="Push these with your own moves." items={lev.influence} kind="support" titleById={trackedTitleById} />
              <LeverColumn title="Watch" sub="Outside your control. Prepare for them." items={lev.watch} kind="support" titleById={trackedTitleById} />
              <LeverColumn title="Blockers" sub="These pull toward other futures. Reduce or hedge." items={lev.block} kind="block" titleById={trackedTitleById} />
            </div>
          </div>
        )}

        {/* Initiatives (design/strategy_handoff) */}
        {target && (
          <InitiativesSection
            target={target}
            scenariosLite={scenariosLite}
            initiatives={data.initiatives}
            trackedTitleById={trackedTitleById}
            trackedLevelById={trackedLevelById}
            kindFilter={initiativeKind}
            onKindFilterChange={setInitiativeKind}
            showDismissed={showDismissedInitiatives}
            onToggleShowDismissed={() => setShowDismissedInitiatives((v) => !v)}
            suggesting={suggestingInitiatives}
            exhausted={initiativesExhausted}
            onSuggest={onSuggestInitiatives}
            onAct={(initiativeId, status) => actOnInitiative(initiativeId, status, target.id)}
          />
        )}

        {/* Route */}
        {target && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            {sectionHeader(`Route to ${target.name}`, "Every move is tied to the event it pushes or the signpost that triggers it. Accepted actions update this map.")}
            {route.length ? (
              <div className="overflow-x-auto">
                <div className="grid overflow-hidden rounded-xl border border-border" style={{ gridTemplateColumns: "170px repeat(4,minmax(170px,1fr))", minWidth: 860 }}>
                  <div className="border-b border-border bg-[#F9FAFB]" />
                  {HORIZONS.map((h) => (
                    <div key={h} className="border-b border-l border-border bg-[#F9FAFB] px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {HORIZON_LABEL[h]}
                    </div>
                  ))}
                  {LANES.map((lane, li) => (
                    <React.Fragment key={lane.id}>
                      <div className={cn("p-3", li > 0 && "border-t border-[#F3F4F6]")}>
                        <div className="text-[13px] font-semibold">{lane.name}</div>
                        <div className="mt-0.5 text-[11.5px] leading-[1.4] text-muted-foreground">{lane.sub}</div>
                      </div>
                      {HORIZONS.map((h) => (
                        <div key={h} className={cn("flex flex-col gap-1.5 border-l border-[#F3F4F6] p-2", li > 0 && "border-t")}>
                          {route
                            .filter((m) => m.lane === lane.id && m.horizon === h)
                            .map((m) => {
                              const l = linkLabel(m);
                              const c = MOVE_STATUS_STYLE[m.status];
                              const warn = shapingNeedsHedgeWarning(m);
                              // Phase B.1: shows the linked event's own Storyline/Monitor-Events
                              // phase inline, so a reviewer can see at a glance whether this
                              // move's horizon still makes sense against that event's timeline
                              // — not just trust the Draft Route prompt's phase anchor blindly.
                              const linkedPhase = m.link_kind === "event" ? trackedPhaseById.get(m.link_id) : undefined;
                              return (
                                <div
                                  key={m.id}
                                  className="rounded-lg bg-white p-2.5"
                                  style={{ border: `1px solid ${m.status === "armed" ? "#FDE68A" : m.status === "paused" ? "#BFDBFE" : "#E5E7EB"}`, borderStyle: m.status === "held" ? "dashed" : "solid" }}
                                >
                                  {m.initiative_id && <span className="mb-[3px] block font-mono text-[9.5px] text-brand-orange700">Initiative</span>}
                                  <div className="text-[12.5px] font-semibold leading-[1.35]">{m.title}</div>
                                  <div className="mt-1 text-[11px] leading-[1.4] text-muted-foreground">
                                    <span className="text-text-3">{m.pushes ? "Pushes" : l.kind}:</span> {l.value}
                                    {linkedPhase && <span className="text-text-3"> · {PHASE_LABEL[linkedPhase]}</span>}
                                  </div>
                                  <span className={cn(BADGE_BASE, "mt-1.5")} style={{ background: c.bg, color: c.fg, textTransform: "capitalize" }}>
                                    {m.status}
                                  </span>
                                  {warn && (
                                    <div className="mt-1.5 flex items-center gap-1 text-[10.5px] text-[#B45309]">
                                      <Icons.Bell size={10} /> No hedge this horizon
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <div className="text-[14px] font-semibold">No route to {target.name} yet</div>
                <div className="mx-auto mt-1 mb-3 max-w-[420px] text-[12.5px] text-muted-foreground">
                  AI drafts no-regret, shaping and hedge moves from this future&apos;s levers and signposts. You review the draft before anything is added.
                </div>
                <Button variant="primary" size="sm" onClick={onOpenDraft}>
                  <Icons.Sparkle size={12} /> Draft route
                </Button>
              </div>
            )}
          </div>
        )}
        </>
        )}

        {tab === "decisions" && (
        <>
        {/* Proposed revision */}
        {data.revision && data.revision.status === "proposed" && (
          <div className="rounded-xl border border-[#FED7AA] bg-[#FFFBF5] p-5">
            {sectionHeader(
              "Proposed strategy revision",
              `The evidence has moved since this strategy was set on ${new Date(data.revision.since).toLocaleDateString()}.`,
              <div className="flex gap-1.5">
                <Button variant="primary" size="sm" onClick={() => setRevision(data.revision!.id, "applied")}>
                  Apply revision
                </Button>
                <Button variant="ghost" size="sm" className="bg-white" onClick={() => navigate("/matrix")}>
                  Rebuild scenarios
                </Button>
                <Button variant="ghost" size="sm" className="border-none" onClick={() => setRevision(data.revision!.id, "dismissed")}>
                  Dismiss
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              {(data.revision.items as { kind: string; text: string }[]).map((r, i) => (
                <div key={i} className="grid gap-2.5 text-[13px] leading-[1.5]" style={{ gridTemplateColumns: "96px 1fr" }}>
                  <span className="pt-0.5 font-mono text-[11px] text-brand-orange700">{r.kind}</span>
                  <span>{r.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-2.5 text-[12px] text-[#9A3412]">Rebuilding scenarios opens the re-axis review in the Matrix. Your current scenarios and route are saved as a snapshot.</div>
          </div>
        )}
        </>
        )}

        {tab === "wind" && (
        <>
        {/* Wind tunnel */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          {sectionHeader(
            "Wind tunnel",
            "How each option performs in all four futures. A route that only works in the target leaves you exposed.",
            <Button variant="primary" size="sm" onClick={onGenerateOptions} disabled={generating}>
              <Icons.Sparkle size={12} /> {generating ? "Generating…" : "Generate options"}
            </Button>
          )}
          {generateNotice && <div className="mb-3 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-[12.5px] text-[#92400E]">{generateNotice}</div>}
          <div className="overflow-x-auto">
            <div className="min-w-[920px] overflow-hidden rounded-xl border border-border">
              <div
                className="grid border-b border-border bg-[#F9FAFB] px-3.5 py-2.5 font-mono text-[11px] text-muted-foreground"
                style={{ gridTemplateColumns: "minmax(240px,2fr) repeat(4,1fr) 90px 80px 110px" }}
              >
                <div>Option</div>
                {scenarios.map((s) => (
                  <div key={s.id} className="text-center" style={{ color: s.id === target?.id ? s.color : undefined, fontWeight: s.id === target?.id ? 600 : 500 }}>
                    {s.name}
                  </div>
                ))}
                <div className="text-center">Risk</div>
                <div className="text-center">Cost</div>
                <div className="text-center">Verdict</div>
              </div>
              {optionsLoading ? (
                <div className="px-3.5 py-6 text-center text-[13px] text-muted-foreground">Loading…</div>
              ) : options.length === 0 ? (
                <div className="px-3.5 py-6 text-center text-[13px] text-muted-foreground">No strategic options yet — click &quot;Generate options&quot; above.</div>
              ) : (
                options.map((option, i) => {
                  const verdict = verdictFor(option);
                  return (
                    <div
                      key={option.id}
                      onClick={() => setSelectedOptionId(option.id)}
                      className={cn("grid cursor-pointer items-center px-3.5 py-3 hover:bg-[#FAFAFA]", i > 0 && "border-t border-[#F3F4F6]")}
                      style={{ gridTemplateColumns: "minmax(240px,2fr) repeat(4,1fr) 90px 80px 110px" }}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13.5px] font-semibold">{option.name}</span>
                          {option.is_primary && <span className={cn(BADGE_BASE, "bg-brand-orange text-white")}>Primary</span>}
                          {recommendation?.primaryOptionId === option.id && <span className={cn(BADGE_BASE, "bg-[#ECFDF5] text-[#065F46]")}>AI pick</span>}
                          {recommendation?.pairingOptionId === option.id && <span className={cn(BADGE_BASE, "bg-[#EFF6FF] text-[#1D4ED8]")}>Hedge pick</span>}
                        </div>
                        <div className="mt-0.5 text-[12px] leading-[1.45] text-muted-foreground">{option.notes}</div>
                      </div>
                      {scenarios.map((s) => {
                        const score = option.scores.find((sc) => sc.scenario_id === s.id);
                        const current = store.strategyAskAiContext?.selectedCell;
                        const isSelectedCell = current?.optionId === option.id && current.scenarioId === s.id;
                        return (
                          <div key={s.id} className="flex items-center justify-center self-stretch" style={{ background: s.id === target?.id ? "#FAFAFA" : "transparent" }}>
                            <span
                              onClick={(e) => onCellClick(option, s.id, s.name, e)}
                              title={score?.rationale}
                              className={cn(
                                "inline-flex h-[22px] w-[22px] items-center justify-center rounded-full text-[13px] font-semibold",
                                !score ? "bg-[#F3F4F6] text-muted-foreground" : score.robust ? "bg-[#ECFDF5] text-[#10B981]" : cn("cursor-pointer bg-[#FEF2F2] text-[#EF4444]", isSelectedCell && "ring-2 ring-[#EF4444]")
                              )}
                            >
                              {!score ? "–" : score.robust ? "✓" : "·"}
                            </span>
                          </div>
                        );
                      })}
                      <div className="text-center">
                        <span className={cn(BADGE_BASE, riskBadge(option.risk))}>{option.risk ?? "Unscored"}</span>
                      </div>
                      <div className="text-center text-xs font-medium text-muted-foreground">{option.cost ?? "Unscored"}</div>
                      <div className="text-center">
                        <span className={cn(BADGE_BASE, verdict.tone)}>{verdict.label}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {(recommendationLoading || recommendation) && (
            <div className="mt-4 rounded-xl border border-brand-orange100 bg-brand-orangeLight p-4">
              <div className="mb-1.5 flex items-center gap-2">
                <Icons.Sparkle size={14} stroke="#F97316" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-orange700">AI Recommendation</span>
              </div>
              <div className="text-sm leading-[1.6] text-brand-dark">{recommendationLoading ? "Loading recommendation…" : recommendation!.rationale}</div>
            </div>
          )}
        </div>
        </>
        )}
      </div>

      {/* Option detail modal */}
      <Dialog open={!!selectedOption} onOpenChange={(o) => !o && setSelectedOptionId(null)}>
        {selectedOption && (
          <DialogContent className="max-w-[540px] p-6">
            <div className="mb-3 font-mono text-[11px] tracking-[0.06em] text-text-3">STRATEGIC OPTION · {selectedOption.created_via === "ai" ? "AI-GENERATED" : "MANUAL"}</div>
            <DialogTitle className="mb-1.5 text-[22px] font-semibold tracking-[-0.015em]">{selectedOption.name}</DialogTitle>
            <p className="mb-[18px] text-sm leading-[1.55] text-muted-foreground">{selectedOption.notes}</p>
            <div className="mb-3.5">
              <div className="mb-2 font-mono text-[11px] tracking-[0.06em] text-text-3">SCENARIO SCORES</div>
              <div className="flex flex-col gap-1.5">
                {scenarios.map((s) => {
                  const score = selectedOption.scores.find((sc) => sc.scenario_id === s.id);
                  return (
                    <div key={s.id} className="flex items-start gap-2 text-[12.5px] leading-[1.5]">
                      <span className={score?.robust ? "text-[#10B981]" : score ? "text-[#EF4444]" : "text-muted-foreground"}>{score?.robust ? "✓" : score ? "✕" : "–"}</span>
                      <span>
                        <strong className="font-medium">{s.name}</strong>
                        {score ? `: ${score.rationale}` : ": not yet scored"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mb-[18px] grid grid-cols-2 gap-2.5">
              <div className="rounded-[10px] border border-border p-3">
                <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">RISK</div>
                <div className="mt-1.5">
                  <span className={cn(BADGE_BASE, riskBadge(selectedOption.risk))}>{selectedOption.risk ?? "Unscored"}</span>
                </div>
              </div>
              <div className="rounded-[10px] border border-border p-3">
                <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">COST</div>
                <div className="mt-1.5 text-[13px] font-semibold">{selectedOption.cost ?? "Unscored"}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1" onClick={onMarkPrimary} disabled={selectedOption.is_primary || markingPrimary}>
                {selectedOption.is_primary ? "Primary ✓" : markingPrimary ? "Marking…" : "Mark as primary"}
              </Button>
              <Button variant="ghost" onClick={() => setSelectedOptionId(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={draftOpen} onOpenChange={(o) => !o && setDraftOpen(false)}>
        <DialogContent className="max-w-[560px] p-6">
          <DialogTitle className="mb-1 text-[18px] font-semibold">Draft route{target ? ` to ${target.name}` : ""}</DialogTitle>
          <p className="mb-4 text-[13px] text-muted-foreground">Review before anything is added — nothing is saved until you confirm.</p>
          {draftLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Drafting…</div>
          ) : draftError ? (
            <div className="rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-[12.5px] text-[#92400E]">{draftError}</div>
          ) : (
            <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto">
              {draftMoves?.map((m, i) => (
                <div key={i} className="rounded-[10px] border border-border p-3">
                  <div className="flex items-center gap-2 text-[11px] font-mono text-text-3">
                    <span className="capitalize">{m.lane}</span> · {HORIZON_LABEL[m.horizon]}
                  </div>
                  <div className="mt-1 text-[13.5px] font-medium">{m.title}</div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={onConfirmDraft} disabled={draftLoading || !draftMoves?.length}>
              Add {draftMoves?.length ?? 0} move{draftMoves?.length === 1 ? "" : "s"} to route
            </Button>
            <Button variant="ghost" onClick={() => setDraftOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {briefingOpen && <DcBriefing onClose={() => setBriefingOpen(false)} projectName={store.project.name} data={data} scenarios={scenariosLite} />}
    </div>
  );
}

function LeverColumn({
  title,
  sub,
  items,
  kind,
  titleById,
}: {
  title: string;
  sub: string;
  items: TrackedEvent[];
  kind: "support" | "block";
  titleById: Map<string, string>;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3.5">
      <div>
        <div className="text-[13px] font-semibold">
          {title} <span className="font-normal text-text-3">{items.length}</span>
        </div>
        <div className="mt-0.5 text-[12px] text-muted-foreground">{sub}</div>
      </div>
      {items.map((t) => {
        const d = delta(t);
        const last = t.hist[t.hist.length - 1];
        const good = kind === "block" ? d < 0 : d > 0;
        return (
          <div key={t.eventId} className="grid items-center gap-2 border-t border-[#F3F4F6] pt-2" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <div className="min-w-0">
              <div className="text-[12.5px] font-medium leading-[1.4]">{titleById.get(t.eventId) ?? "an untitled event"}</div>
              <div className="mt-0.5 text-[11px] text-text-3">
                {LIKELIHOOD_LEVELS[last]}
                {kind === "block" ? (t.lever === "influence" ? " · reduce" : " · hedge") : ""}
              </div>
            </div>
            <span className="font-mono text-[12px] font-semibold" style={{ color: d === 0 ? "#9CA3AF" : good ? "#047857" : "#B91C1C" }}>
              {d > 0 ? "↑" : d < 0 ? "↓" : "→"}
            </span>
          </div>
        );
      })}
      {items.length === 0 && <div className="text-[12px] text-text-3">None.</div>}
    </div>
  );
}

// Supporting events with no event_levers row yet — nothing wrote this column before
// 0049_event_levers_shape.sql's app-code change, so every real project starts here. Triaged
// inline rather than sent to a separate screen: this is the one place the gap is visible.
function UnclassifiedLevers({
  items,
  titleById,
  onClassify,
}: {
  items: TrackedEvent[];
  titleById: Map<string, string>;
  onClassify: (eventId: string, lever: "shape" | "influence" | "watch") => void;
}) {
  return (
    <div className="mb-3 rounded-xl border border-dashed border-border bg-[#FAFAFA] p-3.5">
      <div className="text-[12.5px] font-semibold">
        {items.length} supporting event{items.length === 1 ? "" : "s"} not classified yet
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((t) => (
          <div key={t.eventId} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-2 first:border-t-0 first:pt-0">
            <span className="text-[12.5px] font-medium leading-[1.4]">{titleById.get(t.eventId) ?? "an untitled event"}</span>
            <div className="flex gap-1.5">
              {(["shape", "influence", "watch"] as const).map((lever) => (
                <Button key={lever} variant="ghost" size="sm" className="bg-white capitalize" onClick={() => onClassify(t.eventId, lever)}>
                  {lever}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// design/strategy_handoff's ST_KIND — what kind of initiative this is, distinct from an
// event's own lever (event_levers.lever only has shape/influence/watch; 'research' exists
// only at the initiative level, for a watch-only target you investigate before committing).
const INITIATIVE_KIND_META: Record<InitiativeKind, { label: string; bg: string; fg: string; sub: string }> = {
  shape: { label: "Shape", bg: "#ECFDF5", fg: "#065F46", sub: "Internal project. Makes the event happen." },
  influence: { label: "Influence", bg: "#EFF6FF", fg: "#1D4ED8", sub: "Partnership or coalition. Makes it more likely." },
  research: { label: "Research", bg: "#F5F3FF", fg: "#6D28D9", sub: "Study or pilot. Tells you sooner which way it goes." },
  hedge: { label: "Hedge", bg: "#FFFBEB", fg: "#B45309", sub: "Fallback. Protects you if it goes the wrong way." },
};
const INITIATIVE_CONTROL_LABEL: Record<"shape" | "influence" | "watch", string> = {
  shape: "You shape",
  influence: "You influence",
  watch: "Outside your control",
};
const INITIATIVE_WIND_STYLE: Record<InitiativeWind, { symbol: string; fg: string; bg: string }> = {
  helps: { symbol: "✓", fg: "#047857", bg: "#ECFDF5" },
  neutral: { symbol: "–", fg: "#6B7280", bg: "#F3F4F6" },
  hurts: { symbol: "✕", fg: "#B91C1C", bg: "#FEF2F2" },
};

function InitiativeWindRow({ wind, scenariosLite, targetId }: { wind: Record<string, InitiativeWind>; scenariosLite: ScenarioLite[]; targetId: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {scenariosLite.map((s) => {
        const w = INITIATIVE_WIND_STYLE[wind[s.id] ?? "neutral"];
        return (
          <span
            key={s.id}
            title={`${s.name}: ${wind[s.id] ?? "neutral"}`}
            className="inline-flex items-center gap-1 rounded-full px-[7px] py-[2px] text-[11px] text-[#374151]"
            style={{ background: w.bg, border: `1px solid ${s.id === targetId ? s.color ?? "#9CA3AF" : "transparent"}` }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color ?? "#9CA3AF" }} />
            {s.name.split(" ")[0]}
            <b style={{ color: w.fg }}>{w.symbol}</b>
          </span>
        );
      })}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: "92px minmax(0,1fr)" }}>
      <span className="text-text-3">{label}</span>
      <span className="text-[#374151]">{value}</span>
    </div>
  );
}

function InitiativeCard({
  initiative,
  target,
  scenariosLite,
  trackedTitleById,
  trackedLevelById,
  onAct,
}: {
  initiative: InitiativeWithTargets;
  target: ScenarioLite;
  scenariosLite: ScenarioLite[];
  trackedTitleById: Map<string, string>;
  trackedLevelById: Map<string, number>;
  onAct: (status: "approved" | "dismissed" | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const meta = INITIATIVE_KIND_META[initiative.kind];
  const approved = initiative.status === "approved";
  const dismissed = initiative.status === "dismissed";
  const hurtsTarget = initiative.wind[target.id] === "hurts";
  const lane = LANES.find((l) => l.id === (initiative.kind === "hedge" ? "hedge" : Object.values(initiative.wind).every((w) => w === "helps") ? "noregret" : "shaping"));

  const targetLabel = (t: InitiativeWithTargets["targets"][number]) => (t.eventId ? trackedTitleById.get(t.eventId) ?? t.title ?? "an event" : t.title ?? "a target");

  return (
    <div
      className="flex min-w-0 flex-col gap-2.5 rounded-xl bg-white p-3.5"
      style={{ border: `1px solid ${approved ? "#A7F3D0" : "#E5E7EB"}`, opacity: dismissed ? 0.6 : 1 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={BADGE_BASE} style={{ background: meta.bg, color: meta.fg }}>
          {meta.label}
        </span>
        <span className="text-[11px] text-muted-foreground">{[initiative.owner, initiative.cost, initiative.timeLabel].filter(Boolean).join(" · ")}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[14px] font-semibold leading-[1.35]">{initiative.title}</div>
        <div className="text-[12.5px] leading-[1.5] text-[#4B5563]">{initiative.why}</div>
      </div>
      {initiative.question && (
        <div className="rounded-md bg-[#FAFAF9] p-2.5 text-[12.5px] leading-[1.5]">
          <span className="mb-0.5 block font-mono text-[9.5px] uppercase text-text-3">Question to answer</span>
          {initiative.question}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[9.5px] uppercase text-text-3">
          {initiative.kind === "research" || initiative.kind === "hedge" ? "Watches" : "Targets"}
          {initiative.forceLabel && ` · ${initiative.forceLabel}${initiative.poleLabel ? ` → ${initiative.poleLabel}` : ""}`}
        </span>
        {initiative.targets.map((t) => (
          <div key={t.id} className="grid items-baseline gap-2 text-[12.5px] leading-[1.4]" style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
            <span className="truncate">{targetLabel(t)}</span>
            <span className="whitespace-nowrap text-[11px] text-muted-foreground">
              {INITIATIVE_CONTROL_LABEL[t.control]}
              {t.eventId && trackedLevelById.has(t.eventId) ? ` · ${LIKELIHOOD_LEVELS[trackedLevelById.get(t.eventId)!]}` : ""}
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9.5px] uppercase text-text-3">In all four futures</span>
        <InitiativeWindRow wind={initiative.wind} scenariosLite={scenariosLite} targetId={target.id} />
        {hurtsTarget && <span className="text-[11.5px] text-[#B91C1C]">Works against your target future.</span>}
      </div>
      {open && (
        <div className="flex flex-col gap-1.5 border-t border-[#F3F4F6] pt-2.5 text-[12px] leading-[1.45]">
          <DetailRow label="Working if" value={initiative.earlySign} />
          <DetailRow label="Stop if" value={initiative.stopIf} />
          {initiative.informs && <DetailRow label="Informs" value={initiative.informs} />}
          <DetailRow
            label="Evidence"
            value={
              <div className="flex flex-col gap-1">
                {initiative.evidence.map((e, i) => (
                  <span key={i}>
                    <i>&quot;{e.cite}&quot;</i> <span className="text-text-3">· {e.source}</span>
                  </span>
                ))}
              </div>
            }
          />
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        {approved ? (
          <>
            <span className="text-[12px] font-medium text-[#047857]">✓ On route{lane ? ` · ${lane.name}` : ""}</span>
            <Button variant="ghost" size="sm" className="border-none" onClick={() => onAct(null)}>
              Undo
            </Button>
          </>
        ) : dismissed ? (
          <>
            <span className="text-[12px] text-muted-foreground">Dismissed</span>
            <Button variant="ghost" size="sm" className="border-none" onClick={() => onAct(null)}>
              Restore
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" size="sm" onClick={() => onAct("approved")}>
              Add to route
            </Button>
            <Button variant="ghost" size="sm" className="border-none" onClick={() => onAct("dismissed")}>
              Dismiss
            </Button>
          </>
        )}
        <Button variant="ghost" size="sm" className="ml-auto border-none" onClick={() => setOpen((o) => !o)}>
          {open ? "Less" : "Details"}
        </Button>
      </div>
    </div>
  );
}

function InitiativesSection({
  target,
  scenariosLite,
  initiatives,
  trackedTitleById,
  trackedLevelById,
  kindFilter,
  onKindFilterChange,
  showDismissed,
  onToggleShowDismissed,
  suggesting,
  exhausted,
  onSuggest,
  onAct,
}: {
  target: ScenarioLite;
  scenariosLite: ScenarioLite[];
  initiatives: InitiativeWithTargets[];
  trackedTitleById: Map<string, string>;
  trackedLevelById: Map<string, number>;
  kindFilter: "all" | InitiativeKind;
  onKindFilterChange: (k: "all" | InitiativeKind) => void;
  showDismissed: boolean;
  onToggleShowDismissed: () => void;
  suggesting: boolean;
  exhausted: boolean;
  onSuggest: () => void;
  onAct: (initiativeId: string, status: "approved" | "dismissed" | null) => void;
}) {
  const rank: Record<InitiativeWind, number> = { helps: 0, neutral: 1, hurts: 2 };
  const pool = [...initiatives].sort((a, b) => rank[a.wind[target.id] ?? "neutral"] - rank[b.wind[target.id] ?? "neutral"]);
  const live = pool.filter((i) => i.status !== "dismissed");
  const dismissed = pool.filter((i) => i.status === "dismissed");
  const shown = showDismissed ? pool : live;
  const list = shown.filter((i) => kindFilter === "all" || i.kind === kindFilter);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-brand-dark">Initiatives toward {target.name}</div>
          <div className="mt-0.5 max-w-[640px] text-[12.5px] text-muted-foreground">
            Projects and research you can launch. Each one makes an event your target needs more likely, or prepares you for one you can&apos;t move.
          </div>
        </div>
        <Button variant="ghost" size="sm" disabled={suggesting || exhausted} onClick={onSuggest}>
          <Icons.Sparkle size={12} /> {suggesting ? "Looking…" : exhausted ? "No more for now" : "Suggest more"}
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", "shape", "influence", "research", "hedge"] as const).map((k) => {
          const count = shown.filter((i) => k === "all" || i.kind === k).length;
          const on = kindFilter === k;
          return (
            <button
              key={k}
              onClick={() => onKindFilterChange(k)}
              title={k === "all" ? undefined : INITIATIVE_KIND_META[k].sub}
              className="rounded-full px-[11px] py-1 text-[12px] font-medium"
              style={{ border: `1px solid ${on ? "#1E1B2E" : "#E5E7EB"}`, background: on ? "#1E1B2E" : "#fff", color: on ? "#fff" : "#374151" }}
            >
              {k === "all" ? "All" : INITIATIVE_KIND_META[k].label} · {count}
            </button>
          );
        })}
      </div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,320px),1fr))" }}>
        {list.map((i) => (
          <InitiativeCard
            key={i.id}
            initiative={i}
            target={target}
            scenariosLite={scenariosLite}
            trackedTitleById={trackedTitleById}
            trackedLevelById={trackedLevelById}
            onAct={(status) => onAct(i.id, status)}
          />
        ))}
      </div>
      {list.length === 0 && (
        <div className="text-[13px] text-muted-foreground">No {kindFilter === "all" ? "" : `${INITIATIVE_KIND_META[kindFilter].label.toLowerCase()} `}initiatives proposed.</div>
      )}
      {dismissed.length > 0 && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" className="border-none" onClick={onToggleShowDismissed}>
            {showDismissed ? "Hide" : "Show"} {dismissed.length} dismissed
          </Button>
        </div>
      )}
    </div>
  );
}

function AcceptPopover({ onAccept }: { onAccept: (options: { ownerId?: string | null; dueOn?: string | null }) => void }) {
  const store = useStore();
  const [open, setOpen] = React.useState(false);
  const [assignToMe, setAssignToMe] = React.useState(false);
  const [dueOn, setDueOn] = React.useState("");

  const confirm = () => {
    onAccept({ ownerId: assignToMe ? store.user.id || null : null, dueOn: dueOn || null });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="primary" size="sm">
          Accept
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        <div className="mb-2 text-[12.5px] font-semibold">Accept &amp; route update</div>
        <label className="mb-2 flex items-center gap-2 text-[12.5px]">
          <input type="checkbox" checked={assignToMe} onChange={(e) => setAssignToMe(e.target.checked)} />
          Assign to me
        </label>
        <label className="mb-3 block text-[12px] text-muted-foreground">
          Due date (optional)
          <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className="mt-1 block w-full rounded-md border border-border px-2 py-1 text-[12.5px]" />
        </label>
        <Button variant="primary" size="sm" className="w-full" onClick={confirm}>
          Accept
        </Button>
      </PopoverContent>
    </Popover>
  );
}
