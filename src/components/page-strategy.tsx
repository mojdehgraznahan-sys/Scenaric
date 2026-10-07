"use client";

// Strategy v2 (design/2026-10-05/03-strategy/PROMPTS.md) — steer toward the future you want,
// stay ready for the other three. Replaces the old options-only robustness-grid page: that
// grid survives as this page's "Wind tunnel" section (extended with a target-column highlight
// and Robust/Depends-on-target/Hedge verdicts), everything else here (target picker, route
// health, levers, route swimlane, revision card) is new, wired to useDecisions(projectId).
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { useDecisions } from "@/lib/use-decisions";
import { listStrategicOptions, type StrategicOptionWithScores } from "@/lib/actions/strategy";
import { delta, levers, windowPoints, LIKELIHOOD_LEVELS, type LeversResult, type TrackedEvent } from "@/lib/decision-model";
import { toTrackedEvent } from "@/lib/decision-tracking";
import { draftRouteForTarget, type RouteDraftMove } from "@/lib/actions/ai-strategy-route";
import { DcActionCard, DcBriefing, type ActionCardRow, type ScenarioLite } from "@/components/decision-ui";
import type { Database } from "@/lib/supabase/types";

type RouteMoveRow = Database["public"]["Tables"]["route_moves"]["Row"];

const BADGE_BASE = "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";

function riskBadge(risk: string | null) {
  if (risk === "Low") return "bg-[#ECFDF5] text-[#065F46]";
  if (risk === "Medium") return "bg-[#FFFBEB] text-[#B45309]";
  if (risk === "High") return "bg-brand-orangeLight text-brand-orange700";
  return "bg-[#F3F4F6] text-muted-foreground";
}

const LANES: { id: RouteMoveRow["lane"]; name: string; sub: string }[] = [
  { id: "noregret", name: "No-regret", sub: "Do now. Pays off in all four futures." },
  { id: "shaping", name: "Shaping", sub: "Make the events that lead to the target more likely." },
  { id: "hedge", name: "Hedges", sub: "Held in reserve. Triggered if another future gains ground." },
];
const HORIZONS: RouteMoveRow["horizon"][] = ["now", "2027", "2028", "2029_30"];
const HORIZON_LABEL: Record<RouteMoveRow["horizon"], string> = { now: "Now", "2027": "2027", "2028": "2028", "2029_30": "2029–30" };

const MOVE_STATUS_STYLE: Record<RouteMoveRow["status"], { bg: string; fg: string }> = {
  active: { bg: "#ECFDF5", fg: "#065F46" },
  planned: { bg: "#F3F4F6", fg: "#374151" },
  held: { bg: "#F9FAFB", fg: "#6B7280" },
  armed: { bg: "#FFFBEB", fg: "#B45309" },
  paused: { bg: "#EFF6FF", fg: "#1D4ED8" },
};

export function PageStrategy() {
  const store = useStore();
  const navigate = useNavigate();
  const projectId = store.activeProjectId;
  const scenarios = React.useMemo(() => store.scenarios.filter((s) => !s.archived), [store.scenarios]);
  const scenariosLite: ScenarioLite[] = React.useMemo(() => scenarios.map((s) => ({ id: s.id, name: s.name, color: s.color })), [scenarios]);
  const scenarioById = React.useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios]);

  const { data, loading, setTarget, actOnCard, createRoute, setRevision } = useDecisions(projectId);
  const [briefingOpen, setBriefingOpen] = React.useState(false);
  const [showDone, setShowDone] = React.useState(false);

  // Kept as a no-op read (arrives as /strategy?scenarioId={id} from Narrative) — same
  // convention as the page this replaces; pre-filtering the wind tunnel by it is out of scope.
  const searchParams = useSearchParams();
  void searchParams.get("scenarioId");

  // Wind tunnel reuses the existing strategic_options/strategy_scenario_scores data path —
  // this grid predates the decision layer and isn't part of useDecisions.
  const [options, setOptions] = React.useState<StrategicOptionWithScores[]>([]);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [generateNotice, setGenerateNotice] = React.useState<string | null>(null);
  const refreshOptions = React.useCallback(async (id: string) => {
    setOptionsLoading(true);
    try {
      setOptions(await listStrategicOptions(id));
    } catch (err) {
      console.error("[strategy] failed to load strategic options", err);
    } finally {
      setOptionsLoading(false);
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
      .then((d: { sufficientEvidence: boolean; rationale: string | null; primaryOptionId: string | null; pairingOptionId: string | null }) =>
        setRecommendation(d.sufficientEvidence && d.rationale ? { rationale: d.rationale, primaryOptionId: d.primaryOptionId, pairingOptionId: d.pairingOptionId } : null)
      )
      .catch(() => setRecommendation(null))
      .finally(() => setRecommendationLoading(false));
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

  if (!projectId) return <div className="flex-1 p-5 text-sm text-muted-foreground">Select a project to see Strategy.</div>;
  if (loading && !data) return <div className="flex-1 p-5 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="flex-1 p-5 text-sm text-muted-foreground">Couldn&apos;t load Strategy. Try reloading.</div>;

  const target = data.targetScenarioId ? scenarioById.get(data.targetScenarioId) ?? null : null;
  const health = data.targetScenarioId ? data.healthByScenario[data.targetScenarioId] : null;
  const lev: LeversResult = target ? levers(target.id, modeled) : { influence: [], watch: [], block: [] };
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
    return { kind: "Option", value: options.find((o) => o.id === m.link_id)?.name ?? "an option" };
  };

  const onOpenDraft = async () => {
    if (!target) return;
    setDraftOpen(true);
    setDraftLoading(true);
    setDraftError(null);
    try {
      const moves = await draftRouteForTarget(projectId, target.name, {
        influenceEvents: lev.influence.map((t) => ({ id: t.eventId, title: trackedTitleById.get(t.eventId) ?? "" })),
        watchEvents: lev.watch.map((t) => ({ id: t.eventId, title: trackedTitleById.get(t.eventId) ?? "" })),
        blockerEvents: lev.block.map((t) => ({ id: t.eventId, title: trackedTitleById.get(t.eventId) ?? "" })),
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
                  if (status === "accepted" && (card.effect as { navigate?: string } | null)?.navigate) {
                    navigate((card.effect as { navigate: string }).navigate);
                  }
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

        {/* Levers */}
        {target && (
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            {sectionHeader(`Levers toward ${target.name}`, "The events that lead to your target, grouped by what you can do about each one.")}
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
              <LeverColumn title="Influence" sub="Push these with your own moves." items={lev.influence} kind="support" titleById={trackedTitleById} />
              <LeverColumn title="Watch" sub="Outside your control. Prepare for them." items={lev.watch} kind="support" titleById={trackedTitleById} />
              <LeverColumn title="Blockers" sub="These pull toward other futures. Reduce or hedge." items={lev.block} kind="block" titleById={trackedTitleById} />
            </div>
          </div>
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
                              return (
                                <div
                                  key={m.id}
                                  className="rounded-lg bg-white p-2.5"
                                  style={{ border: `1px solid ${m.status === "armed" ? "#FDE68A" : m.status === "paused" ? "#BFDBFE" : "#E5E7EB"}`, borderStyle: m.status === "held" ? "dashed" : "solid" }}
                                >
                                  <div className="text-[12.5px] font-semibold leading-[1.35]">{m.title}</div>
                                  <div className="mt-1 text-[11px] leading-[1.4] text-muted-foreground">
                                    <span className="text-text-3">{m.pushes ? "Pushes" : l.kind}:</span> {l.value}
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
