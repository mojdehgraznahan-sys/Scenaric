"use client";

// Futures (design/futures_chains_handoff/) — AI writes four narrative "postcards" from the
// Knowledge Base, laid out on the 2x2 of critical uncertainties; each opens a full narrative
// reader. Ported from the standalone's Bc2Futures/Bc2Postcard/Bc2Desir/Bc2Generating/
// Bc2NarrativeReader (bc2-futures.jsx, bc2-narrative.jsx) — same layout/copy, Tailwind
// utilities instead of the standalone's inline styles/bespoke .bc2-* classes (this codebase's
// own convention for every handoff port, see globals.css's header comment), wired to real data
// via useFutures instead of the standalone's window.BC/localStorage HOST block.
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { useFutures } from "@/lib/use-futures";
import { ScenarioYearHeader } from "@/components/scenarios/scenario-year-header";
import { fmt, DESIR, GRID_ORDER } from "@/lib/scenarios/backcast";
import type { FuturesScenario } from "@/lib/actions/futures";

function DesirabilityPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const cur = DESIR.find((d) => d[0] === value);
  return (
    <div className="flex flex-col gap-[5px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-text-3">Desirability</span>
        <span className="text-xs font-semibold" style={{ color: cur ? cur[2] : "#B45309" }}>
          {cur ? cur[1] : "Not rated"}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-[3px]">
        {DESIR.map(([v, l, c]) => (
          <button
            key={v}
            title={l}
            onClick={() => onChange(v)}
            className="h-[26px] rounded-md text-[11.5px] font-semibold transition-colors"
            style={{
              background: value && v <= value ? (cur ? cur[2] : c) : "#F3F4F6",
              color: value && v <= value ? "#fff" : "#9CA3AF",
            }}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function YearStamp({ year, color }: { year: number; color: string }) {
  return (
    <div
      className="flex h-[58px] w-[52px] flex-shrink-0 flex-col items-center justify-center gap-px rounded border-2 border-dashed"
      style={{ borderColor: color, color }}
    >
      <span className="font-mono text-[9px] tracking-[0.08em]">FROM</span>
      <span className="text-[15px] font-bold">{year}</span>
    </div>
  );
}

function PostcardCard({
  scenario,
  year,
  startYear,
  rank,
  onOpen,
  onRegenerate,
  onRate,
  busy,
}: {
  scenario: FuturesScenario;
  year: number;
  startYear: number;
  rank: number | null;
  onOpen: () => void;
  onRegenerate: () => void;
  onRate: (v: number) => void;
  busy: boolean;
}) {
  const pc = scenario.postcard;
  const color = scenario.color ?? "#9CA3AF";
  return (
    <div className={`flex flex-col overflow-hidden rounded-[14px] border border-border bg-white transition-opacity ${busy ? "opacity-55" : ""}`}>
      <div className="h-1" style={{ background: color }} />
      <div className="flex flex-1 flex-col gap-2.5 p-[18px] pb-[14px] pt-4">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-brand-dark">{scenario.name}</span>
              {rank && <span className="rounded-full bg-brand-dark px-[7px] py-px text-[11px] font-bold text-white">#{rank}</span>}
            </div>
            <div className="mt-[3px] font-mono text-[10.5px] uppercase tracking-[0.07em] text-text-3">{scenario.tagline}</div>
          </div>
          <YearStamp year={year} color={color} />
        </div>
        {pc ? (
          <>
            <div className="text-xl font-semibold leading-tight tracking-[-0.015em] text-brand-dark">{fmt(pc.headline, year, startYear)}</div>
            <div className="line-clamp-4 text-[13.5px] leading-[1.6] text-[#374151]">{fmt(pc.story, year, startYear)}</div>
          </>
        ) : (
          <div className="text-[13px] text-muted-foreground">No postcard yet.</div>
        )}
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={onOpen} disabled={!pc}>
            Read narrative
          </Button>
          <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={busy}>
            {busy ? "Rewriting…" : "Regenerate"}
          </Button>
        </div>
      </div>
      <div className="border-t border-[#F3F4F6] bg-[#FCFCFB] p-[14px] pt-3">
        <DesirabilityPicker value={scenario.desirability} onChange={onRate} />
      </div>
    </div>
  );
}

function GeneratingScreen({ xLabel, yLabel, targetYear, holding }: { xLabel: string; yLabel: string; targetYear: number; holding: boolean }) {
  const steps = [
    "Reading your knowledge base for grounded signals",
    "Ranking driving forces by impact and uncertainty",
    `Confirming the two critical uncertainties: ${xLabel || "axis 1"} and ${yLabel || "axis 2"}`,
    `Writing four postcards from ${targetYear}`,
  ];
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (i >= steps.length - 1) return;
    const t = setTimeout(() => setI((v) => v + 1), 750);
    return () => clearTimeout(t);
  }, [i]);
  return (
    <div className="flex max-w-[640px] flex-col gap-3 rounded-xl border border-border bg-white p-7">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-brand-orange700">Building your futures</span>
      {steps.map((s, k) => (
        <div key={s} className={`flex items-center gap-2.5 text-sm transition-colors ${k <= i ? "text-brand-dark" : "text-[#C4C4C4]"}`}>
          <span
            className={`inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
              k < i ? "bg-[#ECFDF5] text-[#047857]" : k === i ? "bg-brand-orange text-white" : "bg-[#F3F4F6] text-white"
            }`}
          >
            {k < i ? "✓" : ""}
          </span>
          {s}
        </div>
      ))}
      {holding && <span className="pl-[26px] text-[12px] text-muted-foreground">Still writing — this can take a minute.</span>}
    </div>
  );
}

function NarrativeReader({
  scenarios,
  startId,
  year,
  startYear,
  companyName,
  onClose,
  onRate,
  onRegenerate,
  onSaveStory,
}: {
  scenarios: FuturesScenario[];
  startId: string;
  year: number;
  startYear: number;
  companyName: string;
  onClose: () => void;
  onRate: (scenarioId: string, v: number) => void;
  onRegenerate: (scenarioId: string) => Promise<void>;
  onSaveStory: (scenarioId: string, story: string[]) => Promise<void>;
}) {
  const [id, setId] = React.useState(startId);
  const [edit, setEdit] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const i = scenarios.findIndex((s) => s.id === id);
  const s = scenarios[i];
  const nar = s?.narrative;
  const [draft, setDraft] = React.useState(nar?.story.join("\n\n") ?? "");

  const go = (nid: string) => {
    setId(nid);
    setEdit(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };
  const regen = async () => {
    setBusy(true);
    try {
      await onRegenerate(id);
    } finally {
      setBusy(false);
    }
  };

  if (!s || !s.postcard || !nar) return null;
  const F = (t: string) => fmt(t, year, startYear);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[100] flex items-stretch justify-center bg-[rgba(30,27,46,0.4)] p-4 py-7">
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-[940px] flex-col overflow-hidden rounded-xl bg-white">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#F3F4F6] px-3 py-2.5">
          {scenarios.map((x) => (
            <button
              key={x.id}
              onClick={() => go(x.id)}
              className={`flex items-center gap-[7px] rounded-md px-[11px] py-1.5 text-[12.5px] ${
                x.id === id ? "bg-[#F3F4F6] font-semibold text-brand-dark" : "font-medium text-muted-foreground"
              }`}
            >
              <span className="h-2 w-2 rounded-sm" style={{ background: x.color ?? "#9CA3AF" }} />
              {x.name}
            </button>
          ))}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
            Close
          </Button>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="h-1" style={{ background: s.color ?? "#9CA3AF" }} />
          <div className="grid grid-cols-[minmax(0,1fr)_250px] gap-[30px] p-[26px] pb-[30px] pt-[26px] max-[760px]:grid-cols-1">
            <div className="flex min-w-0 flex-col gap-[18px]">
              <div className="flex flex-col gap-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.07em]" style={{ color: s.color ?? "#9CA3AF" }}>
                  Future {i + 1} of {scenarios.length} · {s.tagline}
                </span>
                <div className="text-[30px] font-semibold leading-[1.12] tracking-[-0.02em] text-brand-dark">
                  {s.name}: {F(s.postcard.headline)}
                </div>
              </div>
              {edit ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    className="min-h-[300px] rounded-md border border-border p-2.5 text-[14px] leading-[1.6]"
                    rows={14}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <span className="text-[12.5px] text-muted-foreground">Blank line between paragraphs. Use {"{Y}"} for the target year.</span>
                  <div className="flex gap-1.5">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        await onSaveStory(
                          id,
                          draft
                            .split(/\n\s*\n/)
                            .map((p) => p.trim())
                            .filter(Boolean)
                        );
                        setEdit(false);
                      }}
                    >
                      Save
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEdit(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={`flex flex-col gap-3.5 ${busy ? "opacity-50" : ""}`}>
                  {nar.story.map((p, k) => (
                    <p key={k} className="m-0 text-[16px] leading-[1.7] text-[#1F2937]">
                      {F(p)}
                    </p>
                  ))}
                </div>
              )}
              {!edit && (
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraft(nar.story.join("\n\n"));
                      setEdit(true);
                    }}
                  >
                    Edit narrative
                  </Button>
                  <Button variant="ghost" size="sm" onClick={regen} disabled={busy}>
                    {busy ? "Rewriting…" : "Regenerate"}
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-1 rounded-[10px] bg-[#FAFAF9] p-[14px_16px]">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.07em] text-text-3">A day in {year}</span>
                <div className="text-[14px] italic leading-[1.6] text-[#374151]">{F(s.postcard.day)}</div>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-semibold text-brand-dark">Who does what in {year}</span>
                <div className="grid grid-cols-3 gap-2.5 max-[760px]:grid-cols-1">
                  {nar.life.map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1 rounded-[10px] border border-[#F3F4F6] p-[12px_13px]">
                      <span className="text-xs font-semibold" style={{ color: s.color ?? "#9CA3AF" }}>
                        {k}
                      </span>
                      <span className="text-[13px] leading-[1.5] text-[#374151]">{F(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-semibold text-brand-dark">What it means for {companyName}</span>
                <div className="text-sm leading-[1.6] text-[#374151]">{F(s.postcard.us)}</div>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    ["up", "Opportunities", "#047857", nar.usUp],
                    ["down", "Threats", "#B91C1C", nar.usDown],
                  ] as const).map(([k, l, c, items]) => (
                    <div key={k} className="flex flex-col gap-1.5">
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.07em]" style={{ color: c }}>
                        {l}
                      </span>
                      {items.map((x) => (
                        <div key={x} className="border-l-2 pl-2.5 text-[13px] leading-[1.45] text-[#374151]" style={{ borderColor: c }}>
                          {F(x)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              <DesirabilityPicker value={s.desirability} onChange={(v) => onRate(id, v)} />
              {s.earlySigns.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold text-brand-dark">Early signs, today</span>
                  {s.earlySigns.map((title) => (
                    <div key={title} className="border-l-2 border-[#E5E7EB] pl-2.5 text-[12.5px] leading-[1.45] text-[#374151]">
                      {title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex justify-between border-t border-[#F3F4F6] px-3.5 py-2.5">
          {i > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => go(scenarios[i - 1].id)}>
              ← {scenarios[i - 1].name}
            </Button>
          ) : (
            <span />
          )}
          {i < scenarios.length - 1 ? (
            <Button variant="primary" size="sm" onClick={() => go(scenarios[i + 1].id)}>
              Next: {scenarios[i + 1].name} →
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={onClose}>
              Done reading
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PageFutures() {
  const store = useStore();
  const navigate = useNavigate();
  const projectId = store.activeProjectId;
  const { data, loading, generating, regenerateAll, setTargetYear, rate, regeneratePostcard, regenerateNarrative, saveNarrativeStory } = useFutures(projectId);
  const [open, setOpen] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const triedGenerateRef = React.useRef(false);

  React.useEffect(() => {
    triedGenerateRef.current = false;
  }, [projectId]);

  React.useEffect(() => {
    if (!data || data.generated || generating || triedGenerateRef.current) return;
    triedGenerateRef.current = true;
    regenerateAll().catch((err) => console.error("[futures] failed to generate", err));
  }, [data, generating, regenerateAll]);

  if (!projectId || loading && !data) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">Loading…</div>;
  }
  if (!data) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">No project selected.</div>;
  }

  const startYear = new Date().getFullYear();
  const byId = new Map(data.scenarios.map((s) => [s.id, s]));
  const ranked = data.scenarios.filter((s) => s.desirability != null).sort((a, b) => (b.desirability ?? 0) - (a.desirability ?? 0));
  const rankOf = (id: string) => {
    const s = byId.get(id);
    if (!s || s.desirability == null) return null;
    return ranked.filter((r) => (r.desirability ?? 0) > (s.desirability ?? 0)).length + 1;
  };
  const unrated = data.scenarios.length - ranked.length;
  const allGenerated = data.scenarios.every((s) => !!s.postcard);
  const firstScenario = data.scenarios[0];

  const regen = async (scenarioId: string) => {
    setBusyId(scenarioId);
    try {
      await regeneratePostcard(scenarioId);
    } catch (err) {
      console.error("[futures] failed to regenerate postcard", err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="scroll-y flex flex-1 flex-col overflow-y-auto">
      <ScenarioYearHeader
        eyebrow="Scenarios · step 1 of 2"
        title={`Four futures from ${data.targetYear}`}
        sub={data.focalQuestion}
        year={data.targetYear}
        yearOptions={data.yearOptions}
        horizon={data.horizon}
        onYearChange={setTargetYear}
        back={null}
        next={
          allGenerated && firstScenario
            ? { label: `Walk back from ${data.targetYear}`, onClick: () => navigate("/chains") }
            : null
        }
      />
      <div className="flex flex-1 flex-col gap-3.5 p-5">
        {!allGenerated || generating ? (
          <GeneratingScreen
            xLabel={firstScenario?.xLabel ?? ""}
            yLabel={firstScenario?.yLabel ?? ""}
            targetYear={data.targetYear}
            holding={generating}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="max-w-[680px] text-[12.5px] leading-[1.5] text-muted-foreground">
                Four plausible futures, written from {data.targetYear} using what&apos;s in your knowledge base. Read each one and rate
                how much you&apos;d want it. Your ratings decide what you&apos;ll try to make happen and what you&apos;ll try to prevent.
              </div>
              <div className="flex items-center gap-2">
                {unrated > 0 ? (
                  <span className="text-xs text-[#B45309]">{unrated} to rate</span>
                ) : (
                  <span className="text-xs text-[#047857]">All rated</span>
                )}
                <Button variant="ghost" size="sm" onClick={() => setOpen(firstScenario.id)}>
                  Read all narratives
                </Button>
                <Button variant="ghost" size="sm" onClick={() => regenerateAll()} disabled={generating}>
                  Regenerate all
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              {GRID_ORDER.map((q) => {
                const s = data.scenarios.find((sc) => sc.quadrant === q);
                if (!s) return null;
                return (
                  <PostcardCard
                    key={s.id}
                    scenario={s}
                    year={data.targetYear}
                    startYear={startYear}
                    rank={rankOf(s.id)}
                    onOpen={() => setOpen(s.id)}
                    onRegenerate={() => regen(s.id)}
                    onRate={(v) => rate(s.id, v)}
                    busy={busyId === s.id}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {open && (
        <NarrativeReader
          scenarios={data.scenarios}
          startId={open}
          year={data.targetYear}
          startYear={startYear}
          companyName={data.companyName}
          onClose={() => setOpen(null)}
          onRate={rate}
          onRegenerate={regenerateNarrative}
          onSaveStory={saveNarrativeStory}
        />
      )}
    </div>
  );
}
