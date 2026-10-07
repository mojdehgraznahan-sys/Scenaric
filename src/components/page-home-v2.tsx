"use client";

// Home CEO view (design/2026-10-05/04-home-ceo-view/PROMPTS.md, Prompt 2) — the "three
// questions at a glance" view: where are we heading, is my route holding, what do I need to
// decide. Reference: `Home CEO View Standalone.html`'s PageHomeV2/HvCompass/HvGauge/
// HvMomentum/HvDiverging/HvSignposts/HvRouteMini, wired to real data via
// useDecisions(projectId) and decision-model.ts exactly like Monitoring/Strategy — no parallel
// data path.
//
// The futures compass needs two things the mock didn't: (1) which pole of each axis force the
// EVIDENCE currently leans toward (compassPosition(), same as Monitoring/Strategy use for
// momentum — isPlusPole is a fixed, self-consistent convention defined once here: side 'b' is
// "positive"); (2) which quadrant each SCENARIO sits in. The reference's hvQuad was a
// hardcoded per-scenario lookup table; the handoff itself flags the real analogue
// (scenarios.quadrant) as unreliable — there's no stored, guaranteed-consistent mapping from a
// scenario to "which pole of each axis force it represents" (ai-scenarios.ts's AI-assigned
// quadrant letter isn't tied to a fixed pole convention anywhere). So a scenario's quadrant is
// instead DERIVED the same way the evidence trail is: compassPosition() over just that
// scenario's own supporting tracked events. This guarantees internal consistency (trail and
// quadrant tinting always use the same sign convention) at the cost of a known, honest
// degeneracy: with zero tracked events (true of every project in both Supabase databases as of
// this build — see HANDOVER.md), every scenario computes to the same (0,0) quadrant. That's
// the correct, expected behavior for a feature whose whole point is "relative evidence, not a
// forecast" — not a bug to work around.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { useDecisions } from "@/lib/use-decisions";
import {
  compassPosition,
  windowPoints,
  buildHistFromHistory,
  LIKELIHOOD_LEVELS,
  STORYLINE_PHASES,
  type HealthLabel,
  type MomentumResult,
} from "@/lib/decision-model";
import type { TrackedEventRow } from "@/lib/decision-tracking";
import type { DecisionAxes } from "@/lib/actions/decisions";
import {
  DcActionCard,
  titleForTrackedEvent,
  ROUTE_LANES,
  ROUTE_HORIZONS,
  ROUTE_HORIZON_LABEL,
  ROUTE_MOVE_STATUS_STYLE,
  type ScenarioLite,
  type RouteMoveRow,
} from "@/components/decision-ui";

const GOOD = "#059669";
const BAD = "#DC2626";
const TONE_COLOR: Record<"low" | "mid" | "high", string> = { low: GOOD, mid: "#D97706", high: BAD };
type Quadrant = "TL" | "TR" | "BL" | "BR";

function ageLabel(iso: string): string {
  const diffH = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${diffH}h`;
  return `${Math.round(diffH / 24)}d`;
}

function formatShortDate(d: string | Date): string {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function HomeCard({
  title,
  sub,
  right,
  children,
  flex,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <div className={"flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-[18px] shadow-card" + (flex ? " flex-1" : "")}>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <div className="text-sm font-semibold text-brand-dark">{title}</div>
          {sub && <div className="mt-0.5 text-xs leading-[1.45] text-muted-foreground">{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function HomeCompass({
  scenarios,
  quadrantOf,
  targetId,
  axes,
  trail,
}: {
  scenarios: ScenarioLite[];
  quadrantOf: (id: string) => Quadrant;
  targetId: string | null;
  axes: DecisionAxes;
  trail: { x: number; y: number }[];
}) {
  const S = 360;
  const pad = 34;
  const c = S / 2;
  const r = c - pad;
  const P = (p: { x: number; y: number }): [number, number] => [c + p.x * r, c - p.y * r];
  const now = P(trail[trail.length - 1]);
  const qRect: Record<Quadrant, [number, number]> = { TL: [pad, pad], TR: [c, pad], BL: [pad, c], BR: [c, c] };
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="block w-full" style={{ maxWidth: 440, margin: "0 auto" }}>
      {scenarios.map((s) => {
        const q = quadrantOf(s.id);
        const [x, y] = qRect[q];
        const isT = s.id === targetId;
        const lx = q[1] === "L" ? x + 10 : x + r - 10;
        const ly = q[0] === "T" ? y + 20 : y + r - 12;
        const color = s.color ?? "#9CA3AF";
        return (
          <g key={s.id}>
            <rect x={x} y={y} width={r} height={r} fill={color} fillOpacity={isT ? 0.14 : 0.06} />
            {isT && <rect x={x + 1} y={y + 1} width={r - 2} height={r - 2} fill="none" stroke={color} strokeWidth={2} strokeDasharray="5 4" />}
            <text x={lx} y={ly} textAnchor={q[1] === "L" ? "start" : "end"} fontSize={12} fontWeight={600} fill="#1E1B2E">
              {s.name}
            </text>
            {isT && (
              <text
                x={lx}
                y={ly + (q[0] === "T" ? 14 : -14)}
                textAnchor={q[1] === "L" ? "start" : "end"}
                fontSize={9.5}
                fill={color}
                fontWeight={600}
                letterSpacing="0.08em"
              >
                TARGET
              </text>
            )}
          </g>
        );
      })}
      <line x1={pad} x2={S - pad} y1={c} y2={c} stroke="#D1D5DB" />
      <line y1={pad} y2={S - pad} x1={c} x2={c} stroke="#D1D5DB" />
      <text x={c} y={pad - 10} textAnchor="middle" fontSize={10} fill="#6B7280">
        {axes.yPoleB} ↑
      </text>
      <text x={c} y={S - pad + 18} textAnchor="middle" fontSize={10} fill="#6B7280">
        ↓ {axes.yPoleA}
      </text>
      <text x={pad - 8} y={c} textAnchor="middle" fontSize={10} fill="#6B7280" transform={`rotate(-90 ${pad - 10} ${c})`}>
        ← {axes.xPoleA}
      </text>
      <text x={S - pad + 10} y={c} textAnchor="middle" fontSize={10} fill="#6B7280" transform={`rotate(90 ${S - pad + 12} ${c})`}>
        {axes.xPoleB} →
      </text>
      <polyline points={trail.map((p) => P(p).join(",")).join(" ")} fill="none" stroke="#1E1B2E" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="3 3" />
      {trail.slice(0, -1).map((p, i) => {
        const [x, y] = P(p);
        return <circle key={i} cx={x} cy={y} r={3} fill="#1E1B2E" fillOpacity={0.15 + i * 0.1} />;
      })}
      <text x={P(trail[0])[0]} y={P(trail[0])[1] - 9} textAnchor="middle" fontSize={9.5} fill="#6B7280">
        12 wks ago
      </text>
      <circle cx={now[0]} cy={now[1]} r={13} fill="#1E1B2E" fillOpacity={0.1} />
      <circle cx={now[0]} cy={now[1]} r={6.5} fill="#1E1B2E" stroke="#fff" strokeWidth={2} />
      <text x={now[0]} y={now[1] + 25} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="#1E1B2E">
        Today
      </text>
    </svg>
  );
}

function HomeGauge({ label }: { label: HealthLabel }) {
  const W = 240;
  const cx = W / 2;
  const cy = 118;
  const R = 92;
  const posMap: Record<HealthLabel, number> = { "Off course": 0.16, "At risk": 0.42, Holding: 0.6, "On course": 0.84 };
  const pos = posMap[label];
  const pt = (p: number, rr: number): [number, number] => [cx - rr * Math.cos(Math.PI * p), cy - rr * Math.sin(Math.PI * p)];
  const arc = (a: number, b: number) => {
    const [x1, y1] = pt(a, R);
    const [x2, y2] = pt(b, R);
    return `M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}`;
  };
  const bands: [number, number, string, string][] = [
    [0, 0.33, "#FCA5A5", "Off course"],
    [0.335, 0.665, "#FCD34D", "At risk"],
    [0.67, 1, "#6EE7B7", "On course"],
  ];
  const [nx, ny] = pt(pos, R - 18);
  return (
    <svg viewBox={`0 0 ${W} 140`} className="block w-full" style={{ maxWidth: 260, margin: "0 auto" }}>
      {bands.map((b) => (
        <path key={b[3]} d={arc(b[0], b[1])} stroke={b[2]} strokeWidth={16} fill="none" />
      ))}
      {bands.map((b) => {
        const [x, y] = pt((b[0] + b[1]) / 2, R + 20);
        return (
          <text key={b[3]} x={x} y={y} textAnchor="middle" fontSize={9.5} fill="#6B7280">
            {b[3]}
          </text>
        );
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#1E1B2E" strokeWidth={3} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={6} fill="#1E1B2E" />
    </svg>
  );
}

function HomeMomentumCard({
  scenario,
  isTarget,
  min,
  max,
  series,
  momentum,
  hitIndexes,
  windowLabels,
  navigate,
}: {
  scenario: ScenarioLite;
  isTarget: boolean;
  min: number;
  max: number;
  series: number[];
  momentum: MomentumResult;
  hitIndexes: { id: string; name: string; index: number }[];
  windowLabels: string[];
  navigate: (p: string) => void;
}) {
  const W = 220;
  const H = 64;
  const x = (i: number) => 4 + i * ((W - 8) / (series.length - 1));
  const y = (v: number) => H - 6 - ((v - min) / (max - min || 1)) * (H - 12);
  const color = scenario.color ?? "#9CA3AF";
  return (
    <div
      className="min-w-0 cursor-pointer rounded-[10px] p-3"
      style={{ border: isTarget ? `1.5px solid ${color}` : "1px solid #E5E7EB" }}
      onClick={() => navigate("/monitoring")}
    >
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[13px] font-semibold">{scenario.name}</span>
        <span className="ml-auto text-xs font-semibold" style={{ color: momentum.score > 0 ? "#1E1B2E" : "#6B7280" }}>
          {momentum.label}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block w-full">
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="#E5E7EB" strokeDasharray="3 3" />
        <path
          d={`M${x(0)} ${y(0)} ` + series.map((v, i) => `L${x(i)} ${y(v)}`).join(" ") + ` L${x(series.length - 1)} ${y(0)} Z`}
          fill={color}
          fillOpacity={isTarget ? 0.16 : 0.08}
        />
        <polyline points={series.map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={color} strokeWidth={2} />
        {hitIndexes.map((hit) => (
          <g key={hit.id}>
            <title>{hit.name}</title>
            <rect
              x={x(hit.index) - 4}
              y={y(series[hit.index]) - 4}
              width={8}
              height={8}
              transform={`rotate(45 ${x(hit.index)} ${y(series[hit.index])})`}
              fill="#fff"
              stroke="#1E1B2E"
              strokeWidth={1.5}
            />
          </g>
        ))}
      </svg>
      <div className="mt-0.5 flex justify-between font-mono text-[10px] text-text-3">
        <span>{windowLabels[0]}</span>
        <span>{windowLabels[windowLabels.length - 1]}</span>
      </div>
    </div>
  );
}

function HomeDiverging({
  rows,
  navigate,
}: {
  rows: { t: TrackedEventRow; v: number; from: number; to: number }[];
  navigate: (p: string) => void;
}) {
  if (!rows.length) return <div className="text-[13px] text-muted-foreground">Nothing has moved yet.</div>;
  const max = Math.max(...rows.map((r) => Math.abs(r.v)), 1);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-3" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(140px,44%)" }}>
        <span />
        <div className="flex justify-between font-mono text-[10.5px] uppercase tracking-[0.06em] text-text-3">
          <span style={{ color: BAD }}>← Hurts target</span>
          <span style={{ color: GOOD }}>Helps →</span>
        </div>
      </div>
      {rows.map(({ t, v, from, to }) => (
        <div
          key={t.eventId}
          className="grid cursor-pointer items-center gap-3"
          style={{ gridTemplateColumns: "minmax(0,1fr) minmax(140px,44%)" }}
          onClick={() => navigate(`/monitoring?event=${t.eventId}`)}
        >
          <div className="min-w-0">
            <div className="text-[12.5px] font-medium leading-[1.35]">{t.title}</div>
            <div className="mt-0.5 font-mono text-[11px] text-text-3">
              {LIKELIHOOD_LEVELS[from]} → {LIKELIHOOD_LEVELS[to]}
            </div>
          </div>
          <div className="relative h-4">
            <div className="absolute -bottom-1 -top-1 left-1/2 w-px bg-[#D1D5DB]" />
            <div
              className="absolute top-0.5 h-3 rounded-[3px]"
              style={{ background: v > 0 ? GOOD : BAD, width: `${(Math.abs(v) / max) * 50}%`, [v > 0 ? "left" : "right"]: "50%" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function HomeSignposts({ scenarios, data, target }: { scenarios: ScenarioLite[]; data: NonNullable<ReturnType<typeof useDecisions>["data"]>; target: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      {scenarios.map((s) => {
        const prog = data.progressByScenario[s.id] ?? 0;
        const sps = data.signposts.filter((p) => p.scenario_id === s.id);
        return (
          <div key={s.id} className="grid items-center gap-3" style={{ gridTemplateColumns: "132px minmax(0,1fr) auto" }}>
            <div className="flex items-center gap-1.5 text-[12.5px]" style={{ fontWeight: s.id === target ? 600 : 500 }}>
              <span className="h-[7px] w-[7px] flex-shrink-0 rounded-full" style={{ background: s.color ?? "#9CA3AF" }} />
              {s.name}
            </div>
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
              {STORYLINE_PHASES.map((phase, i) => (
                <span key={phase} title={phase} className="h-2 rounded-sm" style={{ background: i < prog ? s.color ?? "#9CA3AF" : "#F3F4F6" }} />
              ))}
            </div>
            <div className="flex gap-1">
              {sps.map((p) => (
                <span
                  key={p.id}
                  title={`${p.name} · ${p.state ?? "not_yet"}`}
                  className="h-3 w-3 rounded-full"
                  style={{
                    border: `2px solid ${p.state === "not_yet" || !p.state ? "#E5E7EB" : s.color ?? "#9CA3AF"}`,
                    background: p.state === "hit" ? (s.color ?? "#9CA3AF") : p.state === "approaching" ? `linear-gradient(90deg, ${s.color ?? "#9CA3AF"} 50%, #fff 50%)` : "#fff",
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-3.5 border-t border-[#F3F4F6] pt-2.5 text-[11px] text-muted-foreground">
        <span>Bar: storyline phases reached</span>
        <span>● hit · ◐ approaching · ○ not yet</span>
      </div>
    </div>
  );
}

function HomeRouteMini({ route }: { route: RouteMoveRow[] }) {
  if (!route.length) return <div className="text-[12.5px] text-muted-foreground">No route drafted for this target yet.</div>;
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: "76px repeat(4,minmax(110px,1fr))", minWidth: 540 }}>
        <span />
        {ROUTE_HORIZONS.map((h) => (
          <span key={h} className="px-0.5 pb-1 font-mono text-[10.5px] text-text-3">
            {ROUTE_HORIZON_LABEL[h]}
          </span>
        ))}
        {ROUTE_LANES.map((lane) => (
          <React.Fragment key={lane.id}>
            <span className="pt-1.5 text-[11.5px] font-semibold text-[#374151]">{lane.name}</span>
            {ROUTE_HORIZONS.map((h) => (
              <div key={h} className="flex min-h-[28px] flex-col gap-0.5 rounded-md bg-[#FAFAFA] p-0.5">
                {route
                  .filter((m) => m.lane === lane.id && m.horizon === h)
                  .map((m) => {
                    const c = ROUTE_MOVE_STATUS_STYLE[m.status];
                    return (
                      <span
                        key={m.id}
                        title={`${m.title} · ${m.status}`}
                        className="overflow-hidden whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px]"
                        style={{ background: c.bg, color: c.fg, border: `1px ${m.status === "held" ? "dashed" : "solid"} ${c.fg}22`, textOverflow: "ellipsis" }}
                      >
                        {m.title}
                      </span>
                    );
                  })}
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2.5 text-[11px] text-muted-foreground">
        {Object.entries(ROUTE_MOVE_STATUS_STYLE).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1 capitalize">
            <span className="h-[9px] w-[9px] rounded-sm" style={{ background: c.bg, border: `1px solid ${c.fg}33` }} />
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

export function PageHomeV2() {
  const store = useStore();
  const navigate = useNavigate();
  const projectId = store.activeProjectId;
  const scenarios = React.useMemo(() => store.scenarios.filter((s) => !s.archived), [store.scenarios]);
  const scenariosLite: ScenarioLite[] = React.useMemo(() => scenarios.map((s) => ({ id: s.id, name: s.name, color: s.color })), [scenarios]);

  const { data, loading, actOnCard } = useDecisions(projectId);

  if (!projectId) return <div className="flex-1 p-5 text-sm text-muted-foreground">Select a project to see the CEO view.</div>;
  if (loading && !data) return <div className="flex-1 p-5 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="flex-1 p-5 text-sm text-muted-foreground">Couldn&apos;t load this view. Try reloading.</div>;

  if (!data.targetScenarioId) {
    return (
      <div className="scroll-y flex-1 overflow-y-auto" style={{ padding: "8px 24px 24px" }}>
        <div className="mx-auto flex flex-col gap-3.5" style={{ maxWidth: 1180 }}>
          <div className="rounded-[10px] border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
            Choose a target future in{" "}
            <button onClick={() => navigate("/strategy")} className="font-semibold text-brand-orange700 underline">
              Strategy
            </button>{" "}
            to see your route home.
          </div>
        </div>
      </div>
    );
  }

  const target = scenarios.find((s) => s.id === data.targetScenarioId) ?? null;
  if (!target) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">The chosen target future isn&apos;t available.</div>;
  }

  const health = data.healthByScenario[target.id];
  const toneColor = TONE_COLOR[health.tone];
  const leading = [...scenarios].sort((a, b) => (data.momentumByScenario[b.id]?.score ?? 0) - (data.momentumByScenario[a.id]?.score ?? 0))[0] ?? target;
  const pending = data.actions.filter((a) => a.status === "pending");

  const points = windowPoints();
  const windowLabels = points.map(formatShortDate);
  const histByEvent = new Map(data.tracked.map((t) => [t.eventId, buildHistFromHistory(t.history, points, t.currentLevel)]));

  const axisSeriesFor = (signalId: string): number[] => {
    const axisEvents = data.tracked.filter((t) => t.forceId === signalId);
    return points.map((_, i) =>
      compassPosition(axisEvents.map((t) => ({ impact: t.impact, level: histByEvent.get(t.eventId)![i], isPlusPole: t.side === "b" })))
    );
  };
  const trail = data.axes
    ? (() => {
        const xSeries = axisSeriesFor(data.axes!.xSignalId);
        const ySeries = axisSeriesFor(data.axes!.ySignalId);
        return points.map((_, i) => ({ x: xSeries[i], y: ySeries[i] }));
      })()
    : points.map(() => ({ x: 0, y: 0 }));

  const quadrantOf = (scenarioId: string): Quadrant => {
    if (!data.axes) return "TL";
    const supporting = data.tracked.filter((t) => t.supports.includes(scenarioId));
    const xv = compassPosition(supporting.filter((t) => t.forceId === data.axes!.xSignalId).map((t) => ({ impact: t.impact, level: t.currentLevel, isPlusPole: t.side === "b" })));
    const yv = compassPosition(supporting.filter((t) => t.forceId === data.axes!.ySignalId).map((t) => ({ impact: t.impact, level: t.currentLevel, isPlusPole: t.side === "b" })));
    return ((yv >= 0 ? "T" : "B") + (xv >= 0 ? "R" : "L")) as Quadrant;
  };

  const momentumSeriesFor = (scenarioId: string): number[] => {
    const supporting = data.tracked.filter((t) => t.supports.includes(scenarioId));
    return points.map((_, i) => supporting.reduce((sum, t) => sum + (histByEvent.get(t.eventId)![i] - histByEvent.get(t.eventId)![0]) * t.impact, 0));
  };
  const allSeries = scenarios.map((s) => momentumSeriesFor(s.id));
  const seriesMin = Math.min(0, ...allSeries.flat());
  const seriesMax = Math.max(0, ...allSeries.flat());

  const hitIndexesFor = (scenarioId: string) => {
    const sps = data.signposts.filter((p) => p.scenario_id === scenarioId && p.state === "hit" && p.hit_at);
    return sps.map((p) => {
      const hitTime = new Date(p.hit_at!).getTime();
      let bestIdx = 0;
      let bestDiff = Infinity;
      points.forEach((pt, i) => {
        const diff = Math.abs(pt.getTime() - hitTime);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      });
      return { id: p.id, name: p.name, index: bestIdx };
    });
  };

  const deltaOf = (t: TrackedEventRow) => {
    const h = histByEvent.get(t.eventId)!;
    return h[h.length - 1] - h[0];
  };
  const divergingRows = data.tracked
    .map((t) => {
      const h = histByEvent.get(t.eventId)!;
      const d = deltaOf(t);
      return { t, v: d * t.impact * (t.supports.includes(target.id) ? 1 : -1), from: h[0], to: h[h.length - 1] };
    })
    .filter((r) => r.v !== 0)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 6);

  const offCourse = [...health.weakening, ...health.blockersRising][0];

  return (
    <div className="scroll-y flex-1 overflow-y-auto" style={{ padding: "8px 24px 24px" }}>
      <div className="mx-auto flex flex-col gap-3.5" style={{ maxWidth: 1180 }}>
        {/* Headline */}
        <div className="flex flex-wrap items-end justify-between gap-3.5">
          <div className="min-w-0">
            <div className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-brand-orange">
              {store.project.name} · {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <h1 className="m-0 max-w-[760px] text-[26px] font-semibold leading-[1.25] tracking-[-0.02em] [text-wrap:pretty]">
              Evidence is building fastest toward {leading.name}. Your route to {target.name} is{" "}
              <span style={{ color: toneColor }}>{health.label.toLowerCase()}</span>.
            </h1>
            <div className="mt-1.5 text-[13px] text-muted-foreground">
              {pending.length} decision{pending.length === 1 ? "" : "s"} waiting
              {data.lastScan ? ` · last scan ${formatShortDate(data.lastScan.ran_at)} · ${data.lastScan.sources_scanned} sources` : " · first scan runs tonight"}
            </div>
          </div>
        </div>

        {/* Top row: compass + (gauge, decisions waiting) */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          <style>{`.hv-top{display:grid;grid-template-columns:minmax(0,1fr);gap:14px}@media(min-width:1100px){.hv-top{grid-template-columns:minmax(0,2fr) minmax(300px,1fr)}}`}</style>
          <div className="hv-top">
            <HomeCard
              title="Futures compass"
              sub="Where the balance of event likelihoods on your two axes sits now, and where it sat over the last 12 weeks. This shows the direction of the evidence, not a forecast."
            >
              {data.axes ? (
                <HomeCompass scenarios={scenariosLite} quadrantOf={quadrantOf} targetId={target.id} axes={data.axes} trail={trail} />
              ) : (
                <div className="py-8 text-center text-[13px] text-muted-foreground">Build your Matrix axes to see the compass.</div>
              )}
            </HomeCard>
            <div className="flex min-w-0 flex-col gap-3.5">
              <HomeCard
                title="Route health"
                sub={`Toward ${target.name}`}
                right={
                  <button onClick={() => navigate("/strategy")} className="text-[12.5px] font-medium text-muted-foreground hover:text-brand-dark">
                    Route
                  </button>
                }
              >
                <HomeGauge label={health.label} />
                <div className="-mt-1.5 text-center">
                  <div className="text-lg font-semibold" style={{ color: toneColor }}>
                    {health.label}
                  </div>
                  {offCourse && (
                    <div className="mt-1 text-xs leading-[1.45] text-[#4B5563]">
                      Pulling off course: {titleForTrackedEvent(data.tracked, offCourse.eventId)}
                    </div>
                  )}
                </div>
              </HomeCard>
              <HomeCard
                title="Decisions waiting"
                flex
                right={
                  <button onClick={() => navigate("/strategy")} className="text-[12.5px] font-medium text-muted-foreground hover:text-brand-dark">
                    All {pending.length}
                  </button>
                }
              >
                {pending.slice(0, 2).map((a) => (
                  <div key={a.id} className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-text-3">
                      <Icons.Bell size={11} /> Waiting {ageLabel(a.created_at)}
                    </div>
                    <DcActionCard
                      card={a}
                      status="pending"
                      compact
                      evidenceTitle={a.evidence_event_id ? titleForTrackedEvent(data.tracked, a.evidence_event_id) : null}
                      scenario={a.scenario_id ? scenariosLite.find((s) => s.id === a.scenario_id) ?? null : null}
                      onAct={(card, status) => actOnCard(card.id, status, store.user.id || null)}
                    />
                  </div>
                ))}
                {!pending.length && <div className="text-[13px] text-muted-foreground">Nothing waiting.</div>}
              </HomeCard>
            </div>
          </div>
        </div>

        {/* Scenario momentum */}
        <HomeCard
          title="Scenario momentum"
          sub="Change in supporting evidence over the last 12 weeks. ◆ marks a signpost that fired. Momentum is relative and never a probability — all four futures stay plausible."
          right={
            <button onClick={() => navigate("/monitoring")} className="text-[12.5px] font-medium text-muted-foreground hover:text-brand-dark">
              Monitoring
            </button>
          }
        >
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
            {[...scenarios]
              .sort((a, b) => (b.id === target.id ? 1 : 0) - (a.id === target.id ? 1 : 0))
              .map((s) => (
                <HomeMomentumCard
                  key={s.id}
                  scenario={scenariosLite.find((sl) => sl.id === s.id)!}
                  isTarget={s.id === target.id}
                  min={seriesMin}
                  max={seriesMax}
                  series={momentumSeriesFor(s.id)}
                  momentum={data.momentumByScenario[s.id]}
                  hitIndexes={hitIndexesFor(s.id)}
                  windowLabels={windowLabels}
                  navigate={navigate}
                />
              ))}
          </div>
        </HomeCard>

        {/* What moved + Signpost progress */}
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,400px),1fr))" }}>
          <HomeCard title="What moved" sub={`Event likelihood changes, weighted by impact, relative to ${target.name}.`}>
            <HomeDiverging rows={divergingRows} navigate={navigate} />
          </HomeCard>
          <HomeCard title="Signpost progress" sub="How far each future's storyline has advanced, and which of its signposts have fired.">
            <HomeSignposts scenarios={scenariosLite} data={data} target={target.id} />
          </HomeCard>
        </div>

        {/* Route to target (mini) */}
        <HomeCard
          title={`Route to ${target.name}`}
          sub="Moves in motion from now to 2030. Accepted decisions update this map."
          right={
            <button onClick={() => navigate("/strategy")} className="text-[12.5px] font-medium text-muted-foreground hover:text-brand-dark">
              Open Strategy
            </button>
          }
        >
          <HomeRouteMini route={data.route} />
        </HomeCard>
      </div>
    </div>
  );
}
