"use client";

// Scenario family — shared context header for Matrix / Storyline / Narrative.
// Breadcrumb: {project} / {view} / {scenario picker (dropdown)}, tagline below.
// Faithful port of scenario-view-switcher.jsx (Claude Design).
import * as React from "react";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { useStore, usePersistentState } from "@/lib/store";
import type { Navigate } from "@/lib/use-navigate";

interface ScenarioView {
  id: string;
  label: string;
  view: string;
  tooltip: string;
  shortcut: string;
}

export const SCENARIO_VIEWS: ScenarioView[] = [
  { id: "matrix", label: "Matrix", view: "Matrix view", tooltip: "Where could the future go?", shortcut: "1" },
  { id: "storyline", label: "Storyline", view: "Storyline view", tooltip: "How would we get there?", shortcut: "2" },
  { id: "narrative", label: "Narrative", view: "Narrative view", tooltip: "What does that future look like?", shortcut: "3" },
];

const SCENARIO_TAGLINES: Record<string, string> = {
  sc1: "How open markets + aligned geopolitics produce the best-case future for SEA expansion.",
  sc2: "Markets stay open but politics atomise — speed and modularity beat scale.",
  sc3: "Geopolitical détente but rising protectionism — local-for-local becomes mandatory.",
  sc4: "Worst case: blocs harden and decoupling accelerates — preserve optionality.",
};

function ScenarioBreadcrumbPicker({
  label,
  scenario,
  scenarios,
  scenarioId,
  onSelect,
}: {
  label: string;
  scenario: { id: string; name: string; color: string } | undefined;
  scenarios: { id: string; name: string; color: string }[];
  scenarioId: string | undefined;
  onSelect: (id: string) => void;
}) {
  const store = useStore();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

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

  const crumbTextStyle = "font-mono text-xs text-text-3";

  return (
    <div className="mb-0.5 flex items-center gap-1">
      <span className="text-sm font-semibold tracking-[-0.01em] text-brand-dark">{store.project.name}</span>
      <span className={crumbTextStyle}>/</span>
      <span className={crumbTextStyle}>{label}</span>
      <span className={crumbTextStyle}>/</span>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          title="Switch scenario"
          className="inline-flex items-center gap-[3px] border-0 bg-transparent p-0 font-mono text-xs font-semibold text-brand-dark"
        >
          {scenario ? scenario.name : "Select scenario"}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="slide-up absolute left-0 top-[calc(100%+6px)] z-[60] w-60 rounded-[9px] border border-border bg-white p-[5px] shadow-[0_10px_28px_rgba(15,23,42,0.12)]">
            {scenarios.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border-0 px-[9px] py-[7px] text-left text-[12.5px]",
                  s.id === scenarioId ? "bg-[#F5F5F5]" : "bg-transparent hover:bg-[#FAFAFA]"
                )}
              >
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-brand-dark">{s.name}</span>
                {s.id === scenarioId && <Icons.Check size={12} stroke="#F97316" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ScenarioContextHeader({ view }: { view: string }) {
  const store = useStore();
  const scenarios = store.scenarios || [];
  const [scenarioId, setScenarioId] = usePersistentState<string | undefined>(
    "fm.storylineScenario",
    scenarios[0] && scenarios[0].id
  );
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0];

  const v = SCENARIO_VIEWS.find((x) => x.id === view);
  const viewLabel = v ? v.label : "";

  if (!scenario) return null;
  const tagline = SCENARIO_TAGLINES[scenario.id] || scenario.summary || scenario.tagline || "";

  return (
    <div className="py-4">
      <ScenarioBreadcrumbPicker
        label={viewLabel}
        scenario={scenario}
        scenarios={scenarios}
        scenarioId={scenarioId}
        onSelect={setScenarioId}
      />
      <div className="mt-2.5 max-w-[672px] text-[13px] leading-[1.5] text-muted-foreground [text-wrap:pretty]">{tagline}</div>
      {view === "storyline" && (scenario.axisA?.label || scenario.axisB?.label) && (
        <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.04em] text-text-3">
          {scenario.axisA?.label || "—"} / {scenario.axisB?.label || "—"}
        </div>
      )}
    </div>
  );
}

export function useScenarioShortcuts(navigate: Navigate | undefined) {
  React.useEffect(() => {
    if (!navigate) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (document.activeElement && (document.activeElement as HTMLElement).isContentEditable)) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const map: Record<string, string> = { "1": "matrix", "2": "storyline", "3": "narrative" };
      const target = map[e.key];
      if (!target) return;
      e.preventDefault();
      navigate("/" + target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}
