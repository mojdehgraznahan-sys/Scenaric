"use client";

// Storyline (design/storyline_handoff/) — merges the old drag-and-drop Storyline page and
// Event chains into one: one future at a time, Today → one column per year → End state, read
// left to right. Ported from the standalone's StoryChain/ScForm/ScRate/ScPlot
// (Futures Storyline Standalone.html) — same layout, drag-and-drop, SVG arrow layers, and
// ResizeObserver geometry measuring, Tailwind utilities instead of inline styles (this
// codebase's established port convention). The grid's column widths are genuinely dynamic
// (repeat count depends on the horizon), so gridTemplateColumns stays an inline style — the
// one thing Tailwind's static classes can't express here.
import * as React from "react";
import { Button } from "@/components/ui/button";
import { chainEventScore, chainEventTier, LIKELIHOOD_LABELS, IMPACT_LABELS, MAX_PER_YEAR } from "@/lib/scenarios/backcast";
import type { ChainEventResult } from "@/lib/actions/ai-futures";

const SC_COL = 208;
const SC_GAP = 44;
const SC_NOW = 132;
const SC_END = 220;
const SC_INF: Record<"high" | "some" | "none", string> = { high: "You can shape this", some: "You can nudge this", none: "Outside your control" };

function sortSequence(evs: ChainEventResult[]): ChainEventResult[] {
  return [...evs].sort((a, b) => a.year - b.year || a.sort - b.sort);
}

function RatingButtons({ label, value, onChange, names }: { label: string; value: number | null; onChange: (v: number) => void; names: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-[66px] text-[11.5px] text-[#6B7280]">{label}</span>
      <div className="flex gap-[3px]">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            title={names[v - 1]}
            onClick={() => onChange(v)}
            className="h-6 w-[26px] rounded-md border text-[11.5px] font-semibold"
            style={{
              borderColor: value === v ? "#1E1B2E" : "#E5E7EB",
              background: value === v ? "#1E1B2E" : value && v < value ? "#E5E7EB" : "#fff",
              color: value === v ? "#fff" : "#6B7280",
            }}
          >
            {v}
          </button>
        ))}
      </div>
      <span className={`text-[11.5px] ${value ? "text-[#374151]" : "text-[#C4C4C4]"}`}>{value ? names[value - 1] : "—"}</span>
    </div>
  );
}

function LikelihoodImpactPlot({ events, color }: { events: ChainEventResult[]; color: string }) {
  const cells = new Map<string, number[]>();
  events.forEach((e, i) => {
    if (e.likelihood && e.impact) {
      const k = `${e.likelihood}-${e.impact}`;
      cells.set(k, [...(cells.get(k) ?? []), i + 1]);
    }
  });
  return (
    <div className="mx-auto grid w-full max-w-[300px] grid-cols-[16px_minmax(0,1fr)] gap-1.5">
      <div className="flex items-center justify-center text-center text-[10.5px] text-text-3 [writing-mode:vertical-rl]">Impact →</div>
      <div className="flex flex-col gap-1">
        <div className="grid aspect-square grid-cols-5 gap-0.5">
          {[5, 4, 3, 2, 1].flatMap((impact) =>
            [1, 2, 3, 4, 5].map((likelihood) => {
              const v = likelihood * impact;
              const n = cells.get(`${likelihood}-${impact}`) ?? [];
              return (
                <div
                  key={`${likelihood}-${impact}`}
                  className="flex flex-wrap items-center justify-center gap-0.5 rounded p-0.5"
                  style={{ background: v >= 15 ? "#FEF2F2" : v >= 8 ? "#FFFBEB" : "#F7F7F5" }}
                >
                  {n.map((k) => (
                    <span key={k} className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
                      {k}
                    </span>
                  ))}
                </div>
              );
            })
          )}
        </div>
        <div className="text-center text-[10.5px] text-text-3">Likelihood →</div>
      </div>
    </div>
  );
}

interface StoryFormInit {
  id: string;
  year: number;
  title: string;
  why: string;
  analog: string;
  forces: string[];
  indicator: string;
  threshold: string;
  influence: "high" | "some" | "none";
  likelihood: number | null;
  impact: number | null;
  createdBy: "ai" | "user";
  links: string[];
  sort: number;
}

function StoryForm({
  init,
  years,
  suggestions,
  isNew,
  onSave,
  onCancel,
}: {
  init: StoryFormInit;
  years: number[];
  suggestions: ChainEventResult[];
  isNew: boolean;
  onSave: (f: StoryFormInit) => void;
  onCancel: () => void;
}) {
  const [f, setF] = React.useState(init);
  const set = (p: Partial<StoryFormInit>) => setF((prev) => ({ ...prev, ...p }));
  const ok = f.title.trim().length >= 4;
  return (
    <div className="flex flex-col gap-2">
      {isNew && suggestions.length > 0 && (
        <div className="flex flex-col gap-1.5 pb-1.5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-text-3">Suggested for this future</span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((x) => (
              <button
                key={x.id}
                onClick={() => setF({ ...f, title: x.title, why: x.why, analog: x.analog, forces: x.forces, indicator: x.indicator, threshold: x.threshold, influence: x.influence })}
                className={`rounded-lg border px-2.5 py-[5px] text-left text-xs ${f.title === x.title ? "border-brand-dark bg-[#F3F4F6]" : "border-border bg-white"}`}
              >
                {x.title}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
        <select className="rounded-md border border-border px-2 text-sm" value={f.year} onChange={(e) => set({ year: +e.target.value })}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <input className="rounded-md border border-border px-2 py-1.5 text-sm" value={f.title} placeholder="What happens? Short, concrete, observable" onChange={(e) => set({ title: e.target.value })} />
      </div>
      <span className="text-[11.5px] font-medium text-[#6B7280]">Leads to the next event because…</span>
      <textarea className="rounded-md border border-border px-2 py-1.5 text-sm" rows={2} value={f.why} placeholder="Why this has to happen before the next step" onChange={(e) => set({ why: e.target.value })} />
      <span className="text-[11.5px] font-medium text-[#6B7280]">Seen before in</span>
      <input className="rounded-md border border-border px-2 py-1.5 text-sm" value={f.analog} placeholder="A precedent from another industry or region" onChange={(e) => set({ analog: e.target.value })} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2">
        <input
          className="rounded-md border border-border px-2 py-1.5 text-sm"
          value={f.forces.join(", ")}
          placeholder="Forces, comma separated"
          onChange={(e) => set({ forces: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
        />
        <input className="rounded-md border border-border px-2 py-1.5 text-sm" value={f.indicator} placeholder="Early indicator to watch" onChange={(e) => set({ indicator: e.target.value })} />
        <input className="rounded-md border border-border px-2 py-1.5 text-sm" value={f.threshold} placeholder="Counts as happened when…" onChange={(e) => set({ threshold: e.target.value })} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[11.5px] font-medium text-[#6B7280]">Can you influence it?</span>
        {(["high", "some", "none"] as const).map((k) => (
          <button
            key={k}
            onClick={() => set({ influence: k })}
            className={`rounded-[7px] border px-2.5 py-1 text-xs ${f.influence === k ? "border-brand-dark bg-brand-dark text-white" : "border-border bg-white text-[#374151]"}`}
          >
            {SC_INF[k]}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5 pt-0.5">
        <Button variant="primary" size="sm" disabled={!ok} onClick={() => onSave(f)}>
          {isNew ? "Add to chain" : "Save event"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function StoryChain({
  scenario,
  scenarios,
  startYear,
  targetYear,
  events,
  onSave,
  onRate,
  onRegenerate,
  onSwitchScenario,
  busy: generating,
}: {
  scenario: { id: string; name: string; color: string | null; tagline: string | null };
  scenarios: { id: string; name: string; color: string | null; desirability: number | null }[];
  startYear: number;
  targetYear: number;
  events: ChainEventResult[];
  onSave: (events: ChainEventResult[]) => Promise<void>;
  onRate: (eventId: string, patch: { likelihood?: number; impact?: number }) => void;
  onRegenerate: () => Promise<void>;
  onSwitchScenario: (id: string) => void;
  busy: boolean;
}) {
  const color = scenario.color ?? "#9CA3AF";
  const yrs = Math.max(1, targetYear - startYear);
  const evs = sortSequence(events);
  const years: number[] = [];
  for (let y = startYear + 1; y <= targetYear; y++) years.push(y);
  const byYear = new Map<number, ChainEventResult[]>(years.map((y) => [y, []]));
  evs.forEach((e) => byYear.get(e.year)?.push(e));
  const idx = new Map(evs.map((e, i) => [e.id, i]));

  const [sel, setSel] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<{ mode: "add" | "edit"; afterId: string | null; atEnd: boolean; init: StoryFormInit } | null>(null);
  const [drag, setDrag] = React.useState<string | null>(null);
  const [over, setOver] = React.useState<{ y: number; before?: string } | null>(null);
  const [linking, setLinking] = React.useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const refs = React.useRef<Record<string, HTMLElement | null>>({});
  const geoJson = React.useRef("");
  const [geo, setGeo] = React.useState<Record<string, { l: number; r: number; t: number; b: number; mx: number; my: number }>>({});
  const [, tick] = React.useState(0);

  React.useEffect(() => {
    setSel(null);
    setForm(null);
    setLinking(null);
  }, [scenario.id, targetYear]);
  React.useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 3200);
    return () => clearTimeout(t);
  }, [note]);
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLinking(null);
        setForm(null);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  React.useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(() => tick((x) => x + 1));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  // Deliberately no dependency array — must re-measure after ANY render that could move or
  // resize a card (new/removed event, reorder, year-count change), same as the standalone's
  // own useLayoutEffect(() => {...}) with no deps. The geoJson string-diff guard below is what
  // keeps this from looping: setGeo only fires when the measured geometry actually changed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    const w = wrapRef.current;
    if (!w) return;
    const R = w.getBoundingClientRect();
    const g: typeof geo = {};
    Object.entries(refs.current).forEach(([k, el]) => {
      if (!el || !el.isConnected) return;
      const r = el.getBoundingClientRect();
      const l = r.left - R.left,
        right = r.right - R.left,
        t = r.top - R.top,
        b = r.bottom - R.top;
      g[k] = { l, r: right, t, b, mx: (l + right) / 2, my: t + Math.min(34, (b - t) / 2) };
    });
    const j = JSON.stringify(g);
    if (j !== geoJson.current) {
      geoJson.current = j;
      setGeo(g);
    }
  });

  const save = (list: ChainEventResult[]) => onSave(sortSequence(list));
  const count = (y: number, except?: string) => (byYear.get(y) ?? []).filter((e) => e.id !== except).length;
  const full = (y: number) => setNote(`${y} already has ${MAX_PER_YEAR} events. Move one out first.`);
  const openYears = (own?: number) => years.filter((y) => count(y) < MAX_PER_YEAR || y === own);

  const moveTo = (id: string, year: number, beforeId: string | null) => {
    if (count(year, id) >= MAX_PER_YEAR) return full(year);
    const ev = evs.find((e) => e.id === id);
    if (!ev) return;
    const rest = evs.filter((e) => e.id !== id);
    const moved = { ...ev, year };
    let at = beforeId ? rest.findIndex((e) => e.id === beforeId) : -1;
    if (at < 0) {
      at = 0;
      rest.forEach((e, k) => {
        if (e.year <= year) at = k + 1;
      });
    }
    rest.splice(at, 0, moved);
    const later = new Set(rest.slice(rest.indexOf(moved) + 1).map((e) => e.id));
    save(
      rest.map((e) =>
        e.id === id ? { ...e, links: e.links.filter((l) => later.has(l)) } : later.has(id) ? e : { ...e, links: e.links.filter((l) => l !== id) }
      )
    );
  };

  const step = (id: string, dir: 1 | -1) => {
    const i = idx.get(id);
    if (i == null) return;
    const n = evs[i + dir];
    if (!n) return;
    const a = evs[i];
    const list = evs.slice();
    list[i] = { ...n, year: a.year, sort: a.sort };
    list[i + dir] = { ...a, year: n.year, sort: n.sort };
    save(list);
  };

  const del = (id: string) => {
    save(evs.filter((e) => e.id !== id).map((e) => ({ ...e, links: e.links.filter((l) => l !== id) })));
    setSel(null);
    setForm(null);
  };

  const insertAt = (afterId: string | null, ev: ChainEventResult) => {
    const list = evs.slice();
    const at = afterId ? (idx.get(afterId) ?? -1) + 1 : 0;
    list.splice(at, 0, ev);
    save(list);
    setSel(ev.id);
    setForm(null);
  };

  const blank = (year: number, afterId: string | null, atEnd: boolean): { afterId: string | null; atEnd: boolean; init: StoryFormInit } => ({
    afterId,
    atEnd,
    init: { id: `new-${Date.now()}`, year, title: "", why: "", analog: "", forces: [], indicator: "", threshold: "", influence: "some", likelihood: null, impact: null, createdBy: "user", links: [], sort: 0 },
  });

  const addIn = (year: number) => {
    if (count(year) >= MAX_PER_YEAR) return full(year);
    setSel(null);
    setLinking(null);
    const b = blank(year, null, true);
    setForm({ mode: "add", afterId: b.afterId, atEnd: b.atEnd, init: b.init });
  };

  const insertBetween = (a: string, b: string) => {
    const ya = a === "now" ? startYear + 1 : evs[idx.get(a) ?? -1]?.year ?? startYear + 1;
    const yb = b === "end" ? targetYear : evs[idx.get(b) ?? -1]?.year ?? targetYear;
    const cand = years.filter((y) => y >= ya && y <= yb && count(y) < MAX_PER_YEAR);
    if (!cand.length) return setNote(`No room between these two — every year in that stretch has ${MAX_PER_YEAR} events.`);
    const mid = (ya + yb) / 2;
    const y = cand.slice().sort((p, q) => Math.abs(p - mid) - Math.abs(q - mid))[0];
    setSel(null);
    setLinking(null);
    const blankForm = blank(y, a === "now" ? null : a, false);
    setForm({ mode: "add", afterId: blankForm.afterId, atEnd: blankForm.atEnd, init: blankForm.init });
  };

  const toggleLink = (fromId: string, toId: string) => {
    const e = evs[idx.get(fromId) ?? -1];
    if (!e) return;
    const L = e.links;
    save(evs.map((x) => (x.id === fromId ? { ...x, links: L.includes(toId) ? L.filter((v) => v !== toId) : [...L, toId] } : x)));
  };

  const gen = async () => {
    setSel(null);
    setForm(null);
    try {
      await onRegenerate();
    } catch {
      setNote("The AI couldn't rebuild this chain. Try again.");
    }
  };

  const seq = ["now", ...evs.map((e) => e.id), "end"];
  const seqEdges = seq.slice(1).map((b, k) => ({ a: seq[k], b, kind: "seq" as const }));
  const linkEdges: { a: string; b: string; kind: "link" }[] = [];
  evs.forEach((e) => e.links.forEach((l) => idx.has(l) && linkEdges.push({ a: e.id, b: l, kind: "link" })));

  const path = (ed: { a: string; b: string; kind: "seq" | "link" }) => {
    const A = geo[ed.a];
    const B = geo[ed.b];
    if (!A || !B) return null;
    if (Math.abs(A.l - B.l) < 4) {
      const x = A.mx;
      return { d: `M ${x} ${A.b + 2} L ${x} ${B.t - 7}`, mx: x, my: (A.b + B.t) / 2 };
    }
    const x1 = A.r + 2,
      y1 = A.my,
      x2 = B.l - 7,
      y2 = B.my;
    if (ed.kind === "link") {
      const lift = Math.min(A.t, B.t) - 18;
      return { d: `M ${A.mx} ${A.t} C ${A.mx} ${lift}, ${B.mx} ${lift}, ${B.mx} ${B.t - 7}`, mx: (A.mx + B.mx) / 2, my: lift };
    }
    const cx = (x1 + x2) / 2;
    return { d: `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`, mx: cx, my: (y1 + y2) / 2 };
  };

  const selEv = sel ? evs[idx.get(sel) ?? -1] : undefined;
  const editing = form?.mode === "edit";
  const suggestions: ChainEventResult[] = [];
  const rankedN = evs.filter((e) => chainEventScore(e) > 0).length;
  const top = evs
    .map((e, i) => ({ e, i }))
    .filter((x) => chainEventScore(x.e) > 0)
    .sort((a, b) => chainEventScore(b.e) - chainEventScore(a.e))
    .slice(0, 3);

  const card = (e: ChainEventResult) => {
    const i = idx.get(e.id) ?? -1;
    const tier = chainEventScore(e) ? chainEventTier(chainEventScore(e)) : null;
    const on = sel === e.id;
    const linkable = !!linking && (idx.get(linking) ?? -1) < i;
    const linked = !!linking && (evs[idx.get(linking) ?? -1]?.links ?? []).includes(e.id);
    return (
      <div
        key={e.id}
        ref={(el) => {
          refs.current[e.id] = el;
        }}
        draggable={!linking}
        onDragStart={(ev) => {
          ev.dataTransfer.effectAllowed = "move";
          ev.dataTransfer.setData("text/plain", e.id);
          setDrag(e.id);
        }}
        onDragEnd={() => {
          setDrag(null);
          setOver(null);
        }}
        onDragOver={(ev) => {
          if (drag && drag !== e.id) {
            ev.preventDefault();
            ev.stopPropagation();
            setOver({ y: e.year, before: e.id });
          }
        }}
        onDrop={(ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (drag && drag !== e.id) moveTo(drag, e.year, e.id);
          setDrag(null);
          setOver(null);
        }}
        onClick={() => {
          if (linking) {
            if (linkable) toggleLink(linking, e.id);
            return;
          }
          setSel(on ? null : e.id);
          setForm(null);
        }}
        className="relative flex select-none flex-col gap-[7px] rounded-[10px] bg-white p-[10px]"
        style={{
          cursor: linking ? (linkable ? "pointer" : "not-allowed") : "grab",
          border: on ? `1.5px solid ${color}` : linkable ? `1.5px dashed ${linked ? color : "#9CA3AF"}` : "1px solid #E5E7EB",
          boxShadow: on ? "0 6px 18px rgba(15,23,42,.10)" : "0 1px 2px rgba(15,23,42,.05)",
          opacity: drag === e.id ? 0.35 : linking && !linkable && linking !== e.id ? 0.45 : 1,
          outline: over?.before === e.id ? `2px solid ${color}` : "none",
          outlineOffset: 3,
        }}
      >
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold text-white" style={{ background: color }}>
            {i + 1}
          </span>
          {e.forces[0] && <span className="min-w-0 overflow-hidden truncate whitespace-nowrap rounded-full bg-[#F3F4F6] px-[7px] py-px text-[10.5px] text-[#374151]">{e.forces[0]}</span>}
          <span className="ml-auto flex-shrink-0">
            {tier ? (
              <span className="rounded-full px-[7px] py-px text-[10.5px] font-semibold" style={{ background: tier[2], color: tier[1] }}>
                {tier[0]} · {chainEventScore(e)}
              </span>
            ) : (
              <span className="text-[10.5px] text-[#B45309]">Rate</span>
            )}
          </span>
        </div>
        <div className="line-clamp-3 text-[13px] font-semibold leading-[1.35] text-brand-dark">{e.title}</div>
        {linked && (
          <span className="text-[11px] font-semibold" style={{ color }}>
            ✓ Linked
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3.5">
      <div className="text-[12.5px] leading-[1.5] text-muted-foreground">
        One future at a time, from today to {targetYear}. Each arrow means &ldquo;made the next one possible&rdquo;. Drag events to re-sequence
        them (up to {MAX_PER_YEAR} a year), hover an arrow to insert a step, and rate each event on likelihood and impact.
      </div>

      <div className="flex flex-wrap gap-1.5">
        {scenarios.map((s, k) => (
          <button
            key={s.id}
            onClick={() => onSwitchScenario(s.id)}
            className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-left ${s.id === scenario.id ? "bg-white" : "bg-[#FAFAFA]"}`}
            style={{ borderColor: s.id === scenario.id ? s.color ?? "#9CA3AF" : "#E5E7EB" }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.color ?? "#9CA3AF" }} />
            <span className="text-[13px] font-semibold text-brand-dark">
              {k + 1}. {s.name}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#F3F4F6] px-3.5 py-2.5">
          {linking ? (
            <>
              <span className="text-[12.5px] text-brand-dark">
                <b>Linking from event {(idx.get(linking) ?? 0) + 1}.</b> Click any later event it also leads to. Click again to unlink.
              </span>
              <Button variant="dark" size="sm" className="ml-auto" onClick={() => setLinking(null)}>
                Done linking
              </Button>
            </>
          ) : (
            <>
              <span className="text-[12.5px] text-[#374151]">
                <b>{evs.length}</b> events · {rankedN} rated
              </span>
              <span className="flex items-center gap-3 text-[11.5px] text-[#6B7280]">
                <span className="flex items-center gap-[5px]">
                  <svg width="22" height="8">
                    <line x1="0" y1="4" x2="22" y2="4" stroke={color} strokeWidth="2" />
                  </svg>
                  Leads to
                </span>
                <span className="flex items-center gap-[5px]">
                  <svg width="22" height="8">
                    <line x1="0" y1="4" x2="22" y2="4" stroke="#9CA3AF" strokeWidth="1.5" strokeDasharray="4 3" />
                  </svg>
                  Also leads to
                </span>
              </span>
              {note && <span className="text-xs text-[#B45309]">{note}</span>}
              <span className="ml-auto flex gap-1.5">
                <Button variant="ghost" size="sm" onClick={() => addIn(years.find((y) => count(y) < MAX_PER_YEAR) ?? targetYear)} disabled={evs.length >= MAX_PER_YEAR * yrs}>
                  + Add event
                </Button>
                <Button variant="ghost" size="sm" onClick={gen} disabled={generating}>
                  {generating ? "Rebuilding…" : "Rebuild with AI"}
                </Button>
              </span>
            </>
          )}
        </div>
        <div className="scroll-y overflow-x-auto bg-[#FAFAF9]">
          <div
            ref={wrapRef}
            className="relative grid"
            style={{ gridTemplateColumns: `${SC_NOW}px repeat(${yrs}, ${SC_COL}px) ${SC_END}px`, columnGap: SC_GAP, rowGap: 12, padding: "16px 22px 26px", width: "max-content", opacity: generating ? 0.45 : 1 }}
          >
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.07em] text-brand-dark">Today · {startYear}</div>
            {years.map((y) => (
              <div key={y} className="flex items-center gap-2">
                <span className="text-[13px] font-bold text-brand-dark">{y}</span>
                <span className="flex gap-[3px]">
                  {Array.from({ length: MAX_PER_YEAR }).map((_, k) => (
                    <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ background: k < (byYear.get(y)?.length ?? 0) ? color : "#E5E7EB" }} />
                  ))}
                </span>
              </div>
            ))}
            <div className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color }}>
              End state · {targetYear}
            </div>

            <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible" style={{ zIndex: 0 }}>
              <defs>
                <marker id="sc-ah-l" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0 0L10 5L0 10z" fill="#9CA3AF" />
                </marker>
              </defs>
              {linkEdges.map((ed) => {
                const p = path(ed);
                if (!p) return null;
                return (
                  <path
                    key={`l${ed.a}${ed.b}`}
                    d={p.d}
                    fill="none"
                    stroke={linking === ed.a || sel === ed.a ? color : "#9CA3AF"}
                    strokeWidth="1.5"
                    strokeDasharray="5 4"
                    markerEnd="url(#sc-ah-l)"
                  />
                );
              })}
            </svg>

            <div
              ref={(el) => {
                refs.current.now = el;
              }}
              className="relative z-[1] flex flex-col gap-1.5 self-start rounded-[10px] bg-brand-dark p-3 text-white"
            >
              <span className="text-[13px] font-semibold">Where you are</span>
            </div>
            {years.map((y) => {
              const list = byYear.get(y) ?? [];
              const room = list.filter((e) => e.id !== drag).length < MAX_PER_YEAR;
              const hot = over?.y === y;
              return (
                <div
                  key={y}
                  onDragOver={(ev) => {
                    if (!drag) return;
                    ev.preventDefault();
                    ev.dataTransfer.dropEffect = room ? "move" : "none";
                    if (!over || over.y !== y || over.before) setOver({ y });
                  }}
                  onDragLeave={(ev) => {
                    if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setOver((o) => (o && o.y === y ? null : o));
                  }}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    if (drag) moveTo(drag, y, null);
                    setDrag(null);
                    setOver(null);
                  }}
                  className="relative z-[1] flex flex-col gap-[26px] rounded-xl"
                  style={{
                    minHeight: 2 * 96 + 26,
                    outline: drag && hot ? `2px dashed ${room ? color : "#EF4444"}` : "none",
                    outlineOffset: 6,
                    background: drag && hot ? (room ? "rgba(255,255,255,.6)" : "#FEF2F2") : "transparent",
                  }}
                >
                  {list.map(card)}
                  {!drag && !linking && list.length < MAX_PER_YEAR && (
                    <button onClick={() => addIn(y)} className="rounded-[10px] border border-dashed border-[#D1D5DB] text-[12.5px] text-text-3" style={{ minHeight: list.length ? 44 : 96 }}>
                      + Add event
                    </button>
                  )}
                  {drag && hot && !room && <span className="text-center text-[11.5px] text-[#B91C1C]">{y} is full</span>}
                </div>
              );
            })}
            <div
              ref={(el) => {
                refs.current.end = el;
              }}
              className="relative z-[1] self-start overflow-hidden rounded-[10px] border-[1.5px] bg-white"
              style={{ borderColor: color }}
            >
              <div className="h-1" style={{ background: color }} />
              <div className="flex flex-col gap-[5px] p-[10px_12px_12px]">
                <span className="text-xs font-semibold" style={{ color }}>
                  {scenario.name}
                </span>
                <span className="text-sm font-semibold leading-[1.3]">{scenario.tagline}</span>
              </div>
            </div>

            <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible" style={{ zIndex: 2 }}>
              <defs>
                <marker id={`sc-ah-${scenario.id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0 0L10 5L0 10z" fill={color} />
                </marker>
                <marker id="sc-ah-hot" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0 0L10 5L0 10z" fill="#F97316" />
                </marker>
              </defs>
              {seqEdges.map((ed) => {
                const p = path(ed);
                if (!p) return null;
                const k = `${ed.a}>${ed.b}`;
                const hv = hoverEdge === k;
                return (
                  <g key={k}>
                    <path
                      d={p.d}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="18"
                      style={{ pointerEvents: drag || linking ? "none" : "stroke", cursor: "pointer" }}
                      onMouseEnter={() => setHoverEdge(k)}
                      onMouseLeave={() => setHoverEdge((h) => (h === k ? null : h))}
                    />
                    <path d={p.d} fill="none" stroke={hv ? "#F97316" : color} strokeWidth={hv ? 2.5 : 2} strokeOpacity={hv ? 1 : 0.85} markerEnd={`url(#${hv ? "sc-ah-hot" : `sc-ah-${scenario.id}`})`} />
                  </g>
                );
              })}
            </svg>
            {!drag &&
              !linking &&
              seqEdges.map((ed) => {
                const k = `${ed.a}>${ed.b}`;
                if (hoverEdge !== k) return null;
                const p = path(ed);
                if (!p) return null;
                return (
                  <button
                    key={`${k}+`}
                    title="Insert an event here"
                    onMouseEnter={() => setHoverEdge(k)}
                    onMouseLeave={() => setHoverEdge(null)}
                    onClick={() => {
                      setHoverEdge(null);
                      insertBetween(ed.a, ed.b);
                    }}
                    className="absolute z-[3] flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] border-brand-orange bg-white text-[15px] font-semibold leading-none text-brand-orange"
                    style={{ left: p.mx - 11, top: p.my - 11, boxShadow: "0 2px 8px rgba(249,115,22,.28)" }}
                  >
                    +
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_310px] items-start gap-3.5 max-[900px]:grid-cols-1">
        <div className="min-w-0 rounded-xl border border-border bg-white p-4">
          {form ? (
            <div className="flex flex-col gap-2.5">
              <span className="text-sm font-semibold">{editing ? `Edit event ${(idx.get(form.init.id) ?? 0) + 1}` : "New event"}</span>
              <StoryForm
                key={form.init.id}
                init={form.init}
                isNew={!editing}
                years={openYears(editing ? form.init.year : undefined)}
                suggestions={suggestions}
                onCancel={() => setForm(null)}
                onSave={(f) => {
                  const fe: ChainEventResult = { ...f };
                  if (editing) {
                    const old = evs[idx.get(f.id) ?? -1];
                    if (old && old.year !== f.year) {
                      if (count(f.year, f.id) >= MAX_PER_YEAR) return full(f.year);
                      const rest = evs.filter((e) => e.id !== f.id);
                      let at = 0;
                      rest.forEach((e, k) => {
                        if (e.year <= f.year) at = k + 1;
                      });
                      rest.splice(at, 0, fe);
                      save(rest);
                    } else {
                      save(evs.map((e) => (e.id === f.id ? fe : e)));
                    }
                    setForm(null);
                  } else {
                    const y = f.year;
                    if (count(y) >= MAX_PER_YEAR) return full(y);
                    const af = form.afterId ? evs[idx.get(form.afterId) ?? -1] : undefined;
                    let a: string | null = null;
                    evs.forEach((e) => {
                      if (af && e.year === y) {
                        if (e.id === af.id) a = af.id;
                      } else if (form.atEnd ? e.year <= y : e.year < y) {
                        a = e.id;
                      }
                    });
                    insertAt(a, fe);
                  }
                }}
              />
            </div>
          ) : selEv ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2.5">
                <div className="flex min-w-[300px] flex-1 flex-col gap-[3px]">
                  <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color }}>
                    Event {(idx.get(selEv.id) ?? 0) + 1} of {evs.length} · {selEv.year}
                  </span>
                  <span className="text-[17px] font-semibold leading-[1.3]">{selEv.title}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" disabled={idx.get(selEv.id) === 0} onClick={() => step(selEv.id, -1)} title="Swap with the previous event">
                    ← Earlier
                  </Button>
                  <Button variant="ghost" size="sm" disabled={idx.get(selEv.id) === evs.length - 1} onClick={() => step(selEv.id, 1)} title="Swap with the next event">
                    Later →
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setForm({ mode: "edit", afterId: null, atEnd: false, init: selEv })}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" disabled={idx.get(selEv.id) === evs.length - 1} onClick={() => setLinking(selEv.id)}>
                    Link
                  </Button>
                  <Button variant="ghost" size="sm" className="text-[#B91C1C]" onClick={() => del(selEv.id)}>
                    Remove
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
                <div className="flex flex-col gap-2.5">
                  {selEv.why && (
                    <div className="flex flex-col gap-[3px]">
                      <span className="text-[11.5px] font-medium text-[#6B7280]">
                        Leads to {idx.get(selEv.id) != null && idx.get(selEv.id)! + 1 < evs.length ? `event ${idx.get(selEv.id)! + 2}` : "the end state"} because
                      </span>
                      <span className="text-[13px] leading-[1.55] text-[#1F2937]">{selEv.why}</span>
                    </div>
                  )}
                  {selEv.analog && (
                    <div className="flex flex-col gap-[3px] rounded-lg bg-[#FAFAF9] p-[9px_11px]">
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-text-3">Seen before in</span>
                      <span className="text-[12.5px] leading-[1.5] text-[#374151]">{selEv.analog}</span>
                    </div>
                  )}
                  {selEv.links.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[11.5px] font-medium text-[#6B7280]">Also leads to</span>
                      {selEv.links.filter((l) => idx.has(l)).map((l) => (
                        <div key={l} className="flex items-center gap-1.5 text-[12.5px]">
                          <span className="font-bold" style={{ color }}>
                            {(idx.get(l) ?? 0) + 1}
                          </span>
                          <span className="flex-1">{evs[idx.get(l) ?? -1]?.title}</span>
                          <button onClick={() => toggleLink(selEv.id, l)} className="text-xs text-text-3">
                            Unlink
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap gap-[5px]">
                    {selEv.forces.map((f) => (
                      <span key={f} className="rounded-full bg-[#F3F4F6] px-2 py-[2px] text-[11px] text-[#374151]">
                        {f}
                      </span>
                    ))}
                    <span className="rounded-full px-2 py-[2px] text-[11px]" style={{ background: selEv.influence === "none" ? "#F3F4F6" : "#ECFDF5", color: selEv.influence === "none" ? "#6B7280" : "#047857" }}>
                      {SC_INF[selEv.influence]}
                    </span>
                  </div>
                  {selEv.indicator && (
                    <div className="text-[12.5px] leading-[1.5] text-[#374151]">
                      <span className="text-text-3">Watch: </span>
                      {selEv.indicator}
                      {selEv.threshold ? ` — counts when ${selEv.threshold.charAt(0).toLowerCase()}${selEv.threshold.slice(1)}` : ""}
                    </div>
                  )}
                  <div className="flex flex-col gap-1 rounded-lg bg-[#FAFAFA] p-[8px_10px]">
                    <RatingButtons label="Likelihood" value={selEv.likelihood} names={LIKELIHOOD_LABELS} onChange={(v) => onRate(selEv.id, { likelihood: v })} />
                    <RatingButtons label="Impact" value={selEv.impact} names={IMPACT_LABELS} onChange={(v) => onRate(selEv.id, { impact: v })} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 py-1.5">
              <span className="text-sm font-semibold">Select an event</span>
              <span className="text-[12.5px] leading-[1.5] text-muted-foreground">
                Click any card to see why it leads on, the precedent behind it, and to rate, edit, link or remove it. Drag cards between years to
                change the order; each year holds up to {MAX_PER_YEAR}.
              </span>
            </div>
          )}
        </div>
        <div className="sticky top-16 flex flex-col gap-2.5 rounded-xl border border-border bg-white p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold">Likelihood × impact</span>
            <span className="text-xs text-[#6B7280]">
              {rankedN} of {evs.length}
            </span>
          </div>
          <LikelihoodImpactPlot events={evs} color={color} />
          {top.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-[#F3F4F6] pt-1">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-text-3">Top priorities</span>
              {top.map(({ e, i }) => (
                <button
                  key={e.id}
                  onClick={() => {
                    setSel(e.id);
                    setForm(null);
                  }}
                  className="flex gap-2 text-left text-[12.5px] leading-[1.4] text-brand-dark"
                >
                  <span className="font-bold" style={{ color }}>
                    {i + 1}
                  </span>
                  <span className="flex-1">{e.title}</span>
                  <span className="font-semibold" style={{ color: chainEventTier(chainEventScore(e))[1] }}>
                    {chainEventScore(e)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
