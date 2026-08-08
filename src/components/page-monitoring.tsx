"use client";

// Monitoring — leading indicators (Step 8, Build Plan §11). Real data: indicators are
// generated from a scenario's storyline via ai-indicators.ts, not the mock/localStorage
// slice this page used to read (store.indicators has been removed — see store.tsx).
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { listIndicatorsForProject, type IndicatorRow } from "@/lib/actions/indicators";

const GRID_COLS = "grid-cols-[minmax(280px,2.4fr)_1.4fr_100px_100px_100px]";

function statusColor(st: IndicatorRow["status"]) {
  if (st === "Alert") return { bg: "#FEF2F2", fg: "#EF4444", dot: "#EF4444" };
  if (st === "Watch") return { bg: "#FFFBEB", fg: "#B45309", dot: "#F59E0B" };
  return { bg: "#ECFDF5", fg: "#065F46", dot: "#10B981" };
}

export function PageMonitoring() {
  const store = useStore();
  const projectId = store.activeProjectId;
  const scenarios = store.scenarios;
  // "Track indicators" on the Narrative page generates for one scenario, persists it for
  // real, then lands here as /monitoring?scenarioId={id} — the generated rows are already
  // in the DB by the time this page loads, so there's no unsaved payload to shuttle through
  // the URL, just which scenario to pre-filter to (same spirit as page-signals.tsx's
  // ?mergeInsight= param, simpler since there's nothing to fetch-by-id and open a modal for).
  const searchParams = useSearchParams();
  const scenarioIdParam = searchParams.get("scenarioId");

  const [indicators, setIndicators] = React.useState<IndicatorRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState("All");
  const [scenarioFilter, setScenarioFilter] = React.useState<string | null>(scenarioIdParam);

  React.useEffect(() => {
    setScenarioFilter(scenarioIdParam);
  }, [scenarioIdParam]);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    listIndicatorsForProject(projectId)
      .then((rows) => {
        if (!cancelled) setIndicators(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const scenarioFiltered = scenarioFilter ? indicators.filter((i) => i.scenario_id === scenarioFilter) : indicators;
  const filtered = statusFilter === "All" ? scenarioFiltered : scenarioFiltered.filter((i) => i.status === statusFilter);
  const filterScenario = scenarioFilter ? scenarios.find((s) => s.id === scenarioFilter) : null;

  const summary = [
    { label: "All", count: scenarioFiltered.length, color: "text-brand-dark", dot: "#1E1B2E" },
    { label: "Alert", count: scenarioFiltered.filter((i) => i.status === "Alert").length, color: "text-[#EF4444]", dot: "#EF4444" },
    { label: "Watch", count: scenarioFiltered.filter((i) => i.status === "Watch").length, color: "text-[#F59E0B]", dot: "#F59E0B" },
    { label: "On track", count: scenarioFiltered.filter((i) => i.status === "On track").length, color: "text-[#10B981]", dot: "#10B981" },
  ];

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Monitoring</h2>
          <div className="mt-0.5 text-[13px] text-muted-foreground">Leading indicators tell you which scenario is unfolding.</div>
        </div>

        {filterScenario && (
          <div className="mb-3.5 flex items-center gap-2 rounded-[10px] border border-brand-orange100 bg-brand-orangeLight px-3.5 py-2.5 text-[12.5px] text-brand-orange700">
            <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: filterScenario.color }} />
            <span className="flex-1">
              Showing indicators for <strong>{filterScenario.name}</strong>
            </span>
            <button
              onClick={() => setScenarioFilter(null)}
              className="flex-shrink-0 border-0 bg-transparent p-0 text-[12.5px] font-semibold text-brand-orange700 underline"
            >
              Show all
            </button>
          </div>
        )}

        {/* Status summary */}
        <div className="mb-[18px] grid grid-cols-4 gap-3">
          {summary.map((s) => (
            <button
              key={s.label}
              onClick={() => setStatusFilter(s.label)}
              className={cn(
                "rounded-[10px] bg-white text-left",
                statusFilter === s.label ? "border-[1.5px] border-brand-dark px-3.5 py-[11px]" : "border border-border px-3.5 py-3"
              )}
            >
              <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
                {s.label}
              </div>
              <div className={cn("mt-1 text-[26px] font-semibold tracking-[-0.02em]", s.color)}>{s.count}</div>
            </button>
          ))}
        </div>

        {/* Indicator list */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div
            className={cn(
              "grid border-b border-border bg-[#F9FAFB] px-3.5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground",
              GRID_COLS
            )}
          >
            <div>INDICATOR</div>
            <div>SCENARIO</div>
            <div className="text-center">STATUS</div>
            <div className="text-center">TREND</div>
            <div className="text-center">GROUNDED</div>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No indicators yet — generate some from a scenario&apos;s Narrative page (&quot;Track indicators&quot;).
            </div>
          ) : (
            filtered.map((ind, i) => {
              const c = statusColor(ind.status);
              const scenario = scenarios.find((s) => s.id === ind.scenario_id);
              return (
                <div
                  key={ind.id}
                  className={cn("grid items-center px-3.5 py-3", GRID_COLS, i < filtered.length - 1 && "border-b border-[#F3F4F6]")}
                >
                  <div>
                    <div className="text-[13.5px] font-medium text-brand-dark">{ind.name}</div>
                    {ind.note && <div className="mt-0.5 text-[11.5px] text-text-3">{ind.note}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: scenario?.color || "#9CA3AF" }} />
                    <span className="text-[12.5px] text-[#374151]">{scenario?.name || "—"}</span>
                  </div>
                  <div className="text-center">
                    <span
                      className="inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]"
                      style={{ background: c.bg, color: c.fg }}
                    >
                      {ind.status}
                    </span>
                  </div>
                  <div className="text-center text-[11.5px] text-text-3">{ind.trend || "—"}</div>
                  <div className="text-center text-[11.5px] text-text-3">{ind.grounded_in ? "✓" : "—"}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
