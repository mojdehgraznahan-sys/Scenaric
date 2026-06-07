"use client";

// Monitoring — leading indicators. Faithful Tailwind/shadcn port of page-monitoring-settings.jsx.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Indicator } from "@/lib/types";

const GRID_COLS = "grid-cols-[minmax(280px,2.4fr)_1.4fr_100px_100px_90px_40px]";

function statusColor(st: Indicator["status"]) {
  if (st === "Alert") return { bg: "#FEF2F2", fg: "#EF4444", dot: "#EF4444" };
  if (st === "Watch") return { bg: "#FFFBEB", fg: "#B45309", dot: "#F59E0B" };
  return { bg: "#ECFDF5", fg: "#065F46", dot: "#10B981" };
}

function Sparkline({ color, trend }: { color: string; trend: string }) {
  const points = trend === "↑" ? [10, 12, 9, 15, 13, 18, 22] : trend === "→" ? [12, 13, 11, 14, 12, 13, 12] : [18, 15, 16, 12, 14, 10, 8];
  const max = Math.max(...points);
  const min = Math.min(...points);
  return (
    <svg width="80" height="24" viewBox="0 0 80 24" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        points={points.map((p, i) => `${(i / (points.length - 1)) * 78 + 1},${22 - ((p - min) / (max - min || 1)) * 20}`).join(" ")}
      />
    </svg>
  );
}

export function PageMonitoring() {
  const store = useStore();
  const indicators = store.indicators;
  const scenarios = store.scenarios;
  const [filter, setFilter] = React.useState("All");

  const filtered = filter === "All" ? indicators : indicators.filter((i) => i.status === filter);

  const summary = [
    { label: "All", count: indicators.length, color: "text-brand-dark", dot: "#1E1B2E" },
    { label: "Alert", count: indicators.filter((i) => i.status === "Alert").length, color: "text-[#EF4444]", dot: "#EF4444" },
    { label: "Watch", count: indicators.filter((i) => i.status === "Watch").length, color: "text-[#F59E0B]", dot: "#F59E0B" },
    { label: "On track", count: indicators.filter((i) => i.status === "On track").length, color: "text-[#10B981]", dot: "#10B981" },
  ];

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Monitoring</h2>
            <div className="mt-0.5 text-[13px] text-muted-foreground">Leading indicators tell you which scenario is unfolding.</div>
          </div>
          <Button variant="primary" size="sm">
            <Icons.Plus size={12} /> Add indicator
          </Button>
        </div>

        {/* Status summary */}
        <div className="mb-[18px] grid grid-cols-4 gap-3">
          {summary.map((s) => (
            <button
              key={s.label}
              onClick={() => setFilter(s.label)}
              className={cn(
                "rounded-[10px] bg-white text-left",
                filter === s.label ? "border-[1.5px] border-brand-dark px-3.5 py-[11px]" : "border border-border px-3.5 py-3"
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
          <div className={cn("grid border-b border-border bg-[#F9FAFB] px-3.5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground", GRID_COLS)}>
            <div>INDICATOR</div>
            <div>POINTS TO</div>
            <div className="text-center">STATUS</div>
            <div className="text-center">TREND</div>
            <div className="text-center">7-DAY</div>
            <div />
          </div>
          {filtered.map((ind, i) => {
            const c = statusColor(ind.status);
            const scenario = scenarios.find((s) => s.name === ind.scenario);
            return (
              <div key={ind.id} className={cn("grid items-center px-3.5 py-3", GRID_COLS, i < filtered.length - 1 && "border-b border-[#F3F4F6]")}>
                <div>
                  <div className="text-[13.5px] font-medium text-brand-dark">{ind.name}</div>
                  <div className="mt-0.5 text-[11.5px] text-text-3">{ind.note}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: scenario?.color || "#9CA3AF" }} />
                  <span className="text-[12.5px] text-[#374151]">{ind.scenario}</span>
                </div>
                <div className="text-center">
                  <span className="inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]" style={{ background: c.bg, color: c.fg }}>
                    {ind.status}
                  </span>
                </div>
                <div className="text-center font-mono text-sm font-semibold" style={{ color: c.fg }}>
                  {ind.trend}
                </div>
                <div className="flex justify-center">
                  <Sparkline color={c.dot} trend={ind.trend} />
                </div>
                <div className="text-right">
                  <button className="border-0 bg-transparent p-1 text-text-3">
                    <Icons.MoreH size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI insight */}
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3.5">
          <Icons.Bell size={16} stroke="#EF4444" className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#991B1B]">2 indicators in alert</div>
            <div className="text-[13px] leading-[1.55] text-[#7F1D1D]">
              US-China tariff escalations and cross-border cloud sanctions are both moving toward the{" "}
              <strong>Bamboo Curtain</strong> scenario. Review your hedging strategy.
            </div>
          </div>
          <button className="rounded-md border border-[#FCA5A5] bg-white px-[11px] py-[7px] text-[13px] font-medium text-[#991B1B]">Review</button>
        </div>
      </div>
    </div>
  );
}
