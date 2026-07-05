"use client";

// TopBar — Tailwind/token-driven. Hidden on storyline/matrix/narrative (full-bleed pages);
// the (app) shell decides when to render it.
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import type { Navigate } from "@/lib/use-navigate";

// Breadcrumb labels for the TopBar's left segment (short trail, not the page's own
// large title). Each page still renders its own big heading below the TopBar.
const TITLES: Record<string, string> = {
  home: "Home",
  dashboard: "Home",
  knowledge: "Knowledge Base",
  signals: "Signals Library",
  matrix: "Matrix",
  storyline: "Storyline",
  canvas: "Scenario Canvas",
  narrative: "Narrative",
  strategy: "Strategic Options",
  monitoring: "Monitoring",
  settings: "Settings",
};

export function TopBar({ page, navigate }: { page: string; navigate: Navigate }) {
  return (
    <div className="flex h-topbar flex-shrink-0 items-center gap-3 border-b border-border bg-white px-5">
      <div className="text-sm font-semibold tracking-[-0.01em]">{TITLES[page] || "Scenaric"}</div>
      <div className="ml-2 flex items-center gap-1 font-mono text-xs text-text-3">
        <span>/</span>
        <span>APAC Expansion 2030</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div className="relative">
          <Icons.Search size={14} stroke="#9CA3AF" className="absolute left-2.5 top-[9px]" />
          <input
            placeholder="Search…"
            className="h-8 w-[220px] rounded-md border border-border bg-white pl-[30px] pr-3 text-sm outline-none transition-[border,box-shadow] duration-150 placeholder:text-text-3 focus:border-brand-orange focus:shadow-[0_0_0_3px_rgba(249,115,22,0.2)]"
          />
        </div>
        <Button variant="ghost" size="sm" className="relative h-8 w-8 p-[7px]">
          <Icons.Bell size={14} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand-orange" />
        </Button>
        {/* Signals page has its own "Add Signal" CTA — suppress the global one there to avoid a duplicate. */}
        {page !== "signals" && (
          <Button variant="primary" size="sm" onClick={() => navigate("/signals")}>
            <Icons.Plus size={13} /> Add Signal
          </Button>
        )}
      </div>
    </div>
  );
}
