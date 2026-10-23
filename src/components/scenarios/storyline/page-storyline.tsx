"use client";

// Storyline (design/storyline_handoff/) — merges the old Storyline page and Event chains into
// one. Same page-shell pattern as PageFutures: useStore for the active project, useFutures for
// the 4 scenarios + target year, useEventChain for the active scenario's chain.
import * as React from "react";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { useFutures, useEventChain } from "@/lib/use-futures";
import { ScenarioYearHeader } from "@/components/scenarios/scenario-year-header";
import { StoryChain } from "@/components/scenarios/storyline/story-chain";

export function PageStoryline() {
  const store = useStore();
  const navigate = useNavigate();
  const projectId = store.activeProjectId;
  const futures = useFutures(projectId);
  const { data } = futures;

  const scenarios = data?.scenarios ?? [];
  const activeId = data?.chainScenarioId && scenarios.some((s) => s.id === data.chainScenarioId) ? data.chainScenarioId : scenarios[0]?.id ?? null;
  const i = Math.max(0, scenarios.findIndex((s) => s.id === activeId));
  const scenario = scenarios[i];
  const startYear = new Date().getFullYear();
  const targetYear = data?.targetYear ?? startYear;

  const { events, loading, generating, regenerate, save, rate } = useEventChain(scenario?.id ?? null, startYear, targetYear);

  if (!projectId || !data) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">{projectId ? "Loading…" : "No project selected."}</div>;
  }
  if (!scenario) {
    return <div className="flex-1 p-5 text-sm text-muted-foreground">No scenarios yet — build your scenario matrix first.</div>;
  }

  const goTo = (id: string) => futures.setChainScenario(id).catch((err) => console.error("[storyline] failed to switch scenario", err));

  return (
    <div className="scroll-y flex flex-1 flex-col overflow-y-auto">
      <ScenarioYearHeader
        eyebrow={`Scenarios · step 2 of 2 · future ${i + 1} of ${scenarios.length}`}
        title={`Storyline to ${targetYear}: ${scenario.name}`}
        year={targetYear}
        yearOptions={data.yearOptions}
        horizon={data.horizon}
        onYearChange={futures.setTargetYear}
        back={i > 0 ? { label: scenarios[i - 1].name, onClick: () => goTo(scenarios[i - 1].id) } : { label: "Futures", onClick: () => navigate("/futures") }}
        next={
          i < scenarios.length - 1
            ? { label: `Next future: ${scenarios[i + 1].name}`, onClick: () => goTo(scenarios[i + 1].id) }
            : { label: "Decide responses", onClick: () => navigate("/strategy") }
        }
      />
      <div className="p-5">
        {loading || !events ? (
          <div className="rounded-xl border border-border bg-white p-5 text-sm text-muted-foreground">{generating ? "Building this chain…" : "Loading…"}</div>
        ) : (
          <StoryChain
            scenario={{ id: scenario.id, name: scenario.name, color: scenario.color, tagline: scenario.tagline }}
            scenarios={scenarios.map((s) => ({ id: s.id, name: s.name, color: s.color, desirability: s.desirability }))}
            startYear={startYear}
            targetYear={targetYear}
            events={events}
            onSave={save}
            onRate={rate}
            onRegenerate={regenerate}
            onSwitchScenario={goTo}
            busy={generating}
          />
        )}
      </div>
    </div>
  );
}
