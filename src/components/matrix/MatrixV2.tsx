"use client";

// Matrix v2 — ported VERBATIM from design/handoff/2026-10-01/Matrix Standalone (offline).html
// (Prompt 4, CLAUDE_CODE_MATRIX_V2_PROMPTS.md). Forces are placed by answering two event-based
// questions; axes and worlds are labelled with real headlines. Store-agnostic: every prop is
// passed in, every mutation goes through `api`. Inline styles, "mx-*" class names and JSX
// structure are copied as-is — do not restyle, rename classes, or restructure markup here; this
// is the final, already-approved UI. The only changes from the standalone source are what the
// module system requires: TypeScript types, `import * as React`, and `export` instead of
// `Object.assign(window, ...)`.
//
// Data contract (unchanged from the standalone file):
//   force     { id, title, body, category, poles: [a, b], poleAliases? }
//   event     { id, title, status 'observed'|'possible', date, likelihood?, impact, wildcard?, precursor?, links: [{ sigId, side?, toward }] }
//   placement { sigId, x 0-100 (uncertainty, right = high), y 0-100 (impact, top = high), label?, impactAns? 'no'|'somewhat'|'completely',
//               plausible? 'both'|'a'|'b', confirmed: bool }        confirmed=false -> placed by the old star rating
//   axes      [sigId, sigId?]  axis 1 = horizontal, axis 2 = vertical
//   headlines { "<sigId>:a": eventId, ... }  chosen headline per axis end
// api (async): setPlacement(sigId, placement) · setAxes(ids) · setHeadline(sigId, side, eventId)
import * as React from "react";
import type { SteepCategory } from "@/lib/types";

export interface MxForce {
  id: string;
  title: string;
  body: string;
  category: SteepCategory;
  poles: [string, string];
  poleAliases?: Record<string, "a" | "b">;
}

export interface MxEventLink {
  sigId: string;
  side?: "a" | "b";
  toward?: string;
}

export interface MxEvent {
  id: string;
  title: string;
  body?: string;
  category: SteepCategory;
  status: "observed" | "possible";
  date: string;
  likelihood?: "Low" | "Medium" | "High" | null;
  impact?: number | null;
  wildcard?: boolean;
  precursor?: string | null;
  source?: string | null;
  indicatorId?: string | null;
  links: MxEventLink[];
}

export interface MxPlacement {
  sigId: string;
  x: number;
  y: number;
  label?: string;
  impactAns?: "no" | "somewhat" | "completely" | null;
  plausible?: "both" | "a" | "b" | null;
  confirmed: boolean;
}

export interface MxApi {
  // 3rd arg added post-port (Prompt 5: "Add an optional 3rd argument to setPlacement in the
  // host only") — MXAssess is the only place that knows which lead/A/B events were on screen
  // when the user answered, so it's the only place that can supply matrix_placements'
  // assessed_event_ids audit trail; the host's real implementation forwards it to place_force.
  setPlacement: (sigId: string, p: Partial<MxPlacement> & { sigId: string }, assessedEventIds?: string[]) => void | Promise<void>;
  setAxes: (ids: string[]) => void | Promise<void>;
  setHeadline: (sigId: string, side: "a" | "b", eventId: string) => void | Promise<void>;
}

export interface MatrixV2Props {
  signals: MxForce[];
  events: MxEvent[];
  placements: MxPlacement[];
  axes: string[];
  headlines: Record<string, string>;
  focal?: string;
  horizon?: string;
  api: MxApi;
  lockAxes?: boolean;
  onBuildScenarios?: () => void;
  buildLabel?: string;
  onReaxis?: () => void;
  onNavigate?: (path: string) => void;
  // Added post-port (not in the standalone file) for the host's /matrix?focus=<id> deep link
  // (Signals page's "+ Add to Matrix"). Only changes the initial selection on mount — everything
  // else about the component is unchanged from the verbatim port.
  initialSelected?: string;
}

const MX_CAT: Record<string, [string, string]> = { Social: ["#F5F3FF", "#8B5CF6"], Technology: ["#EFF6FF", "#3B82F6"], Economic: ["#ECFDF5", "#10B981"], Ecological: ["#F0FDFA", "#14B8A6"], Political: ["#FEF2F2", "#EF4444"] };

const MX_CSS = `
.mx-root{font-family:var(--font-sans,"Geist",ui-sans-serif,system-ui,sans-serif);color:#1E1B2E}
.mx-root a{color:#C2410C}.mx-root a:hover{color:#9A3412}
.mx-mono{font-family:var(--font-mono,"Geist Mono",ui-monospace,Menlo,monospace);letter-spacing:.06em}
.mx-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-radius:8px;font-family:inherit;font-size:12.5px;font-weight:500;line-height:1;padding:9px 13px;cursor:pointer;border:1px solid transparent;white-space:nowrap}
.mx-btn:disabled{opacity:.45;cursor:not-allowed}
.mx-btn-sm{padding:6px 10px;font-size:12px}
.mx-btn-primary{background:#F97316;color:#fff}.mx-btn-primary:hover:not(:disabled){background:#EA580C}
.mx-btn-ghost{background:#fff;color:#374151;border-color:#E5E7EB}.mx-btn-ghost:hover:not(:disabled){background:#F9FAFB}
.mx-btn-soft{background:#FFF7ED;color:#C2410C;border-color:#FED7AA}.mx-btn-soft:hover:not(:disabled){background:#FFEDD5}
.mx-link{background:none;border:none;padding:0;color:#C2410C;font-family:inherit;font-size:12px;font-weight:500;cursor:pointer}
.mx-link:hover{color:#9A3412;text-decoration:underline}
.mx-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:500;white-space:nowrap}
.mx-badge-High{background:#FFF7ED;color:#C2410C}.mx-badge-Medium{background:#FFFBEB;color:#B45309}.mx-badge-Low{background:#ECFDF5;color:#065F46}
.mx-seg{display:flex;padding:3px;background:#F3F4F6;border-radius:9px;gap:2px;flex-wrap:wrap}
.mx-seg button{flex:1;border:none;cursor:pointer;padding:7px 10px;border-radius:7px;font-family:inherit;font-size:12px;font-weight:500;background:transparent;color:#6B7280;white-space:nowrap}
.mx-seg button[aria-pressed="true"]{background:#fff;color:#1E1B2E;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.mx-card{background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:14px}
.mx-dot{transition:left .45s cubic-bezier(.2,.7,.2,1),top .45s cubic-bezier(.2,.7,.2,1)}
@media (prefers-reduced-motion: reduce){.mx-dot{transition:none}}
`;

function mxUseCss() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- verbatim name from the standalone file
  React.useEffect(() => {
    if (document.getElementById("mx-css")) return;
    const s = document.createElement("style");
    s.id = "mx-css";
    s.textContent = MX_CSS;
    document.head.appendChild(s);
  }, []);
}

const mxPole = (sig: MxForce | undefined, side: "a" | "b"): string => ((sig && sig.poles) || ["Low", "High"])[side === "a" ? 0 : 1];

function mxSide(sig: MxForce, link: MxEventLink): "a" | "b" {
  if (link.side) return link.side;
  const p = sig.poles || [],
    t = (link.toward || "").toLowerCase();
  if (p[0] && t === p[0].toLowerCase()) return "a";
  if (p[1] && t === p[1].toLowerCase()) return "b";
  if (sig.poleAliases && link.toward && sig.poleAliases[link.toward]) return sig.poleAliases[link.toward];
  return "b";
}

// Events usable as headlines: linked to the force, never wildcards (they sit off the matrix).
function mxEvents(sig: MxForce, events: MxEvent[], side?: "a" | "b"): MxEvent[] {
  const out = events.filter((e) => !e.wildcard && (e.links || []).some((l) => l.sigId === sig.id && (!side || mxSide(sig, l) === side)));
  return out.sort((x, y) => (y.impact || 0) - (x.impact || 0) || (x.status === "possible" ? -1 : 1));
}

const mxQuad = (p: { x: number; y: number } | null | undefined): "critical" | "predetermined" | "monitor" | "background" | null =>
  p ? (p.y < 50 ? (p.x > 50 ? "critical" : "predetermined") : p.x > 50 ? "monitor" : "background") : null;

const MX_Q = {
  critical: { label: "Critical uncertainty", bg: "#FFF7ED", fg: "#C2410C" },
  predetermined: { label: "Predetermined", bg: "#F5F3FF", fg: "#6D28D9" },
  monitor: { label: "Monitor", bg: "#EFF6FF", fg: "#1D4ED8" },
  background: { label: "Background", bg: "#F3F4F6", fg: "#4B5563" },
} as const;

const MX_IMPACT_Y: Record<"completely" | "somewhat" | "no", number> = { completely: 18, somewhat: 38, no: 72 };

function mxPlace(impactAns: "no" | "somewhat" | "completely", plausible: "both" | "a" | "b"): { x: number; y: number } {
  return { y: MX_IMPACT_Y[impactAns], x: plausible === "both" ? 74 : 24 };
}

function mxLabel(sig: MxForce, p?: MxPlacement): string {
  if (p && p.label) return p.label;
  const w = (sig.title || "").split(/\s+/).filter((x) => /^[A-Za-z]/.test(x) && x.length > 2);
  return (w[0] || sig.title || "?").slice(0, 3);
}

function MXChip({ cat, small }: { cat: SteepCategory; small?: boolean }) {
  const c = MX_CAT[cat] || ["#F3F4F6", "#6B7280"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: small ? "1px 7px" : "2px 9px", borderRadius: 999, background: c[0], color: c[1], border: `1px solid ${c[1]}40`, fontSize: small ? 10.5 : 11.5, fontWeight: 500, whiteSpace: "nowrap" }}>
      {cat}
    </span>
  );
}
function MXEvDot({ ev, size = 10 }: { ev: MxEvent; size?: number }) {
  const possible = ev.status === "possible";
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: 999, flexShrink: 0, boxSizing: "border-box", background: possible ? "#fff" : "#1E1B2E", border: possible ? "1.5px dashed #F97316" : "none" }}></span>;
}
function MXMeta({ ev }: { ev: MxEvent }) {
  const possible = ev.status === "possible";
  return (
    <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span className="mx-mono" style={{ fontSize: 9.5, color: "#9CA3AF" }}>
        {possible ? "COULD HAPPEN · " : "HAPPENED · "}
        {(ev.date || "").toUpperCase()}
      </span>
      {possible && ev.likelihood && (
        <span className={"mx-badge mx-badge-" + ev.likelihood} style={{ fontSize: 10, padding: "1px 6px" }}>
          {ev.likelihood}
        </span>
      )}
    </span>
  );
}
function MXSeg<V extends string>({ value, options, onChange }: { value: V | null; options: [V, string][]; onChange: (v: V) => void }) {
  return (
    <div className="mx-seg">
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}
function MXQBadge({ q }: { q: ReturnType<typeof mxQuad> }) {
  if (!q) return <span className="mx-badge" style={{ background: "#F3F4F6", color: "#6B7280" }}>Not placed</span>;
  return (
    <span className="mx-badge" style={{ background: MX_Q[q].bg, color: MX_Q[q].fg }}>
      {MX_Q[q].label}
    </span>
  );
}

// A headline card: one event, or an empty slot naming the pole.
function MXHeadline({ ev, pole, dir, onCycle, count, emptyText }: { ev?: MxEvent; pole: string; dir: "a" | "b"; onCycle?: () => void; count: number; emptyText?: string }) {
  return (
    <div style={{ border: ev ? "1px solid #E5E7EB" : "1px dashed #E5E7EB", background: "#fff", borderRadius: 10, padding: "10px 11px", display: "flex", flexDirection: "column", gap: 6, minWidth: 0, flex: 1 }}>
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "#374151" }}>
          {dir === "a" ? "← " : ""}
          {pole}
          {dir === "b" ? " →" : ""}
        </span>
        {ev && count > 1 && onCycle && (
          <button className="mx-link" style={{ fontSize: 11 }} onClick={onCycle} title="Show another event">
            Another ({count})
          </button>
        )}
      </span>
      {ev ? (
        <>
          <span style={{ display: "flex", gap: 7, alignItems: "flex-start" }}>
            <span style={{ paddingTop: 4, display: "flex" }}>
              <MXEvDot ev={ev}></MXEvDot>
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, textWrap: "pretty" }}>{ev.title}</span>
          </span>
          <MXMeta ev={ev}></MXMeta>
        </>
      ) : (
        <span style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.45 }}>{emptyText || "No event yet."}</span>
      )}
    </div>
  );
}

function MXPlot({ signals, placements, axes, selected, onSelect, horizon }: { signals: MxForce[]; placements: MxPlacement[]; axes: string[]; selected: string | null; onSelect: (id: string) => void; horizon?: string }) {
  const [hover, setHover] = React.useState<string | null>(null);
  const pos: Record<string, { x: number; y: number }> = {};
  const buckets: Record<string, MxPlacement[]> = {};
  placements.forEach((p) => {
    if (!p.confirmed) {
      pos[p.sigId] = { x: p.x, y: p.y };
      return;
    }
    const k = p.x + ":" + p.y;
    buckets[k] = buckets[k] || [];
    buckets[k].push(p);
  });
  const OFF = [
    [0, 0],
    [11, 7],
    [-11, 7],
    [6, -9],
    [-6, -9],
    [13, -3],
    [-13, -3],
    [0, 13],
  ];
  Object.values(buckets).forEach((list) =>
    list.forEach((p, i) => {
      const o = OFF[i % OFF.length];
      pos[p.sigId] = { x: Math.max(6, Math.min(94, p.x + o[0])), y: Math.max(6, Math.min(94, p.y + o[1])) };
    })
  );
  // Collision pass over all dots (confirmed first, then star-rated): nudge any dot within 7% of one already placed.
  const clamp = (v: number) => Math.max(6, Math.min(94, v));
  const order = [...placements.filter((p) => p.confirmed), ...placements.filter((p) => !p.confirmed)];
  const done: { x: number; y: number }[] = [];
  order.forEach((p) => {
    const base = pos[p.sigId];
    if (!base) return;
    const hits = (c: { x: number; y: number }) => done.some((q) => Math.abs(q.x - c.x) < 7 && Math.abs(q.y - c.y) < 7);
    let c = base;
    for (let i = 0; hits(c) && i < OFF.length * 2; i++) {
      const o = OFF[(i % (OFF.length - 1)) + 1],
        k = i < OFF.length - 1 ? 1 : 1.6;
      c = { x: clamp(base.x + o[0] * k), y: clamp(base.y + o[1] * k) };
    }
    pos[p.sigId] = c;
    done.push(c);
  });
  const quadCell = (q: "predetermined" | "critical" | "background" | "monitor", extra?: React.CSSProperties) => (
    <div style={{ background: q === "critical" ? "#FFF7ED" : "#FAFAF9", position: "relative", ...extra }}>
      <span className="mx-mono" style={{ position: "absolute", fontSize: 9.5, color: MX_Q[q].fg, top: 8, [q === "critical" || q === "monitor" ? "right" : "left"]: 10 }}>
        {MX_Q[q].label.toUpperCase()}
        {q === "critical" ? " ★" : ""}
      </span>
    </div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gridTemplateRows: "minmax(0,1fr) auto", gap: 6 }}>
      <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", textAlign: "center", fontSize: 10.5, color: "#6B7280" }} className="mx-mono">
        IMPACT ON YOUR DECISION →
      </div>
      <div style={{ position: "relative", aspectRatio: "1 / 0.82", borderRadius: 12, overflow: "hidden", border: "1px solid #E5E7EB", display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 1, background: "#E5E7EB" }}>
        {quadCell("predetermined")}
        {quadCell("critical")}
        {quadCell("background")}
        {quadCell("monitor")}
        {signals.map((s) => {
          const p = pos[s.id];
          if (!p) return null;
          const pl = placements.find((x) => x.sigId === s.id);
          if (!pl) return null;
          const c = (MX_CAT[s.category] || ["#F3F4F6", "#6B7280"])[1];
          const isAxis = axes.includes(s.id),
            isSel = selected === s.id;
          return (
            <button
              key={s.id}
              className="mx-dot"
              onClick={() => onSelect(s.id)}
              onMouseEnter={() => setHover(s.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.id)}
              onBlur={() => setHover(null)}
              aria-label={s.title}
              style={{
                position: "absolute",
                left: `calc(${p.x}% - 16px)`,
                top: `calc(${p.y}% - 16px)`,
                width: 32,
                height: 32,
                borderRadius: 999,
                padding: 0,
                cursor: "pointer",
                zIndex: isSel || hover === s.id ? 3 : 2,
                background: pl.confirmed ? c : "#fff",
                color: pl.confirmed ? "#fff" : c,
                border: pl.confirmed ? "2px solid #fff" : `1.5px dashed ${c}`,
                boxShadow: isSel ? "0 0 0 3px #F97316" : isAxis ? `0 0 0 3px #fff, 0 0 0 5px ${c}` : "0 1px 3px rgba(0,0,0,.15)",
                fontFamily: "var(--font-mono,monospace)",
                fontSize: 9.5,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {mxLabel(s, pl)}
              {hover === s.id && (
                <span style={{ position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)", background: "#1E1B2E", color: "#fff", fontFamily: "var(--font-sans,sans-serif)", fontSize: 12, fontWeight: 500, lineHeight: 1.35, padding: "7px 10px", borderRadius: 8, width: "max-content", maxWidth: 220, textAlign: "left", pointerEvents: "none", boxShadow: "0 6px 18px rgba(0,0,0,.2)" }}>
                  {s.title}
                  {!pl.confirmed && <span style={{ display: "block", color: "#FDBA74", fontSize: 11, marginTop: 3 }}>Placed by star rating. Confirm it.</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div></div>
      <div className="mx-mono" style={{ fontSize: 10.5, color: "#6B7280", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span>ONLY ONE OUTCOME PLAUSIBLE</span>
        <span>UNCERTAINTY BY {String(horizon || "").toUpperCase()} →</span>
        <span>BOTH PLAUSIBLE</span>
      </div>
    </div>
  );
}

// The two event questions that place a force.
function MXAssess({
  sig,
  events,
  placement,
  axes,
  horizon,
  lockAxes,
  api,
  onReaxis,
  onNavigate,
  signals,
}: {
  sig: MxForce;
  events: MxEvent[];
  placement?: MxPlacement;
  axes: string[];
  horizon?: string;
  lockAxes?: boolean;
  api: MxApi;
  onReaxis?: () => void;
  onNavigate?: (path: string) => void;
  signals: MxForce[];
}) {
  const all = mxEvents(sig, events);
  const A = mxEvents(sig, events, "a"),
    B = mxEvents(sig, events, "b");
  const [i0, setI0] = React.useState(0),
    [ia, setIa] = React.useState(0),
    [ib, setIb] = React.useState(0);
  const [impactAns, setImpactAns] = React.useState<"no" | "somewhat" | "completely" | null>(placement && placement.confirmed ? placement.impactAns ?? null : null);
  const [plausible, setPlausible] = React.useState<"both" | "a" | "b" | null>(placement && placement.confirmed ? placement.plausible ?? null : null);
  React.useEffect(() => {
    setI0(0);
    setIa(0);
    setIb(0);
    setImpactAns(placement && placement.confirmed ? placement.impactAns ?? null : null);
    setPlausible(placement && placement.confirmed ? placement.plausible ?? null : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig.id]);
  const lead = all[i0 % Math.max(1, all.length)];
  const evA = A[ia % Math.max(1, A.length)],
    evB = B[ib % Math.max(1, B.length)];
  const ready = !!impactAns && !!plausible;
  const q = ready ? mxQuad(mxPlace(impactAns!, plausible!)) : mxQuad(placement ?? null);
  const saved = !!placement && placement.confirmed && placement.impactAns === impactAns && placement.plausible === plausible;
  const place = () =>
    api.setPlacement(
      sig.id,
      { ...(placement || {}), sigId: sig.id, impactAns, plausible, confirmed: true, ...mxPlace(impactAns!, plausible!) },
      [lead?.id, evA?.id, evB?.id].filter((id): id is string => !!id)
    );
  const isAxis = axes.includes(sig.id);
  const settled = plausible && plausible !== "both" ? mxPole(sig, plausible) : null;
  const verdict = q
    ? {
        critical: `It matters, and both directions are plausible. It's a candidate scenario axis.`,
        predetermined: `"${settled || "One outcome"}" holds in every scenario. Build it into all four worlds rather than using it as an axis.`,
        monitor: `Both directions are plausible, but neither would change your decision. Keep watching it.`,
        background: `Settled and low impact. Background context for your scenarios.`,
      }[q]
    : "";
  const addLink = onNavigate ? (
    <button className="mx-link" onClick={() => onNavigate("/app/signals")}>
      Add events in Signals Library →
    </button>
  ) : null;
  const toggleAxis = (replaceId?: string) => {
    if (lockAxes && onReaxis) {
      onReaxis();
      return;
    }
    if (isAxis) api.setAxes(axes.filter((x) => x !== sig.id));
    else if (replaceId) api.setAxes(axes.map((x) => (x === replaceId ? sig.id : x)));
    else api.setAxes([...axes, sig.id].slice(0, 2));
  };
  const stepLab = (n: string, t: string) => (
    <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span className="mx-mono" style={{ fontSize: 10, color: "#F97316" }}>
        {n}
      </span>
      <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, textWrap: "pretty" }}>{t}</span>
    </span>
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <MXChip cat={sig.category}></MXChip>
          <MXQBadge q={mxQuad(placement ?? null)}></MXQBadge>
          {isAxis && (
            <span className="mx-badge" style={{ background: "#1E1B2E", color: "#fff" }}>
              Axis {axes.indexOf(sig.id) + 1}
            </span>
          )}
        </span>
        <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.01em" }}>{sig.title}</span>
        <span style={{ fontSize: 12, color: "#6B7280" }}>
          Can go two ways: <b style={{ color: "#1E1B2E", fontWeight: 600 }}>{mxPole(sig, "a")}</b> or <b style={{ color: "#1E1B2E", fontWeight: 600 }}>{mxPole(sig, "b")}</b>
        </span>
        {placement && !placement.confirmed && (
          <span style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "7px 9px", lineHeight: 1.45 }}>
            This was placed with a star rating. Answer the two questions below to place it by real events.
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stepLab("1", lead ? "If this happened tomorrow, would your decision change?" : `If this moved sharply toward "${mxPole(sig, "b")}", would your decision change?`)}
        {lead ? (
          <MXHeadline ev={lead} pole={mxPole(sig, mxSide(sig, lead.links.find((l) => l.sigId === sig.id)!))} dir={mxSide(sig, lead.links.find((l) => l.sigId === sig.id)!)} count={all.length} onCycle={() => setI0((i) => i + 1)}></MXHeadline>
        ) : (
          <span style={{ fontSize: 12, color: "#6B7280", display: "flex", gap: 8, flexWrap: "wrap" }}>No events on this force yet. {addLink}</span>
        )}
        <MXSeg
          value={impactAns}
          onChange={setImpactAns}
          options={[
            ["no", "No"],
            ["somewhat", "Somewhat"],
            ["completely", "Completely"],
          ]}
        ></MXSeg>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stepLab("2", `By ${horizon}, could you honestly picture either of these happening?`)}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <MXHeadline ev={evA} pole={mxPole(sig, "a")} dir="a" count={A.length} onCycle={() => setIa((i) => i + 1)} emptyText="No event pulling this way yet. Picture the force moving here."></MXHeadline>
          <MXHeadline ev={evB} pole={mxPole(sig, "b")} dir="b" count={B.length} onCycle={() => setIb((i) => i + 1)} emptyText="No event pulling this way yet. Picture the force moving here."></MXHeadline>
        </div>
        {(!A.length || !B.length) && addLink && <span style={{ fontSize: 11.5, color: "#6B7280" }}>One side has no events. {addLink}</span>}
        <MXSeg
          value={plausible}
          onChange={setPlausible}
          options={[
            ["both", "Yes, either"],
            ["a", "Only ← " + mxPole(sig, "a")],
            ["b", "Only " + mxPole(sig, "b") + " →"],
          ]}
        ></MXSeg>
      </div>

      {ready && q && (
        <div style={{ borderRadius: 10, padding: "11px 12px", background: MX_Q[q].bg, color: MX_Q[q].fg, fontSize: 12.5, lineHeight: 1.5, display: "flex", flexDirection: "column", gap: 10 }}>
          <span>
            <b>{MX_Q[q].label}.</b> {verdict}
          </span>
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="mx-btn mx-btn-primary mx-btn-sm" disabled={saved} onClick={place}>
              {saved ? "✓ Placed" : placement ? "Move on matrix" : "Place on matrix"}
            </button>
          </span>
        </div>
      )}

      {mxQuad(placement ?? null) === "critical" && (
        <div style={{ borderTop: "1px solid #F3F4F6", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {isAxis ? (
            <button className="mx-btn mx-btn-ghost mx-btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => toggleAxis()}>
              {lockAxes ? "Change axes…" : "Remove as axis"}
            </button>
          ) : axes.length < 2 ? (
            <button className="mx-btn mx-btn-soft mx-btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => toggleAxis()}>
              ★ Use as scenario axis
            </button>
          ) : (
            <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12, color: "#6B7280" }}>
              Use as axis instead of:
              {axes.map((id) => {
                const s = signals.find((x) => x.id === id);
                return s ? (
                  <button key={id} className="mx-btn mx-btn-ghost mx-btn-sm" onClick={() => toggleAxis(id)}>
                    {s.title}
                  </button>
                ) : null;
              })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function MXAxisCard({ n, sig, events, headlines, api, onNavigate }: { n: 1 | 2; sig?: MxForce; events: MxEvent[]; headlines: Record<string, string>; api: MxApi; onNavigate?: (path: string) => void }) {
  if (!sig)
    return (
      <div style={{ border: "1px dashed #E5E7EB", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <span className="mx-mono" style={{ fontSize: 10, color: "#9CA3AF" }}>
          AXIS {n} · {n === 1 ? "HORIZONTAL" : "VERTICAL"}
        </span>
        <span style={{ fontSize: 12.5, color: "#6B7280" }}>Pick a critical uncertainty from the top-right of the matrix.</span>
      </div>
    );
  const end = (side: "a" | "b") => {
    const list = mxEvents(sig, events, side);
    const chosen = list.find((e) => e.id === headlines[sig.id + ":" + side]) || list[0];
    const cycle = () => {
      const i = list.indexOf(chosen);
      const next = list[(i + 1) % list.length];
      if (next) api.setHeadline(sig.id, side, next.id);
    };
    return <MXHeadline ev={chosen} pole={mxPole(sig, side)} dir={side} count={list.length} onCycle={cycle} emptyText="No event yet. A world without a headline is hard to picture."></MXHeadline>;
  };
  return (
    <div className="mx-card" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="mx-mono" style={{ fontSize: 10, color: "#9CA3AF" }}>
          AXIS {n} · {n === 1 ? "HORIZONTAL" : "VERTICAL"}
        </span>
        <MXChip cat={sig.category} small></MXChip>
      </span>
      <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>{sig.title}</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {end("a")}
        {end("b")}
      </div>
      {(!mxEvents(sig, events, "a").length || !mxEvents(sig, events, "b").length) && onNavigate && (
        <button className="mx-link" style={{ alignSelf: "flex-start" }} onClick={() => onNavigate("/app/signals")}>
          Add events in Signals Library →
        </button>
      )}
    </div>
  );
}

// Four worlds: each quadrant's "front page" = the headline event at each of its two axis ends.
function MXWorlds({ x, y, events, headlines, onBuildScenarios, buildLabel }: { x: MxForce; y: MxForce; events: MxEvent[]; headlines: Record<string, string>; onBuildScenarios?: () => void; buildLabel?: string }) {
  const pick = (sig: MxForce, side: "a" | "b") => {
    const list = mxEvents(sig, events, side);
    return list.find((e) => e.id === headlines[sig.id + ":" + side]) || list[0];
  };
  const more = (sig: MxForce, side: "a" | "b", chosen?: MxEvent) => Math.max(0, mxEvents(sig, events, side).length - (chosen ? 1 : 0));
  const cell = (xs: "a" | "b", ys: "a" | "b") => {
    const hx = pick(x, xs),
      hy = pick(y, ys);
    const extra = more(x, xs, hx) + more(y, ys, hy);
    return (
      <div key={xs + ys} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 13, display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.3 }}>
          {mxPole(x, xs)} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>×</span> {mxPole(y, ys)}
        </span>
        <span className="mx-mono" style={{ fontSize: 9.5, color: "#9CA3AF" }}>
          FRONT PAGE
        </span>
        {[hx, hy].map((h, i) =>
          h ? (
            <span key={i} style={{ display: "flex", gap: 7, alignItems: "flex-start", borderTop: i ? "1px solid #F3F4F6" : "none", paddingTop: i ? 8 : 0 }}>
              <span style={{ paddingTop: 4, display: "flex" }}>
                <MXEvDot ev={h}></MXEvDot>
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35, textWrap: "pretty" }}>{h.title}</span>
                <MXMeta ev={h}></MXMeta>
              </span>
            </span>
          ) : (
            <span key={i} style={{ fontSize: 12, color: "#9CA3AF" }}>
              No headline for &quot;{mxPole(i ? y : x, i ? ys : xs)}&quot; yet.
            </span>
          )
        )}
        {extra > 0 && (
          <span style={{ fontSize: 11, color: "#6B7280" }}>
            +{extra} more {extra === 1 ? "event" : "events"} pulling this way
          </span>
        )}
      </div>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
        {cell("a", "b")}
        {cell("b", "b")}
        {cell("a", "a")}
        {cell("b", "a")}
      </div>
      {onBuildScenarios && (
        <button className="mx-btn mx-btn-primary" style={{ alignSelf: "flex-start" }} onClick={onBuildScenarios}>
          {buildLabel || "Build scenarios from these worlds →"}
        </button>
      )}
    </div>
  );
}

export function MatrixV2({ signals, events, placements, axes, headlines, focal, horizon, api, lockAxes, onBuildScenarios, buildLabel, onReaxis, onNavigate, initialSelected }: MatrixV2Props) {
  mxUseCss();
  const pBy = Object.fromEntries(placements.map((p) => [p.sigId, p]));
  const firstOpen = (placements.find((p) => !p.confirmed) || {}).sigId || (signals.find((s) => !pBy[s.id]) || {}).id;
  const validInitial = initialSelected && signals.some((s) => s.id === initialSelected) ? initialSelected : undefined;
  const [selected, setSelected] = React.useState<string | undefined>(validInitial || firstOpen || axes[0] || (signals[0] && signals[0].id));
  const sig = signals.find((s) => s.id === selected);
  const unconfirmed = signals.filter((s) => pBy[s.id] && !pBy[s.id].confirmed);
  const unplaced = signals.filter((s) => !pBy[s.id]);
  const predet = signals.filter((s) => mxQuad(pBy[s.id] ?? null) === "predetermined");
  const wild = events.filter((e) => e.wildcard);
  const ax = axes.map((id) => signals.find((s) => s.id === id)).filter((s): s is MxForce => !!s);
  const shared = ax.length === 2 ? events.filter((e) => !e.wildcard && ax.every((s) => (e.links || []).some((l) => l.sigId === s.id))) : [];
  const chipList = (list: MxForce[], tone: "dashed" | "solid") => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {list.map((s) => (
        <button key={s.id} onClick={() => setSelected(s.id)} style={{ border: `1px ${tone === "dashed" ? "dashed" : "solid"} ${selected === s.id ? "#F97316" : "#E5E7EB"}`, background: "#fff", borderRadius: 999, padding: "5px 10px", fontFamily: "inherit", fontSize: 12, cursor: "pointer", color: "#1E1B2E" }}>
          {s.title}
        </button>
      ))}
    </div>
  );
  return (
    <div className="mx-root" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, maxWidth: 680 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Impact × Uncertainty Matrix</h2>
          <div style={{ fontSize: 13, color: "#6B7280", marginTop: 3, textWrap: "pretty" }}>Place each force by judging real events against your decision. The two critical uncertainties become the axes of your scenarios.</div>
        </div>
        {lockAxes && onReaxis && (
          <button className="mx-btn mx-btn-ghost mx-btn-sm" onClick={onReaxis}>
            Change axes…
          </button>
        )}
      </div>
      {focal && (
        <div style={{ fontSize: 12.5, color: "#7C2D12", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 10, padding: "9px 12px", lineHeight: 1.5 }}>
          <span className="mx-mono" style={{ fontSize: 10, color: "#C2410C" }}>
            YOUR DECISION{" "}
          </span>
          {focal}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <MXPlot signals={signals} placements={placements} axes={axes} selected={selected ?? null} onSelect={setSelected} horizon={horizon}></MXPlot>
          <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: "#6B7280", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 12, height: 12, borderRadius: 999, background: "#6B7280" }}></span>Placed by events
            </span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 12, height: 12, borderRadius: 999, border: "1.5px dashed #6B7280", boxSizing: "border-box" }}></span>Placed by star rating — confirm
            </span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ width: 12, height: 12, borderRadius: 999, background: "#6B7280", boxShadow: "0 0 0 2px #fff, 0 0 0 3.5px #6B7280" }}></span>Scenario axis
            </span>
          </div>
          {unconfirmed.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>To confirm · {unconfirmed.length}</span>
              {chipList(unconfirmed, "dashed")}
            </div>
          )}
          {unplaced.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>Not on the matrix yet · {unplaced.length}</span>
              {chipList(unplaced, "dashed")}
            </div>
          )}
        </div>
        <div className="mx-card" style={{ flex: "1 1 330px", minWidth: 0, padding: 16 }}>
          {sig ? (
            <MXAssess key={sig.id} sig={sig} events={events} placement={pBy[sig.id]} axes={axes} horizon={horizon} lockAxes={lockAxes} api={api} onReaxis={onReaxis} onNavigate={onNavigate} signals={signals}></MXAssess>
          ) : (
            <span style={{ fontSize: 13, color: "#6B7280" }}>Select a force on the matrix.</span>
          )}
        </div>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #F3F4F6", paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>Scenario axes</span>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>Each end is named, and shown by a real event, so every world has a headline.</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 10 }}>
          <MXAxisCard n={1} sig={ax[0]} events={events} headlines={headlines} api={api} onNavigate={onNavigate}></MXAxisCard>
          <MXAxisCard n={2} sig={ax[1]} events={events} headlines={headlines} api={api} onNavigate={onNavigate}></MXAxisCard>
        </div>
        {shared.length > 0 && (
          <div style={{ fontSize: 12, color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}>
            {shared.length === 1 ? "One event pulls" : shared.length + " events pull"} on both axes ({shared.map((e) => e.title).join("; ")}). Check the two forces are independent. If they always move together, your four worlds collapse into two.
          </div>
        )}
      </section>

      {ax.length === 2 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap" }}>Four worlds</span>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>What the front page looks like in each. No world is more likely than another.</span>
          </div>
          <MXWorlds x={ax[0]} y={ax[1]} events={events} headlines={headlines} onBuildScenarios={onBuildScenarios} buildLabel={buildLabel}></MXWorlds>
        </section>
      )}

      {(predet.length > 0 || wild.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 10 }}>
          {predet.length > 0 && (
            <div className="mx-card" style={{ display: "flex", flexDirection: "column", gap: 8, background: "#FAF5FF", borderColor: "#E9D5FF" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#6D28D9" }}>Predetermined · holds in every world</span>
              {predet.map((s) => {
                const p = pBy[s.id];
                return (
                  <button key={s.id} onClick={() => setSelected(s.id)} style={{ textAlign: "left", background: "none", border: "none", borderTop: "1px solid #F3E8FF", padding: "7px 0 0", fontFamily: "inherit", cursor: "pointer", color: "#1E1B2E", display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s.title}</span>
                    <span style={{ fontSize: 11.5, color: "#6D28D9" }}>{p.confirmed && p.plausible && p.plausible !== "both" ? `Settled: ${mxPole(s, p.plausible)}` : "Placed by star rating. Confirm which way it's settled."}</span>
                  </button>
                );
              })}
            </div>
          )}
          {wild.length > 0 && (
            <div className="mx-card" style={{ display: "flex", flexDirection: "column", gap: 8, background: "#F5F3FF", borderColor: "#DDD6FE" }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#6D28D9" }}>Wildcards</span>
                <span className="mx-mono" style={{ fontSize: 9.5, color: "#7C3AED" }}>
                  NOT PLOTTED
                </span>
              </span>
              <span style={{ fontSize: 11.5, color: "#6D28D9", lineHeight: 1.45 }}>Events that would break the frame rather than move a force. Watched, never an axis.</span>
              {wild.map((e) => (
                <span key={e.id} style={{ borderTop: "1px solid #EDE9FE", paddingTop: 7, display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, lineHeight: 1.35 }}>{e.title}</span>
                  {e.precursor && <span style={{ fontSize: 11.5, color: "#6B7280" }}>Early sign: {e.precursor}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { mxPlace, mxQuad };
