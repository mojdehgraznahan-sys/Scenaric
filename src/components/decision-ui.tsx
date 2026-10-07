"use client";

// Shared decision-layer UI (design/2026-10-05/01-shared-decision-layer/PROMPTS.md, Prompt 4 —
// "Port components/decision-ui.jsx as-is... Swap only the data access, not the markup or the
// styles."). Ported from the reference HTML's DcSpark/DcTrend/DcScenarioDots/DcActionCard/
// DcBriefing block verbatim for markup/styling; data access is swapped from the mockup's
// globals (window.FM_DATA.scenarios, window.DecisionModel, window.FM_DECISIONS) to explicit
// props, so every id a caller passes in is already resolved to a name/color before it reaches
// here — this file never renders a raw id as a fallback.
//
// `dcAct` is NOT ported: the mockup's version mutated a localStorage-backed
// window.DecisionStore directly. The real equivalent is useDecisions(projectId).actOnCard,
// which a caller passes in as this file's `onAct` prop — DcActionCard itself stays agnostic
// to how accepting/deferring/dismissing a card is actually persisted.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/supabase/types";
import { LIKELIHOOD_LEVELS, type HealthResult, type LikelihoodLevel, type MomentumResult } from "@/lib/decision-model";
import type { HistoryEntry } from "@/lib/decision-tracking";
import type { DecisionsData } from "@/lib/actions/decisions";

export type ActionCardRow = Database["public"]["Tables"]["action_cards"]["Row"];

export interface ScenarioLite {
  id: string;
  name: string;
  color: string | null;
}

const dcMono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 11, color: "#9CA3AF", letterSpacing: ".02em" };

// The reference HTML's `.badge`/`.badge-high`/`.btn`/`.card` classes are mockup-only global
// CSS — this app's real styling moved those to Tailwind + the shared <Button> component
// (src/components/ui/button.tsx's own comment: "Variants reproduce the prototype's .btn-*
// styles exactly, now as Tailwind utilities") and hand-rolled badge classNames per component
// (e.g. page-monitoring.tsx's status pill), not a shared `.badge` class. DcBadge below follows
// that same hand-rolled convention rather than a nonexistent className.
function DcBadge({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

export function DcSpark({ hist, color }: { hist: LikelihoodLevel[]; color: string }) {
  const w = 84;
  const h = 22;
  const step = w / (hist.length - 1);
  const y = (v: number) => h - 2 - (v / 4) * (h - 4);
  let d = `M0 ${y(hist[0])}`;
  hist.forEach((v, i) => {
    if (i) d += ` H${i * step} V${y(v)}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }} aria-hidden="true">
      {[1, 2, 3].map((l) => (
        <line key={l} x1="0" x2={w} y1={y(l)} y2={y(l)} stroke="#F3F4F6" />
      ))}
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" />
      <circle cx={w - 1.5} cy={y(hist[hist.length - 1])} r="2.2" fill={color} />
    </svg>
  );
}

export function DcTrend({ hist }: { hist: LikelihoodLevel[] }) {
  const last = hist[hist.length - 1];
  const delta = last - hist[0];
  const occurredNow = last === 4 && hist[0] < 4;
  const tone = occurredNow
    ? { fg: "#1E1B2E", bg: "#F3F4F6", txt: "Occurred" }
    : delta > 0
      ? { fg: "#B45309", bg: "#FFFBEB", txt: "Rising" }
      : delta < 0
        ? { fg: "#1D4ED8", bg: "#EFF6FF", txt: "Falling" }
        : { fg: "#6B7280", bg: "#F9FAFB", txt: last === 4 ? "Occurred" : "Stable" };
  return <DcBadge bg={tone.bg} fg={tone.fg}>{tone.txt}</DcBadge>;
}

export function DcScenarioDots({ scenarioIds, targetId, scenarios }: { scenarioIds: string[]; targetId: string | null; scenarios: ScenarioLite[] }) {
  const byId = React.useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios]);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {scenarioIds.map((id) => {
        const s = byId.get(id);
        if (!s) return null;
        const isTarget = id === targetId;
        return (
          <span
            key={id}
            title={s.name}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: "#374151",
              padding: "2px 6px",
              borderRadius: 999,
              border: "1px solid " + (isTarget ? s.color ?? "#E5E7EB" : "#E5E7EB"),
              background: isTarget ? "#fff" : "#FAFAFA",
              fontWeight: isTarget ? 600 : 400,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: s.color ?? "#9CA3AF" }} />
            {s.name}
          </span>
        );
      })}
    </div>
  );
}

// Mockup's .badge-high/.badge-mid/.badge-low colors, inlined (see DcBadge above).
const dcUrgencyTone: Record<ActionCardRow["urgency"], { bg: string; fg: string }> = {
  urgent: { bg: "#FFF7ED", fg: "#C2410C" },
  high: { bg: "#FFFBEB", fg: "#B45309" },
  medium: { bg: "#ECFDF5", fg: "#065F46" },
};
const dcUrgencyLabel: Record<ActionCardRow["urgency"], string> = { urgent: "Urgent", high: "High", medium: "Medium" };
const dcAudienceLabel: Record<ActionCardRow["audience"], string> = { ceo: "CEO", cso: "CSO" };

export interface DcActionCardProps {
  card: ActionCardRow;
  status: ActionCardRow["status"];
  /** Already resolved — the evidence event/discovery's title, or null. Never a raw id. */
  evidenceTitle: string | null;
  scenario: ScenarioLite | null;
  onAct?: (card: ActionCardRow, status: ActionCardRow["status"]) => void;
  compact?: boolean;
}

export function DcActionCard({ card, status, evidenceTitle, scenario, onAct, compact }: DcActionCardProps) {
  const done = status !== "pending";
  return (
    <div
      style={{
        border: "1px solid #E5E7EB",
        borderRadius: 10,
        padding: 14,
        background: done ? "#FAFAFA" : "#fff",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: status === "dismissed" ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <DcBadge bg={dcUrgencyTone[card.urgency].bg} fg={dcUrgencyTone[card.urgency].fg}>
          {dcUrgencyLabel[card.urgency]}
        </DcBadge>
        <span style={dcMono}>{card.trigger_kind.replace(/_/g, " ")}</span>
        <span style={{ ...dcMono, marginLeft: "auto" }}>For {dcAudienceLabel[card.audience]}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1E1B2E", lineHeight: 1.35 }}>{card.title}</div>
      {!compact && <div style={{ fontSize: 12.5, color: "#4B5563", lineHeight: 1.55 }}>{card.body}</div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 11.5, color: "#6B7280" }}>
        {scenario && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: scenario.color ?? "#9CA3AF" }} />
            {scenario.name}
          </span>
        )}
        {evidenceTitle && <span>· Evidence: {evidenceTitle}</span>}
      </div>
      {onAct &&
        (done ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "#6B7280" }}>
            <span>{status === "accepted" ? "Accepted · added to route" : status === "deferred" ? "Deferred to next review" : "Dismissed"}</span>
            <Button variant="ghost" size="sm" onClick={() => onAct(card, "pending")}>
              Undo
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <Button variant="primary" size="sm" onClick={() => onAct(card, "accepted")}>
              Accept
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onAct(card, "deferred")}>
              Defer
            </Button>
            <Button variant="ghost" size="sm" className="border-none" onClick={() => onAct(card, "dismissed")}>
              Dismiss
            </Button>
          </div>
        ))}
    </div>
  );
}

export interface DcBriefingProps {
  onClose: () => void;
  projectName: string;
  data: DecisionsData;
  scenarios: ScenarioLite[];
}

// "What moved" needs each tracked event's single latest scan-driven change (cite/source/date)
// alongside how much it moved the target — resolved here from the already-fetched history
// array, not a second query.
function latestScanChange(history: HistoryEntry[]): HistoryEntry | null {
  const scanRows = history.filter((h) => h.changedBy === "scan");
  if (scanRows.length === 0) return null;
  return [...scanRows].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
}

export function DcBriefing({ onClose, projectName, data, scenarios }: DcBriefingProps) {
  const [audience, setAudience] = React.useState<"CEO" | "CSO">("CEO");
  const [sent, setSent] = React.useState(false);
  const scenarioById = React.useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios]);
  const target = data.targetScenarioId ? (scenarioById.get(data.targetScenarioId) ?? null) : null;
  const health: HealthResult | null = data.targetScenarioId ? data.healthByScenario[data.targetScenarioId] : null;

  const leading = [...scenarios].sort((a, b) => (data.momentumByScenario[b.id]?.score ?? 0) - (data.momentumByScenario[a.id]?.score ?? 0))[0] ?? null;

  const decisions = data.actions.filter((a) => a.status === "pending" && (audience === "CSO" || a.audience === "ceo"));

  // Sorted by |earliest-to-current level change| * impact — the same "biggest mover first"
  // ordering decision-model.ts's momentum() contrib list uses, computed here directly since a
  // briefing-wide "top movers" ranking isn't scoped to one scenario's supports.
  const movers = data.tracked
    .map((t) => ({ t, change: latestScanChange(t.history) }))
    .filter((x): x is { t: (typeof data.tracked)[number]; change: HistoryEntry } => x.change != null)
    .sort((a, b) => {
      const scoreFor = (x: typeof a) => Math.abs((x.t.currentLevel - (x.t.history[0]?.level ?? x.t.currentLevel)) * x.t.impact);
      return scoreFor(b) - scoreFor(a);
    })
    .slice(0, audience === "CEO" ? 3 : 6);

  const H = ({ children }: { children: React.ReactNode }) => <div style={{ ...dcMono, margin: "20px 0 8px", color: "#6B7280" }}>{children}</div>;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 100, display: "flex", justifyContent: "center", padding: "32px 20px", overflowY: "auto" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl border border-border bg-card shadow-card slide-up"
        style={{ maxWidth: 720, width: "100%", padding: 0, alignSelf: "flex-start" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", borderBottom: "1px solid #E5E7EB", flexWrap: "wrap" }}>
          <div style={{ display: "flex", border: "1px solid #E5E7EB", borderRadius: 8, overflow: "hidden" }}>
            {(["CEO", "CSO"] as const).map((x) => (
              <button
                key={x}
                onClick={() => setAudience(x)}
                style={{ border: "none", padding: "6px 12px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", background: audience === x ? "#1E1B2E" : "#fff", color: audience === x ? "#fff" : "#374151" }}
              >
                {x} brief
              </button>
            ))}
          </div>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>Auto-sent Mondays 07:00 · and when a signpost fires</span>
          <Button variant="primary" size="sm" style={{ marginLeft: "auto" }} onClick={() => setSent(true)}>
            {sent ? (
              <>
                <Icons.Check size={12} /> Sent
              </>
            ) : (
              "Send now"
            )}
          </Button>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#6B7280" }}>
            <Icons.X size={16} />
          </button>
        </div>
        <div style={{ padding: "24px 28px 28px" }}>
          <div style={dcMono}>{projectName}</div>
          <h2 style={{ margin: "6px 0 8px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", lineHeight: 1.25 }}>
            {target && health ? `Route to ${target.name} is ${health.label.toLowerCase()}.` : "No target future chosen yet."}
          </h2>
          {health && (health.weakening[0] || health.blockersRising[0]) && (
            <div style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, marginBottom: 4 }}>
              {health.weakening[0] && (
                <div>
                  <b>Weakened:</b> {resolveEvidenceTitleForEvent(data, health.weakening[0].eventId)}
                </div>
              )}
              {health.blockersRising[0] && (
                <div>
                  <b>Gaining against you:</b> {resolveEvidenceTitleForEvent(data, health.blockersRising[0].eventId)}
                </div>
              )}
            </div>
          )}
          <div style={{ fontSize: 13.5, color: "#4B5563", lineHeight: 1.6 }}>
            {leading && `Evidence is building fastest toward ${leading.name}. `}
            {decisions.length} decision{decisions.length === 1 ? "" : "s"} below.
          </div>
          <H>Decisions needed</H>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {decisions.length ? (
              decisions.map((a) => (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
                  <span style={{ alignSelf: "start", justifySelf: "start" }}>
                    <DcBadge bg={dcUrgencyTone[a.urgency].bg} fg={dcUrgencyTone[a.urgency].fg}>
                      {dcUrgencyLabel[a.urgency]}
                    </DcBadge>
                  </span>
                  <div>
                    <b>{a.title}.</b> <span style={{ color: "#4B5563" }}>{a.body}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 13, color: "#6B7280" }}>Nothing pending. All recommendations have been handled in Strategy.</div>
            )}
          </div>
          <H>What moved</H>
          {movers.map(({ t, change }) => (
            <div key={t.eventId} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: "8px 0", borderTop: "1px solid #F3F4F6", fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 500 }}>{t.title}</div>
                <div style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>
                  {change.cite} <i>({change.sourceTitle}, {new Date(change.observedAt).toLocaleDateString()})</i>
                </div>
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "#374151", whiteSpace: "nowrap" }}>
                {LIKELIHOOD_LEVELS[t.history[0]?.level ?? t.currentLevel]} → {LIKELIHOOD_LEVELS[t.currentLevel]}
              </div>
            </div>
          ))}
          <H>Scenario momentum</H>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8 }}>
            {scenarios.map((s) => {
              const m: MomentumResult | undefined = data.momentumByScenario[s.id];
              return (
                <div key={s.id} style={{ border: "1px solid " + (s.id === data.targetScenarioId ? s.color ?? "#E5E7EB" : "#E5E7EB"), borderRadius: 8, padding: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color ?? "#9CA3AF" }} />
                    {s.name}
                  </div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
                    {m?.label ?? "Steady"}
                    {s.id === data.targetScenarioId ? " · target" : ""}
                  </div>
                </div>
              );
            })}
          </div>
          {audience === "CSO" && data.revision && data.revision.status === "proposed" && (
            <>
              <H>Pending revision to strategy</H>
              {(data.revision.items as { kind: string; text: string }[]).map((r, i) => (
                <div key={i} style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 4 }}>
                  <b>{r.kind}:</b> {r.text}
                </div>
              ))}
            </>
          )}
          <div style={{ marginTop: 22, paddingTop: 12, borderTop: "1px solid #E5E7EB", fontSize: 11.5, color: "#9CA3AF", lineHeight: 1.5 }}>
            Momentum shows the relative evidence for each future. It is not a probability, and all four futures stay plausible. Every claim above cites the event or source behind it.
          </div>
        </div>
      </div>
    </div>
  );
}

function resolveEvidenceTitleForEvent(data: DecisionsData, eventId: string): string {
  return data.tracked.find((t) => t.eventId === eventId)?.title ?? "an untitled event";
}
