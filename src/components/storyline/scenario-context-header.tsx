"use client";

// Matrix's breadcrumb header, and the global scenario-family keyboard shortcut handler.
// Used to also serve Storyline/Narrative with a per-scenario picker (scenario-view-switcher.jsx)
// — both retired (design/storyline_handoff/); Matrix has no per-scenario content (one shared
// matrix/axis pair produces all 4 scenarios at once), so only the plain, non-interactive
// breadcrumb survives. The new Futures/Storyline pages use their own ScenarioYearHeader
// (components/scenarios/scenario-year-header.tsx), not this component.
import * as React from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Navigate } from "@/lib/use-navigate";

export function ScenarioContextHeader({ view, className }: { view: "matrix"; className?: string }) {
  const store = useStore();
  return (
    <div className={cn("py-4", className)}>
      <div className="flex items-center gap-1">
        <span className="text-sm font-semibold tracking-[-0.01em] text-brand-dark">{store.project.name}</span>
        <span className="font-mono text-xs text-text-3">/</span>
        <span className="font-mono text-xs text-text-3">{view === "matrix" ? "Matrix" : ""}</span>
      </div>
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
      const map: Record<string, string> = { "1": "matrix", "2": "storyline" };
      const target = map[e.key];
      if (!target) return;
      e.preventDefault();
      navigate("/" + target);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}
