"use client";

// Home / Dashboard — faithful Tailwind/shadcn port of the handoff page-dashboard.jsx.
// Store-driven for project identity (name/horizon/industry/lastEdited); KPIs, the 9-tile
// stepsComplete tracker, and the News Feed are all fetched from GET /projects/:id/dashboard
// and GET /projects/:id/news — real per-project data, not the seed.stats/seed.news demo
// data this page used to read.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import type { ProjectDashboard } from "@/lib/actions/dashboard";
import type { NewsItemRow } from "@/lib/actions/news";
import type { RecommendationAction } from "@/lib/actions/dashboard-recommendations";
import { STEP_LABELS, STEP_ROUTES, STEP_GATE } from "@/lib/step-tracker";

const EMPTY_KPI = { value: 0, sub: "" };

export function PageDashboard() {
  const store = useStore();
  const navigate = useNavigate();
  const project = store.project;
  const projectId = store.activeProjectId;
  const activeProject = (store.projects || []).find((p) => p.id === projectId);

  // Initialized from the store's own already-server-derived copy (list_projects_with_progress,
  // same RPC the dashboard endpoint below calls) so the tile tracker doesn't flash "Not started"
  // before the fetch resolves — then the fetch's own value (same source of truth) takes over.
  const [dashboard, setDashboard] = React.useState<ProjectDashboard | null>(null);
  const stepsComplete = Math.max(0, Math.min(8, dashboard?.stepsComplete ?? (activeProject && activeProject.stepsComplete) ?? 0));

  const [news, setNews] = React.useState<NewsItemRow[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [addingIds, setAddingIds] = React.useState<Set<string>>(new Set());
  // null = not loaded yet / fetch failed → each card falls back to its own static copy below,
  // never a blank card. An empty array (successful fetch, model judged nothing worth
  // surfacing) also falls back per-slot the same way.
  const [recommendedActions, setRecommendedActions] = React.useState<RecommendationAction[] | null>(null);

  React.useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      try {
        const [dashboardRes, newsRes, recommendationsRes] = await Promise.all([
          fetch(`/api/projects/${projectId}/dashboard`),
          fetch(`/api/projects/${projectId}/news?unread=true`),
          fetch(`/api/projects/${projectId}/dashboard/recommendations`, { method: "POST" }),
        ]);
        if (!cancelled && dashboardRes.ok) setDashboard(await dashboardRes.json());
        if (!cancelled && newsRes.ok) {
          const data = await newsRes.json();
          setNews(data.items);
          setUnreadCount(data.unreadCount);
        }
        if (!cancelled && recommendationsRes.ok) {
          const data = await recommendationsRes.json();
          setRecommendedActions(data.actions);
        }
      } catch (err) {
        console.error("[dashboard] failed to load dashboard data", err);
      } finally {
        // Fired only after the unread fetch above resolves — stamping the view first would
        // erase this same visit's own "unread" badge before it's ever shown.
        if (!cancelled) fetch(`/api/projects/${projectId}/dashboard/view`, { method: "POST" }).catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const nextStepAction = recommendedActions?.find((a) => a.slot === "next_step") ?? null;
  const monitorAction = recommendedActions?.find((a) => a.slot === "monitor") ?? null;

  const addToSignals = React.useCallback(
    async (newsItemId: string) => {
      if (!projectId) return;
      setAddingIds((prev) => new Set(prev).add(newsItemId));
      try {
        const res = await fetch(`/api/projects/${projectId}/news/${newsItemId}/add-to-signals`, { method: "POST" });
        if (!res.ok) throw new Error(`Request failed (${res.status}).`);
        setNews((prev) => prev.map((n) => (n.id === newsItemId ? { ...n, added_to_signals: true } : n)));
      } catch (err) {
        console.error("[dashboard] failed to add news item to signals", err);
      } finally {
        setAddingIds((prev) => {
          const next = new Set(prev);
          next.delete(newsItemId);
          return next;
        });
      }
    },
    [projectId]
  );

  const tiles = STEP_LABELS.map((label, i) => ({
    label,
    route: STEP_ROUTES[i],
    done: stepsComplete >= STEP_GATE[i],
  }));
  const tilesDone = tiles.filter((t) => t.done).length;
  const pct = Math.round((tilesDone / tiles.length) * 100);

  const lastEditedLabel = (() => {
    if (!activeProject || !activeProject.lastEdited) return "just now";
    const diffH = Math.round((Date.now() - new Date(activeProject.lastEdited).getTime()) / 3600000);
    if (diffH < 1) return "just now";
    if (diffH < 24) return diffH + "h ago";
    return Math.round(diffH / 24) + "d ago";
  })();

  const kpis = [
    {
      label: "Signals tracked",
      ...(dashboard?.kpis.signals ?? EMPTY_KPI),
      tone: "text-brand-orange",
      route: "/signals",
    },
    {
      label: "Scenarios drafted",
      ...(dashboard?.kpis.scenarios ?? EMPTY_KPI),
      tone: "text-[#3B82F6]",
      route: "/canvas",
    },
    {
      label: "Indicators live",
      ...(dashboard?.kpis.indicators ?? EMPTY_KPI),
      tone: "text-[#EF4444]",
      route: "/monitoring",
    },
    {
      label: "Strategic options",
      ...(dashboard?.kpis.strategicOptions ?? EMPTY_KPI),
      tone: "text-[#10B981]",
      route: "/strategy",
    },
  ];

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-[1080px]">
        {/* Welcome header */}
        <div className="mb-5">
          <div className="mb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-brand-orange">
            WELCOME BACK, {((store.user && store.user.name) || "there").split(" ")[0].toUpperCase()}
          </div>
          <h1 className="mb-1 text-[28px] font-semibold tracking-[-0.02em]">{project.name}</h1>
          <div className="text-sm text-muted-foreground">
            {[project.horizon ? project.horizon + " horizon" : null, project.industry || null, "Last updated " + lastEditedLabel]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>

        {/* Progress strip */}
        <div className="mb-4 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="mb-3.5 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Methodology progress</div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                {tilesDone === 0 ? "Not started yet — let's begin" : `${tilesDone} of ${tiles.length} steps complete — keep going`}
              </div>
            </div>
            <div className="font-mono text-[22px] font-semibold tracking-[-0.02em] text-brand-orange">
              {pct}
              <span className="text-text-3">%</span>
            </div>
          </div>
          <div className="mb-4 h-1 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-brand-orange" style={{ width: pct + "%" }} />
          </div>
          <div className="grid grid-cols-9 gap-1.5">
            {tiles.map((step, i) => (
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
          {kpis.map((k) => (
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

        {/* AI Recommended Actions — real, grounded copy from POST /dashboard/recommendations
            when available; each card falls back to its own original static copy independently
            (never blank) if the fetch failed or the model judged that slot not worth surfacing. */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-[18px] shadow-card">
            <div className="mb-2.5 flex items-center gap-2">
              <Icons.Sparkle size={14} stroke="#F97316" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-orange700">
                Recommended next
              </span>
            </div>
            <div className="mb-1 text-[15px] font-semibold">{nextStepAction ? nextStepAction.title : "Build the impact × uncertainty matrix"}</div>
            <div className="mb-3.5 text-[13px] leading-[1.55] text-muted-foreground">
              {nextStepAction
                ? nextStepAction.rationale
                : kpis[0].value > 0
                  ? `You have ${kpis[0].value} signals ranked. Plot the top by impact and uncertainty to find your scenario axes.`
                  : "Add and rank a few signals first, then plot them here to find your scenario axes."}
            </div>
            <Button variant="primary" size="sm" onClick={() => navigate(nextStepAction?.route ?? "/matrix")}>
              {nextStepAction ? nextStepAction.ctaLabel : "Open matrix"} <Icons.ArrowRight size={12} />
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-[18px] shadow-card">
            <div className="mb-2.5 flex items-center gap-2">
              <Icons.Eye size={14} stroke="#10B981" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#065F46]">Monitor</span>
            </div>
            <div className="mb-1 text-[15px] font-semibold">
              {monitorAction ? monitorAction.title : kpis[2].value > 0 ? `Track ${kpis[2].value} leading indicators` : "Set up leading indicators"}
            </div>
            <div className="mb-3.5 text-[13px] leading-[1.55] text-muted-foreground">
              {monitorAction
                ? monitorAction.rationale
                : kpis[2].value > 0
                  ? "Regulatory rulings and AI capex thresholds will tell you which scenario is unfolding."
                  : "Once your scenarios are built, define the signposts that tell you which future is unfolding."}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate(monitorAction?.route ?? "/monitoring")}>
              {monitorAction ? monitorAction.ctaLabel : "Open monitoring"} <Icons.ArrowRight size={12} />
            </Button>
          </div>
        </div>

        {/* News feed */}
        <div className="rounded-xl border border-border bg-card shadow-card">
          <div className="flex items-center justify-between border-b border-border px-[18px] py-3.5">
            <div className="flex items-center gap-2">
              <Icons.Radio size={14} stroke="#1E1B2E" />
              <span className="text-sm font-semibold">News Feed</span>
              <span className="font-mono text-[11px] text-text-3">· {unreadCount} unread</span>
            </div>
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm">
                <Icons.Filter size={12} /> Filter
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/knowledge")}>
                View all
              </Button>
            </div>
          </div>
          {news.length === 0 ? (
            <div className="px-[18px] py-6 text-center text-[13px] text-muted-foreground">
              No news pulled yet — check back after the next daily update.
            </div>
          ) : (
            news.map((n, i) => (
              <div
                key={n.id}
                className={cn("flex items-center gap-3 px-[18px] py-3", i < news.length - 1 && "border-b border-[#F3F4F6]")}
              >
                <div className="flex-1">
                  <div className="mb-0.5 text-[13.5px] font-medium text-brand-dark">{n.title}</div>
                  <div className="font-mono text-[11px] text-text-3">
                    {n.source.toUpperCase()} · {timeAgoLabel(n.published_at)}
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
                  className="rounded-md px-2 py-1 text-[13px] font-medium text-brand-orange disabled:cursor-default disabled:text-text-3"
                  disabled={n.added_to_signals || addingIds.has(n.id)}
                  onClick={() => addToSignals(n.id)}
                >
                  {n.added_to_signals ? "Added" : addingIds.has(n.id) ? "Adding…" : "+ Add to Signals"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function timeAgoLabel(iso: string | null): string {
  if (!iso) return "recently";
  const diffH = Math.round((Date.now() - new Date(iso).getTime()) / 3600000);
  if (diffH < 1) return "just now";
  if (diffH < 24) return diffH + "h ago";
  return Math.round(diffH / 24) + "d ago";
}
