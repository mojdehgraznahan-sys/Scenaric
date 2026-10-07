"use client";

// Monitoring v2 (design/2026-10-05/02-monitoring/PROMPTS.md) — which future is arriving, what
// moved it, and what to do about it. Replaces the old indicators-based page entirely (Phase 1
// plan, Finding 1): indicators/indicator_readings stay in the DB untouched for the retirement
// grace period, but nothing here reads them anymore. Reference:
// design/2026-10-05/02-monitoring/Monitoring Standalone.html's PageMonitoring, wired to real
// data via useDecisions(projectId) instead of the mockup's window.FM_DECISIONS/DecisionStore.
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { useDecisions } from "@/lib/use-decisions";
import { delta, windowPoints, LIKELIHOOD_LEVELS, STORYLINE_PHASES, type StorylinePhase } from "@/lib/decision-model";
import { toTrackedEvent, type TrackedEventRow } from "@/lib/decision-tracking";
import { DcSpark, DcTrend, DcScenarioDots, DcActionCard, DcBriefing, type ScenarioLite } from "@/components/decision-ui";
import { slPole } from "@/components/signals/pole";
import { DEFAULT_COLUMN_LABELS } from "@/components/storyline/data";
import type { ActionCardRow } from "@/components/decision-ui";

const PHASE_LABEL: Record<StorylinePhase, string> = {
  precursors: DEFAULT_COLUMN_LABELS[0],
  catalysts: DEFAULT_COLUMN_LABELS[1],
  first_order: DEFAULT_COLUMN_LABELS[2],
  second_order: DEFAULT_COLUMN_LABELS[3],
  realized: DEFAULT_COLUMN_LABELS[4],
};

type Filter = "All" | "Changed" | "Helps target" | "Works against";

function formatLastScan(ranAt: string): string {
  return new Date(ranAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function PageMonitoring() {
  const store = useStore();
  const navigate = useNavigate();
  const projectId = store.activeProjectId;
  const scenarios = React.useMemo(() => store.scenarios.filter((s) => !s.archived), [store.scenarios]);
  const scenariosLite: ScenarioLite[] = React.useMemo(() => scenarios.map((s) => ({ id: s.id, name: s.name, color: s.color })), [scenarios]);
  const scenarioById = React.useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios]);
  const eventById = React.useMemo(() => new Map(store.events.map((e) => [e.id, e])), [store.events]);
  const signalById = React.useMemo(() => new Map(store.signals.map((s) => [s.id, s])), [store.signals]);

  const { data, loading, actOnCard, reviewDiscovery } = useDecisions(projectId);
  const [filter, setFilter] = React.useState<Filter>("All");
  const [briefingOpen, setBriefingOpen] = React.useState(false);

  // Deep link from Home's charts (design/2026-10-05/04-home-ceo-view/PROMPTS.md Prompt 2:
  // "Each chart element links to its source event in Monitoring,
  // /app/monitoring?event={id}") — scrolls to and briefly highlights that event's row once
  // it's loaded, rather than leaving the query param a no-op.
  const searchParams = useSearchParams();
  const highlightEventId = searchParams.get("event");
  React.useEffect(() => {
    if (!highlightEventId || !data) return;
    const el = document.getElementById(`dc-event-${highlightEventId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightEventId, data]);

  const points = React.useMemo(() => windowPoints(), []);
  // Wildcards are tracked server-side like anything else once linked to a scenario, but don't
  // belong in the main list (handoff Prompt 2, edge case) — split them out here using the real
  // events list already loaded by useStore(), rather than adding an is_wildcard column to
  // TrackedEventRow just for this one filter.
  const { mainTracked, wildcardTracked } = React.useMemo(() => {
    const main: TrackedEventRow[] = [];
    const wild: TrackedEventRow[] = [];
    for (const t of data?.tracked ?? []) (eventById.get(t.eventId)?.wildcard ? wild : main).push(t);
    return { mainTracked: main, wildcardTracked: wild };
  }, [data?.tracked, eventById]);

  const modeled = React.useMemo(() => mainTracked.map((row) => ({ row, model: toTrackedEvent(row, points) })), [mainTracked, points]);
  const trackedById = React.useMemo(() => new Map(mainTracked.map((t) => [t.eventId, t])), [mainTracked]);

  if (!projectId) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">Select a project to see Monitoring.</div>;
  }
  if (loading && !data) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!data) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">Couldn&apos;t load Monitoring. Try reloading.</div>;
  }

  if (mainTracked.length === 0 && wildcardTracked.length === 0) {
    return (
      <div className="scroll-y flex-1 overflow-y-auto p-5">
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <h2 className="m-0 text-lg font-semibold">Monitoring</h2>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Which future is arriving, what moved it, and what to do about it.</div>
          <div className="mt-4 rounded-[10px] border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Monitoring starts once your storyline links events to scenarios.{" "}
            <button onClick={() => navigate("/storyline")} className="font-semibold text-brand-orange700 underline">
              Go to Storyline
            </button>
          </div>
        </div>
      </div>
    );
  }

  const target = data.targetScenarioId ? scenarioById.get(data.targetScenarioId) ?? null : null;
  const health = data.targetScenarioId ? data.healthByScenario[data.targetScenarioId] : null;
  const pending = data.actions.filter((a) => a.status === "pending");
  const helps = (eventId: string) => (target ? (trackedById.get(eventId)?.supports.includes(target.id) ?? false) : false);

  const rows = modeled
    .filter(({ row, model }) => {
      if (filter === "All") return true;
      if (filter === "Changed") return delta(model) !== 0;
      if (filter === "Helps target") return helps(row.eventId);
      return !helps(row.eventId); // Works against
    })
    .sort((a, b) => Math.abs(delta(b.model) * b.model.impact) - Math.abs(delta(a.model) * a.model.impact));

  const unfitDiscoveries = data.inbox.filter((n) => !n.fits && n.dc_status === "pending");

  const toneColor = health ? ({ low: "#10B981", mid: "#F59E0B", high: "#EF4444" }[health.tone]) : "#9CA3AF";

  const evidenceTitleFor = (card: ActionCardRow): string | null => {
    if (card.evidence_event_id) return trackedById.get(card.evidence_event_id)?.title ?? null;
    if (card.evidence_discovery_id) return data.inbox.find((d) => d.id === card.evidence_discovery_id)?.title ?? null;
    return null;
  };

  const resolveDiscoveryForce = (forceId: string, side: "a" | "b" | null) => {
    const signal = signalById.get(forceId);
    if (!signal) return { forceTitle: "(unknown force)", poleText: "" };
    return { forceTitle: signal.title, poleText: side ? slPole(signal, side) : signal.poleB };
  };

  const sectionHeader = (title: string, sub?: string, right?: React.ReactNode) => (
    <div className="mb-2.5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-brand-dark">{title}</div>
        {sub && <div className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</div>}
      </div>
      {right}
    </div>
  );

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="m-0 text-lg font-semibold">Monitoring</h2>
              <div className="mt-0.5 text-[13px] text-muted-foreground">Which future is arriving, what moved it, and what to do about it.</div>
              <div className="mt-2 font-mono text-[11px] text-text-3">
                {data.lastScan ? `Last scan ${formatLastScan(data.lastScan.ran_at)} · ${data.lastScan.sources_scanned} sources` : "First scan runs tonight at 06:00"}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setBriefingOpen(true)}>
                <Icons.File size={12} /> Executive briefing
              </Button>
              <Button variant="primary" size="sm" onClick={() => navigate("/strategy")}>
                {pending.length} actions in Strategy <Icons.ArrowRight size={12} />
              </Button>
            </div>
          </div>

          {/* Target banner */}
          {target && health ? (
            <div
              className="mt-4 grid items-center gap-4 rounded-xl p-3.5"
              style={{ gridTemplateColumns: "auto minmax(0,1fr) auto", border: `1px solid ${target.color}` }}
            >
              <div>
                <div className="font-mono text-[11px] text-text-3">Target future</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="h-[9px] w-[9px] rounded-full" style={{ background: target.color }} />
                  <span className="text-[16px] font-semibold">{target.name}</span>
                </div>
              </div>
              <div className="text-[13px] leading-[1.55] text-[#374151]">
                <b style={{ color: toneColor }}>{health.label}.</b> {health.gaining.length} supporting event{health.gaining.length === 1 ? "" : "s"} gaining,{" "}
                {health.weakening.length} weakening
                {health.weakening[0] ? ` (${trackedById.get(health.weakening[0].eventId)?.title ?? "an untitled event"})` : ""}.{" "}
                {health.blockersRising.length} blocker{health.blockersRising.length === 1 ? "" : "s"} rising.
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/strategy")}>
                View route
              </Button>
            </div>
          ) : (
            <div className="mt-4 rounded-[10px] border border-dashed border-border p-3.5 text-[13px] text-muted-foreground">
              Choose a target future in{" "}
              <button onClick={() => navigate("/strategy")} className="font-semibold text-brand-orange700 underline">
                Strategy
              </button>
              .
            </div>
          )}
        </div>

        {/* Scenario momentum */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          {sectionHeader(
            "Scenario momentum",
            "Event changes over the last 12 weeks, rolled up into each future through its links. Momentum is relative evidence, not probability."
          )}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))" }}>
            {scenarios.map((s) => {
              const m = data.momentumByScenario[s.id];
              const prog = data.progressByScenario[s.id] ?? 0;
              const sps = data.signposts.filter((p) => p.scenario_id === s.id);
              const isTarget = s.id === target?.id;
              const arrow = m.score >= 2 ? "↑" : m.score <= -2 ? "↓" : "→";
              return (
                <div
                  key={s.id}
                  className="flex flex-col gap-2.5 rounded-xl p-3.5"
                  style={{ border: isTarget ? `1.5px solid ${s.color}` : "1px solid #E5E7EB" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                    <span className="text-[13.5px] font-semibold">{s.name}</span>
                    {isTarget && <span className="ml-auto font-mono text-[11px]" style={{ color: s.color }}>Target</span>}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-[22px] font-semibold text-brand-dark">{arrow}</span>
                    <span className="text-[15px] font-semibold">{m.label}</span>
                  </div>
                  <div>
                    <div className="grid grid-cols-5 gap-[3px]">
                      {STORYLINE_PHASES.map((phase, i) => (
                        <span key={phase} title={PHASE_LABEL[phase]} className="h-[5px] rounded-sm" style={{ background: i < prog ? s.color : "#F3F4F6" }} />
                      ))}
                    </div>
                    <div className="mt-1 text-[11.5px] text-muted-foreground">
                      Storyline: {prog ? `${PHASE_LABEL[STORYLINE_PHASES[prog - 1]]} reached` : "no phase complete yet"}
                    </div>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Signposts: {sps.filter((p) => p.state === "hit").length} hit · {sps.filter((p) => p.state === "approaching").length} approaching ·{" "}
                    {sps.length} total
                  </div>
                  <div className="flex flex-col gap-[5px] border-t border-[#F3F4F6] pt-2">
                    {m.contrib.slice(0, 2).map((c) => (
                      <div key={c.event.eventId} className="grid items-start gap-1 text-[12px] leading-[1.4] text-[#374151]" style={{ gridTemplateColumns: "14px 1fr" }}>
                        <span className="font-mono" style={{ color: c.score > 0 ? "#B45309" : "#1D4ED8" }}>
                          {c.score > 0 ? "+" : "−"}
                        </span>
                        <span>{trackedById.get(c.event.eventId)?.title ?? "an untitled event"}</span>
                      </div>
                    ))}
                    {!m.contrib.length && <div className="text-[12px] text-text-3">No supporting event moved.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid items-start gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))" }}>
          {/* Tracked events */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            {sectionHeader(
              "Tracked events",
              "Likelihood re-scored daily against the news. Every change cites its source.",
              <div className="flex flex-wrap gap-1">
                {(["All", "Changed", "Helps target", "Works against"] as const).map((f) => (
                  <Button key={f} variant={filter === f ? "primary" : "ghost"} size="sm" className="px-2.5" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {f}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex flex-col">
              {rows.map(({ row, model }, i) => {
                const last = model.hist[model.hist.length - 1];
                const d = delta(model);
                const good = target ? (helps(row.eventId) ? d > 0 : d < 0) : null;
                const latestScanChange = [...row.history].filter((h) => h.changedBy === "scan").sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
                const latestUserChange = !latestScanChange ? [...row.history].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0] : null;
                return (
                  <div
                    key={row.eventId}
                    id={`dc-event-${row.eventId}`}
                    className={cn("grid gap-x-3.5 gap-y-1.5 rounded-md py-3 transition-colors", i > 0 && "border-t border-[#F3F4F6]")}
                    style={{
                      gridTemplateColumns: "minmax(0,1fr) auto",
                      ...(row.eventId === highlightEventId ? { background: "#FFF7ED", boxShadow: "0 0 0 1px #FED7AA" } : {}),
                    }}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13.5px] font-medium text-brand-dark">{row.title}</span>
                        {d !== 0 && last < 4 && good !== null && (
                          <span className="text-[11px] font-semibold" style={{ color: good ? "#047857" : "#B91C1C" }}>
                            {good ? "good for target" : "bad for target"}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-text-3">
                        {row.forceTitle} → {row.pole} · {PHASE_LABEL[row.phase]}
                      </div>
                      {latestScanChange ? (
                        <div className="mt-1.5 text-[12px] leading-[1.45] text-[#4B5563]">
                          “{latestScanChange.cite}” <span className="text-text-3">{latestScanChange.sourceTitle}, {new Date(latestScanChange.observedAt).toLocaleDateString()}</span>
                        </div>
                      ) : latestUserChange ? (
                        <div className="mt-1.5 text-[12px] leading-[1.45] text-[#4B5563]">Updated manually.</div>
                      ) : null}
                      <div className="mt-1.5">
                        <DcScenarioDots scenarioIds={row.supports} targetId={target?.id ?? null} scenarios={scenariosLite} />
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <DcTrend hist={model.hist} />
                      <DcSpark hist={model.hist} color={d === 0 ? "#9CA3AF" : good === false ? "#EF4444" : good === true ? "#10B981" : "#9CA3AF"} />
                      <span aria-label={`${row.title}: ${LIKELIHOOD_LEVELS[model.hist[0]]} to ${LIKELIHOOD_LEVELS[last]} over 12 weeks`} className="font-mono text-[11px] text-[#374151]">
                        {d ? `${LIKELIHOOD_LEVELS[model.hist[0]]} → ` : ""}
                        {LIKELIHOOD_LEVELS[last]}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {/* Recommended actions */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              {sectionHeader("Recommended actions", "Created when a threshold is crossed. Accepting one updates your route in Strategy.")}
              <div className="flex flex-col gap-2.5">
                {pending.slice(0, 3).map((a) => (
                  <DcActionCard
                    key={a.id}
                    card={a}
                    status="pending"
                    compact
                    evidenceTitle={evidenceTitleFor(a)}
                    scenario={a.scenario_id ? scenariosLite.find((s) => s.id === a.scenario_id) ?? null : null}
                    onAct={(card, status) => actOnCard(card.id, status, store.user.id || null)}
                  />
                ))}
                {!pending.length && <div className="text-[13px] text-muted-foreground">All actions handled.</div>}
                {pending.length > 3 && (
                  <Button variant="ghost" size="sm" onClick={() => navigate("/strategy")}>
                    +{pending.length - 3} more in Strategy
                  </Button>
                )}
              </div>
            </div>

            {/* New events found */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-card">
              {sectionHeader("New events found", "Developments not yet in your project. Nothing joins until you confirm it.")}
              {unfitDiscoveries.length >= 2 && (
                <div className="mb-2.5 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] p-3">
                  <div className="text-[12.5px] font-semibold text-[#92400E]">Your frame may be missing something</div>
                  <div className="mt-[3px] text-[12.5px] leading-[1.5] text-[#78350F]">
                    {unfitDiscoveries.length} new events fit no existing force. Add the force, then check in the Matrix whether it should become an axis.
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <Button variant="ghost" size="sm" className="bg-white" onClick={() => navigate("/signals")}>
                      Add force
                    </Button>
                    <Button variant="ghost" size="sm" className="bg-white" onClick={() => navigate("/matrix")}>
                      Review axes
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex flex-col">
                {data.inbox.map((n, i) => {
                  const resolved = n.fits && n.proposed_force_id ? resolveDiscoveryForce(n.proposed_force_id, n.proposed_side) : null;
                  return (
                    <div key={n.id} className={cn("flex flex-col gap-1.5 py-2.5", i > 0 && "border-t border-[#F3F4F6]", n.dc_status === "rejected" && "opacity-50")}>
                      <div className="text-[13px] font-medium leading-[1.4]">{n.title}</div>
                      <div className="text-[11.5px] text-text-3">
                        {n.source_name ?? "Unknown source"} · {new Date(n.found_at).toLocaleDateString()} · {n.likelihood ?? (n.status === "observed" ? "Observed" : "Medium")}
                      </div>
                      {resolved ? (
                        <>
                          <div className="text-[12px] text-[#374151]">
                            Proposed: {resolved.forceTitle} → {resolved.poleText}
                          </div>
                          <DcScenarioDots scenarioIds={n.proposed_scenarios} targetId={target?.id ?? null} scenarios={scenariosLite} />
                        </>
                      ) : (
                        <div className="text-[12px] text-[#92400E]">Fits no force. {n.proposal}</div>
                      )}
                      {n.dc_status === "pending" ? (
                        <div className="flex gap-1.5">
                          {n.fits ? (
                            <Button variant="soft" size="sm" onClick={() => reviewDiscovery(n.id, "confirmed", store.user.id || null)}>
                              Confirm
                            </Button>
                          ) : (
                            <Button
                              variant="soft"
                              size="sm"
                              onClick={() => {
                                reviewDiscovery(n.id, "sent_to_signals", store.user.id || null);
                                navigate("/signals");
                              }}
                            >
                              Send to Signals
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="border-none" onClick={() => reviewDiscovery(n.id, "rejected", store.user.id || null)}>
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[12px] text-muted-foreground">
                          <span>{n.dc_status === "confirmed" ? "Added to project and tracked" : n.dc_status === "sent_to_signals" ? "Sent to Signals" : "Rejected"}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {data.inbox.length === 0 && <div className="text-[13px] text-muted-foreground">Nothing found yet.</div>}
              </div>

              {wildcardTracked.length > 0 && <WildcardsRow tracked={wildcardTracked} eventById={eventById} />}
            </div>
          </div>
        </div>
      </div>
      {briefingOpen && <DcBriefing onClose={() => setBriefingOpen(false)} projectName={store.project.name} data={data} scenarios={scenariosLite} />}
    </div>
  );
}

// Collapsed "Wildcards · watched" row (handoff Prompt 2 edge case) — wildcards stay out of
// the main Tracked events list but are still worth a glance at their early sign.
function WildcardsRow({ tracked, eventById }: { tracked: { eventId: string; title: string }[]; eventById: Map<string, { precursor: string | null }> }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-2.5 border-t border-[#F3F4F6] pt-2.5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-1.5 border-none bg-transparent p-0 text-left font-mono text-[11px] text-text-3">
        <Icons.ArrowRight size={10} className={cn("transition-transform", open && "rotate-90")} />
        Wildcards · watched ({tracked.length})
      </button>
      {open && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {tracked.map((t) => (
            <div key={t.eventId} className="text-[12px] text-[#4B5563]">
              <span className="font-medium">{t.title}</span>
              {eventById.get(t.eventId)?.precursor && <span className="text-text-3"> · Early sign: {eventById.get(t.eventId)?.precursor}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
