"use client";

// Home / Dashboard — faithful Tailwind/shadcn port of the handoff page-dashboard.jsx.
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";

const STEPS = [
  { label: "Focal question", done: true, route: "/settings" },
  { label: "Key forces", done: true, route: "/knowledge" },
  { label: "Driving forces", done: true, route: "/signals" },
  { label: "Rank forces", done: true, route: "/matrix" },
  { label: "Scenario logics", done: false, route: "/canvas" },
  { label: "Narratives", done: false, route: "/narrative" },
  { label: "Implications", done: false, route: "/narrative" },
  { label: "Indicators", done: false, route: "/monitoring" },
  { label: "Strategy", done: false, route: "/strategy" },
];

const KPIS = [
  { label: "Signals tracked", value: 23, sub: "+3 this week", tone: "text-brand-orange", route: "/signals" },
  { label: "Scenarios drafted", value: 4, sub: "Ready for narratives", tone: "text-[#3B82F6]", route: "/canvas" },
  { label: "Indicators live", value: 6, sub: "2 in alert", tone: "text-[#EF4444]", route: "/monitoring" },
  { label: "Strategic options", value: 4, sub: "1 robust across futures", tone: "text-[#10B981]", route: "/strategy" },
];

export function PageDashboard() {
  const store = useStore();
  const { seed } = store;
  const navigate = useNavigate();

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-[1080px]">
        {/* Welcome header */}
        <div className="mb-5">
          <div className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-brand-orange">
            WELCOME BACK, JOHN
          </div>
          <h1 className="mb-1 text-[28px] font-semibold tracking-[-0.02em]">APAC Expansion 2030</h1>
          <div className="text-sm text-muted-foreground">5–10 year horizon · Technology · Last updated 2h ago</div>
        </div>

        {/* Progress strip */}
        <div className="mb-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="mb-3.5 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Methodology progress</div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">4 of 9 steps complete — keep going</div>
            </div>
            <div className="font-mono text-[22px] font-semibold tracking-[-0.02em] text-brand-orange">
              44<span className="text-text-3">%</span>
            </div>
          </div>
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-brand-orange" style={{ width: "44%" }} />
          </div>
          <div className="grid grid-cols-9 gap-1.5">
            {STEPS.map((step, i) => (
              <button
                key={i}
                onClick={() => navigate(step.route)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 transition-[border,background] duration-[120ms]",
                  step.done ? "border-brand-orange100 bg-brand-orangeLight" : "border-border bg-white hover:border-border-strong"
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-5 w-5 items-center justify-center rounded-full font-mono text-[10px] font-semibold",
                    step.done ? "bg-brand-orange text-white" : "bg-[#F3F4F6] text-text-3"
                  )}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                <span
                  className={cn(
                    "text-center text-[10.5px] font-medium leading-[1.2]",
                    step.done ? "text-brand-orange700" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Four KPI cards */}
        <div className="mb-4 grid grid-cols-4 gap-3">
          {KPIS.map((k) => (
            <button
              key={k.label}
              onClick={() => navigate(k.route)}
              className="rounded-xl border border-border bg-white p-4 text-left shadow-card"
            >
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">{k.label}</div>
              <div className={cn("mt-1 text-[30px] font-semibold tracking-[-0.02em]", k.tone)}>{k.value}</div>
              <div className="mt-0.5 text-[11.5px] text-muted-foreground">{k.sub}</div>
            </button>
          ))}
        </div>

        {/* AI Recommended Actions */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-[18px] shadow-card">
            <div className="mb-2.5 flex items-center gap-2">
              <Icons.Sparkle size={14} stroke="#F97316" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-orange700">
                Recommended next
              </span>
            </div>
            <div className="mb-1 text-[15px] font-semibold">Build the impact × uncertainty matrix</div>
            <div className="mb-3.5 text-[13px] leading-[1.55] text-muted-foreground">
              You have 23 signals ranked. Plot the top by impact and uncertainty to find your scenario axes.
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate("/matrix")}>
              Open matrix <Icons.ArrowRight size={12} />
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-[18px] shadow-card">
            <div className="mb-2.5 flex items-center gap-2">
              <Icons.Eye size={14} stroke="#10B981" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#065F46]">Monitor</span>
            </div>
            <div className="mb-1 text-[15px] font-semibold">Track 6 leading indicators</div>
            <div className="mb-3.5 text-[13px] leading-[1.55] text-muted-foreground">
              Regulatory rulings and AI capex thresholds will tell you which scenario is unfolding.
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/monitoring")}>
              Open monitoring <Icons.ArrowRight size={12} />
            </Button>
          </div>
        </div>

        {/* News feed */}
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
            <div className="flex items-center gap-2">
              <Icons.Radio size={14} stroke="#1E1B2E" />
              <span className="text-sm font-semibold">News Feed</span>
              <span className="font-mono text-[11px] text-text-3">· 5 unread</span>
            </div>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm">
                <Icons.Filter size={12} /> Filter
              </Button>
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </div>
          </div>
          {seed.news.map((n, i) => (
            <div
              key={n.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 px-[18px] py-3",
                i < seed.news.length - 1 && "border-b border-[#F3F4F6]"
              )}
            >
              <div className="flex-1">
                <div className="mb-0.5 text-[13.5px] font-medium text-brand-dark">{n.title}</div>
                <div className="font-mono text-[11px] text-text-3">
                  {n.source.toUpperCase()} · {n.time}
                </div>
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]",
                  n.impact === "HIGH" ? "bg-brand-orangeLight text-brand-orange700" : "bg-[#FFFBEB] text-[#B45309]"
                )}
              >
                {n.impact}
              </span>
              <button
                className="rounded-md px-2 py-1 text-[13px] font-medium text-brand-orange"
                onClick={() => navigate("/signals")}
              >
                + Add to Signals
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
