"use client";

// Home — view switch (design/2026-10-05/04-home-ceo-view/PROMPTS.md, Prompt 1). Renders a
// fixed top strip (Setup view / CEO view switch + Executive briefing button) that never moves
// between views, then either PageDashboard (Setup) or PageHomeV2 (CEO) below it, each owning
// its own scroll area. Both src/app/(app)/home/page.tsx points here now — "dashboard" never
// had a real route of its own in this codebase (the TopBar's TITLES map has a vestigial
// `dashboard: "Home"` entry, but nothing routes there).
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useDecisions } from "@/lib/use-decisions";
import { getHomeView, setHomeView, type HomeView } from "@/lib/actions/home-view";
import { PageDashboard } from "@/components/page-dashboard";
import { PageHomeV2 } from "@/components/page-home-v2";
import { DcBriefing, type ScenarioLite } from "@/components/decision-ui";

function HomeViewToggle({ view, setView }: { view: HomeView; setView: (v: HomeView) => void }) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border bg-white">
      {([["setup", "Setup view"], ["ceo", "CEO view"]] as const).map(([k, l]) => (
        <button
          key={k}
          onClick={() => setView(k)}
          className={cn("px-3 py-1.5 text-[12.5px] font-medium", view === k ? "bg-brand-dark text-white" : "bg-white text-[#374151]")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function PageHome() {
  const store = useStore();
  const projectId = store.activeProjectId;
  const activeProject = (store.projects || []).find((p) => p.id === projectId);
  const hasStrategy = (activeProject?.stepsComplete ?? 0) >= 8;

  // null = still resolving the server-persisted preference; falls back to the computed
  // default (gated on whether this project has a chosen strategy) only once that choice is
  // confirmed absent, never before — avoids a flash of the wrong view on first paint.
  const [view, setViewState] = React.useState<HomeView | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    getHomeView()
      .then((saved) => {
        if (!cancelled) setViewState(saved ?? (hasStrategy ? "ceo" : "setup"));
      })
      .catch((err) => {
        console.error("[home] failed to load view preference", err);
        if (!cancelled) setViewState(hasStrategy ? "ceo" : "setup");
      });
    return () => {
      cancelled = true;
    };
    // Deliberately only on mount — hasStrategy becoming true later shouldn't yank a user who
    // already explicitly chose Setup back into CEO view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setView = (v: HomeView) => {
    setViewState(v);
    setHomeView(v).catch((err) => console.error("[home] failed to save view preference", err));
  };

  const scenarios = React.useMemo(() => store.scenarios.filter((s) => !s.archived), [store.scenarios]);
  const scenariosLite: ScenarioLite[] = React.useMemo(() => scenarios.map((s) => ({ id: s.id, name: s.name, color: s.color })), [scenarios]);
  const { data } = useDecisions(projectId);
  const [briefingOpen, setBriefingOpen] = React.useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-shrink-0" style={{ padding: "16px 24px 0" }}>
        <div className="mx-auto flex flex-wrap items-center justify-between gap-2.5" style={{ maxWidth: 1180 }}>
          <HomeViewToggle view={view ?? "setup"} setView={setView} />
          <Button variant="ghost" size="sm" onClick={() => setBriefingOpen(true)}>
            <Icons.File size={12} /> Executive briefing
          </Button>
        </div>
      </div>
      {view === "ceo" ? <PageHomeV2 /> : <PageDashboard />}
      {briefingOpen && data && (
        <DcBriefing onClose={() => setBriefingOpen(false)} projectName={store.project.name} data={data} scenarios={scenariosLite} />
      )}
    </div>
  );
}
