"use client";

// Event chains (design/futures_chains_handoff/) — one future at a time, walking back from the
// target year to today through a chain of causally linked events, rated likelihood × impact.
// Ported from the standalone's Bc2Chains/Bc2Rate/Bc2Plot/BcEventForm (bc2-chains.jsx) — same
// layout/copy, Tailwind utilities instead of inline styles/bespoke classes (this codebase's
// port convention), wired to real data via useFutures/useEventChain instead of window.BC/
// localStorage. Event timing is a real `year` int column, not the standalone's t (0-1)
// fraction — see backcast.ts's header comment.
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { useFutures, useEventChain } from "@/lib/use-futures";
import { ScenarioYearHeader } from "@/components/scenarios/scenario-year-header";
import { fmt, chainSize, chainEventScore, chainEventTier, LIKELIHOOD_LABELS, IMPACT_LABELS } from "@/lib/scenarios/backcast";
import type { ChainEventResult } from "@/lib/actions/ai-futures";

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
    <div className="grid grid-cols-[16px_minmax(0,1fr)] gap-1.5">
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

function EventForm({
  init,
  years,
  onSave,
  onCancel,
}: {
  init: ChainEventResult;
  years: number[];
  onSave: (e: ChainEventResult) => void;
  onCancel: () => void;
}) {
  const [f, setF] = React.useState(init);
  const ok = f.title.trim().length > 3;
  return (
    <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-[#FAFAFA] p-3">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2">
        <select className="rounded-md border border-border px-2 text-sm" value={f.year} onChange={(e) => setF({ ...f, year: +e.target.value })}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <input
          className="rounded-md border border-border px-2 text-sm"
          value={f.title}
          placeholder="What happened?"
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
      </div>
      <input
        className="rounded-md border border-border px-2 py-1.5 text-sm"
        value={f.why}
        placeholder="Why it had to happen before the next step"
        onChange={(e) => setF({ ...f, why: e.target.value })}
      />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2">
        <input
          className="rounded-md border border-border px-2 py-1.5 text-sm"
          value={f.forces.join(", ")}
          placeholder="Forces, comma separated"
          onChange={(e) => setF({ ...f, forces: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
        />
        <input
          className="rounded-md border border-border px-2 py-1.5 text-sm"
          value={f.indicator}
          placeholder="Early indicator to watch"
          onChange={(e) => setF({ ...f, indicator: e.target.value })}
        />
        <input
          className="rounded-md border border-border px-2 py-1.5 text-sm"
          value={f.threshold}
          placeholder="Counts as happened when…"
          onChange={(e) => setF({ ...f, threshold: e.target.value })}
        />
      </div>
      <div className="flex gap-1.5">
        <Button variant="primary" size="sm" disabled={!ok} onClick={() => onSave(f)}>
          Save event
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function PageChains() {
  const store = useStore();
  const navigate = useNavigate();
  const projectId = store.activeProjectId;
  const futures = useFutures(projectId);
  const { data } = futures;
  const [editing, setEditing] = React.useState<string | "new" | null>(null);

  const scenarios = data?.scenarios ?? [];
  const activeId = data?.chainScenarioId && scenarios.some((s) => s.id === data.chainScenarioId) ? data.chainScenarioId : scenarios[0]?.id ?? null;
  const i = Math.max(0, scenarios.findIndex((s) => s.id === activeId));
  const scenario = scenarios[i];
  const startYear = new Date().getFullYear();
  const targetYear = data?.targetYear ?? startYear;

  const { events, loading, generating, regenerate, save } = useEventChain(scenario?.id ?? null, startYear, targetYear);

  React.useEffect(() => {
    setEditing(null);
  }, [activeId]);

  if (!projectId || !data) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">{projectId ? "Loading…" : "No project selected."}</div>;
  }
  if (!scenario) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">No scenarios yet — build your scenario matrix first.</div>;
  }

  const goChain = (id: string) => futures.setChainScenario(id).catch((err) => console.error("[chains] failed to switch scenario", err));

  const evs = (events ?? []).slice().sort((a, b) => a.year - b.year);
  const yrs = Math.max(1, targetYear - startYear);
  const n = chainSize(yrs);
  const counts = new Map<number, number>();
  evs.forEach((e) => counts.set(e.year, (counts.get(e.year) ?? 0) + 1));
  const allYears: number[] = [];
  for (let y = startYear + 1; y <= targetYear; y++) allYears.push(y);
  const openYears = (own?: number) => allYears.filter((y) => (counts.get(y) ?? 0) < 3 || y === own);
  const rankedCount = evs.filter((e) => chainEventScore(e) > 0).length;
  const color = scenario.color ?? "#9CA3AF";

  const patch = (idx: number, p: Partial<ChainEventResult>) => save(evs.map((e, k) => (k === idx ? { ...e, ...p } : e)));
  const saveEvent = (f: ChainEventResult, idx: number | null) =>
    save(idx == null ? [...evs, f] : evs.map((e, k) => (k === idx ? f : e))).then(() => setEditing(null));
  const removeEvent = (idx: number) => save(evs.filter((_, k) => k !== idx));

  const top = evs
    .map((e, idx) => ({ e, idx }))
    .filter((x) => chainEventScore(x.e) > 0)
    .sort((a, b) => chainEventScore(b.e) - chainEventScore(a.e))
    .slice(0, 3);

  return (
    <div className="scroll-y flex flex-1 flex-col overflow-y-auto">
      <ScenarioYearHeader
        eyebrow={`Scenarios · step 2 of 2 · future ${i + 1} of ${scenarios.length}`}
        title={`How we got to ${targetYear}: ${scenario.name}`}
        year={targetYear}
        yearOptions={data.yearOptions}
        horizon={data.horizon}
        onYearChange={futures.setTargetYear}
        back={i > 0 ? { label: scenarios[i - 1].name, onClick: () => goChain(scenarios[i - 1].id) } : { label: "Futures", onClick: () => navigate("/futures") }}
        next={
          i < scenarios.length - 1
            ? { label: `Next future: ${scenarios[i + 1].name}`, onClick: () => goChain(scenarios[i + 1].id) }
            : { label: "Decide responses", onClick: () => navigate("/strategy") }
        }
      />

      <div className="flex flex-col gap-3.5 p-5">
        <div className="text-[12.5px] leading-[1.5] text-muted-foreground">
          One future at a time. Start at the postcard and walk back to today: each event made the next one possible. Rate every event on
          how likely it is and how much it would matter.
        </div>

        <div className="flex flex-wrap gap-1.5">
          {scenarios.map((s, k) => (
            <button
              key={s.id}
              onClick={() => goChain(s.id)}
              className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-left ${s.id === activeId ? "bg-white" : "bg-[#FAFAFA]"}`}
              style={{ borderColor: s.id === activeId ? s.color ?? "#9CA3AF" : "#E5E7EB" }}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: s.color ?? "#9CA3AF" }} />
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold text-brand-dark">
                  {k + 1}. {s.name}
                </span>
              </span>
            </button>
          ))}
        </div>

        {loading || generating ? (
          <div className="rounded-xl border border-border bg-white p-5 text-sm text-muted-foreground">
            {generating ? "Building this chain…" : "Loading…"}
          </div>
        ) : (
          <div className="grid grid-cols-[1fr_300px] gap-3.5 max-[900px]:grid-cols-1">
            <div className="rounded-xl border border-border bg-white p-[22px] pb-1.5">
              <div className="flex gap-3.5">
                <div className="w-[54px] flex-shrink-0 text-right text-[15px] font-bold" style={{ color }}>
                  {targetYear}
                </div>
                <div className="flex w-[22px] flex-shrink-0 justify-center">
                  <span className="mt-0.5 h-4 w-4 rounded-full" style={{ background: color }} />
                </div>
                <div className="min-w-0 pb-6">
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.07em]" style={{ color }}>
                    End state · {scenario.name}
                  </div>
                  <div className="mt-[3px] text-[16px] font-semibold text-brand-dark">
                    {scenario.postcard ? fmt(scenario.postcard.headline, targetYear, startYear) : scenario.tagline}
                  </div>
                </div>
              </div>

              {evs
                .map((e, idx) => ({ e, idx }))
                .reverse()
                .map(({ e, idx }) =>
                  editing === e.id ? (
                    <div key={e.id} className="pb-4 pl-[82px]">
                      <EventForm init={e} years={openYears(e.year)} onSave={(f) => saveEvent(f, idx)} onCancel={() => setEditing(null)} />
                    </div>
                  ) : (
                    <div key={e.id} className="flex gap-3.5">
                      <div className="w-[54px] flex-shrink-0 pt-0.5 text-right text-[13px] font-semibold text-[#374151]">{e.year}</div>
                      <div className="flex w-[22px] flex-shrink-0 justify-center">
                        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 bg-white text-[10.5px] font-bold" style={{ borderColor: color, color }}>
                          {idx + 1}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-[22px]">
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="pt-0.5 text-[14px] font-semibold leading-[1.35]">{e.title}</div>
                          <div className="flex flex-shrink-0 items-center gap-0.5">
                            <Button variant="ghost" size="sm" className="border-none px-[7px] py-[3px]" onClick={() => setEditing(e.id)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="border-none px-[7px] py-[3px] text-text-3" onClick={() => removeEvent(idx)}>
                              Remove
                            </Button>
                            <span
                              className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
                              style={{ background: chainEventTier(chainEventScore(e))[2], color: chainEventTier(chainEventScore(e))[1] }}
                            >
                              {chainEventTier(chainEventScore(e))[0]}
                              {chainEventScore(e) ? ` · ${chainEventScore(e)}` : ""}
                            </span>
                          </div>
                        </div>
                        {e.why && (
                          <div className="text-[12.5px] leading-[1.5] text-[#6B7280]">
                            <span className="text-text-3">Leads on because: </span>
                            {e.why}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-[5px]">
                          {e.forces.map((f) => (
                            <span key={f} className="whitespace-nowrap rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] text-[#374151]">
                              {f}
                            </span>
                          ))}
                        </div>
                        <div className="mt-0.5 flex flex-col gap-1 rounded-lg bg-[#FAFAFA] p-2.5">
                          <RatingButtons label="Likelihood" value={e.likelihood} names={LIKELIHOOD_LABELS} onChange={(v) => patch(idx, { likelihood: v })} />
                          <RatingButtons label="Impact" value={e.impact} names={IMPACT_LABELS} onChange={(v) => patch(idx, { impact: v })} />
                        </div>
                      </div>
                    </div>
                  )
                )}

              <div className="flex gap-3.5">
                <div className="w-[54px] flex-shrink-0 text-right text-[15px] font-bold">Now</div>
                <div className="flex w-[22px] flex-shrink-0 justify-center">
                  <span className="mt-[3px] h-3.5 w-3.5 rounded bg-brand-dark" />
                </div>
                <div className="pb-[22px]">
                  <div className="text-[15px] font-semibold">{startYear}: where you are today</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2 rounded-xl border border-border bg-white p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold">Chain length</span>
                  <span className="text-[13px] font-bold">
                    {evs.length} / {n}
                  </span>
                </div>
                <span className="text-xs leading-[1.5] text-[#6B7280]">
                  {n} events for a {yrs}-year horizon, never more than 3 in one year.
                </span>
                {evs.length < n && <span className="text-xs text-[#B45309]">{n - evs.length} missing.</span>}
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => regenerate()}>
                    {evs.length < n ? "Fill with AI" : "Rebuild with AI"}
                  </Button>
                  {editing !== "new" && evs.length < 3 * yrs && (
                    <Button variant="ghost" size="sm" onClick={() => setEditing("new")}>
                      + Add event
                    </Button>
                  )}
                </div>
                {editing === "new" && (
                  <EventForm
                    init={{
                      id: "new",
                      year: openYears()[0] ?? startYear + 1,
                      title: "",
                      why: "",
                      forces: [],
                      indicator: "",
                      threshold: "",
                      influence: "some",
                      likelihood: null,
                      impact: null,
                      createdBy: "user",
                    }}
                    years={openYears()}
                    onSave={(f) => saveEvent(f, null)}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </div>
              <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-white p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold">Likelihood × impact</span>
                  <span className="text-xs text-[#6B7280]">
                    {rankedCount} of {evs.length}
                  </span>
                </div>
                <LikelihoodImpactPlot events={evs} color={color} />
                {top.length > 0 && (
                  <div className="flex flex-col gap-1.5 border-t border-[#F3F4F6] pt-1">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-text-3">Top priorities</span>
                    {top.map(({ e, idx }) => (
                      <div key={idx} className="flex gap-2 text-[12.5px] leading-[1.4]">
                        <span className="font-bold" style={{ color }}>
                          {idx + 1}
                        </span>
                        <span className="flex-1">{e.title}</span>
                        <span className="font-semibold" style={{ color: chainEventTier(chainEventScore(e))[1] }}>
                          {chainEventScore(e)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
