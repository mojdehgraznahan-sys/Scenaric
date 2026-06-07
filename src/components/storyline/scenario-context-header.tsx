"use client";

// Scenario family — shared context header for Storyline / Narrative.
// Scenario picker (dropdown) • view name + tagline. Faithful port of
// scenario-view-switcher.jsx (the ⌘1/2/3 shortcuts live in the AppShell).
import * as React from "react";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useStore, usePersistentState } from "@/lib/store";

const SCENARIO_VIEWS = [
  { id: "matrix", view: "Matrix view" },
  { id: "storyline", view: "Storyline view" },
  { id: "narrative", view: "Narrative view" },
];

const SCENARIO_TAGLINES: Record<string, string> = {
  sc1: "How open markets + aligned geopolitics produce the best-case future for SEA expansion.",
  sc2: "Markets stay open but politics atomise — speed and modularity beat scale.",
  sc3: "Geopolitical détente but rising protectionism — local-for-local becomes mandatory.",
  sc4: "Worst case: blocs harden and decoupling accelerates — preserve optionality.",
};

export function ScenarioContextHeader({ view }: { view: string }) {
  const store = useStore();
  const scenarios = store.scenarios || [];
  const [scenarioId, setScenarioId] = usePersistentState<string>(
    "fm.storylineScenario",
    (scenarios[0] && scenarios[0].id) || "sc1"
  );
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const v = SCENARIO_VIEWS.find((x) => x.id === view);
  const viewName = v ? v.view : "";

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!scenario) return null;
  const tagline = SCENARIO_TAGLINES[scenario.id] || scenario.summary || scenario.tagline || "";

  return (
    <div className="py-5">
      {/* Line 1 — scenario (dropdown trigger) • view */}
      <div className="flex flex-wrap items-center">
        <div ref={ref} className="relative inline-flex items-center">
          <button
            onClick={() => setOpen((o) => !o)}
            title="Switch scenario"
            className="inline-flex items-center rounded-md border-0 bg-transparent p-0"
          >
            <span className="mr-2 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: scenario.color }} />
            <span className="text-xl font-semibold tracking-[-0.015em] text-brand-dark">{scenario.name}</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ml-[5px]">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {open && (
            <div className="slide-up absolute left-0 top-[calc(100%+6px)] z-[60] w-[300px] rounded-[10px] border border-border bg-white p-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
              <div className="px-2.5 pb-2 pt-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-text-3">
                Switch scenario
              </div>
              {scenarios.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setScenarioId(s.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[7px] border-0 px-2.5 py-[9px] text-left",
                    s.id === scenarioId ? "bg-bg" : "bg-transparent hover:bg-[#FAFAFA]"
                  )}
                >
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: s.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-brand-dark">{s.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{s.tagline}</div>
                  </div>
                  {s.id === scenarioId && <Icons.Check size={14} stroke="#F97316" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <span aria-hidden className="mx-2 text-xl text-border">
          •
        </span>
        <span className="text-xl font-normal tracking-[-0.015em] text-muted-foreground">{viewName}</span>
      </div>

      {/* Line 2 — tagline */}
      <div className="mt-1 max-w-[672px] text-sm leading-[1.5] text-muted-foreground [text-wrap:pretty]">{tagline}</div>
    </div>
  );
}
