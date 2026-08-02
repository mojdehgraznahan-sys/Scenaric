"use client";

// Scenario Canvas — 2×2 with the 4 named scenarios. Faithful Tailwind/shadcn port of
// the handoff page-canvas.jsx. Per-scenario colors stay inline (dynamic theming).
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { ReAxisModal } from "@/components/matrix/modals";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import type { Scenario, Quadrant } from "@/lib/types";

const REAX_BADGE_MS = 7 * 24 * 60 * 60 * 1000;

export function PageCanvas() {
  const store = useStore();
  const scenarios = store.scenarios;
  const navigate = useNavigate();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const [reaxisOpen, setReaxisOpen] = React.useState(false);

  const isRecentlyReaxed = (s: Scenario) => !!s.reaxedAt && Date.now() - s.reaxedAt < REAX_BADGE_MS;
  const fmtReaxDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // Quadrant placement by the scenario's own quadrant field; archived ones drop out.
  const active = scenarios.filter((s) => !s.archived);
  const byQuad = (q: Quadrant) => active.find((s) => s.quadrant === q);
  const map: Record<Quadrant, Scenario | undefined> = {
    TL: byQuad("TL") || active[2],
    TR: byQuad("TR") || active[0],
    BL: byQuad("BL") || active[3],
    BR: byQuad("BR") || active[1],
  };
  const archived = scenarios.filter((s) => s.archived);

  // Route into Storyline with this scenario pre-selected (persistent key).
  const openStoryline = (s: Scenario) => {
    try {
      localStorage.setItem("fm.storylineScenario", JSON.stringify(s.id));
    } catch {}
    navigate("/storyline");
  };

  const ScenarioCard = ({ s, pos }: { s?: Scenario; pos: Quadrant }) => {
    if (!s) {
      return (
        <div className="flex min-h-[150px] flex-col items-start justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-border bg-[#FAFAFA] p-[18px]">
          <span className="rounded-full bg-border px-[9px] py-[3px] text-[10px] font-semibold tracking-[0.06em] text-muted-foreground">
            {pos}
          </span>
          <div className="text-[13px] text-text-3">No scenario in this quadrant yet.</div>
        </div>
      );
    }
    const isHover = hovered === s.id;
    return (
      <div
        onMouseEnter={() => setHovered(s.id)}
        onMouseLeave={() => setHovered(null)}
        onClick={() => openStoryline(s)}
        className="relative flex cursor-pointer flex-col gap-2 rounded-[14px] border-2 bg-white p-[18px] transition-[transform,box-shadow,border-color] duration-150"
        style={{
          borderColor: isHover ? s.color : `${s.color}40`,
          transform: isHover ? "scale(1.01) translateY(-2px)" : "none",
          boxShadow: isHover ? "0 10px 26px rgba(15,23,42,0.10)" : "none",
        }}
      >
        <div className="flex items-center justify-between">
          <span
            className="rounded-full px-[9px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.06em] text-white"
            style={{ background: s.color }}
          >
            {pos}
          </span>
          <span className="font-mono text-[11px] text-text-3">{scenarios.indexOf(s) + 1}/4</span>
        </div>
        <div className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.015em] text-brand-dark">
          {s.name}
          {isRecentlyReaxed(s) && (
            <span className="whitespace-nowrap rounded-full bg-brand-orangeLight px-[7px] py-px font-mono text-[10px] font-semibold tracking-[0.03em] text-brand-orange">
              Re-axed {fmtReaxDate(s.reaxedAt!)}
            </span>
          )}
        </div>
        <div className="text-xs font-medium" style={{ color: s.color }}>
          {s.tagline}
        </div>
        <div className="text-[12.5px] leading-[1.5] text-muted-foreground">{s.summary}</div>

        {/* Primary + secondary actions */}
        <div className="mt-auto flex flex-col items-start gap-1 pt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openStoryline(s);
            }}
            className={"border-0 bg-transparent p-0 text-xs font-medium" + (isHover ? " underline" : "")}
            style={{ color: s.color }}
          >
            Open storyline →
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate("/narrative");
            }}
            className="border-0 bg-transparent p-0 text-xs font-normal text-muted-foreground transition-colors hover:text-brand-dark"
          >
            View narrative
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Scenario Canvas</h2>
            <div className="mt-0.5 text-[13px] text-muted-foreground">
              Four coherent futures from your two critical uncertainties.
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReaxisOpen(true)}>
              <Icons.Refresh size={12} /> Re-axis
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate("/narrative")}>
              Develop narratives <Icons.ArrowRight size={12} />
            </Button>
          </div>
        </div>

        {/* Axis labels + grid */}
        <div className="relative px-14 py-8">
          <div className="absolute left-1/2 top-1 -translate-x-1/2 font-mono text-[11px] font-medium tracking-[0.04em] text-brand-dark">
            ↑ GEOPOLITICAL ALIGNMENT
          </div>
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[11px] tracking-[0.04em] text-text-3">
            FRAGMENTATION ↓
          </div>
          <div className="absolute left-1 top-1/2 font-mono text-[11px] tracking-[0.04em] text-text-3 [transform:translateY(-50%)_rotate(-90deg)] [transform-origin:left_center]">
            CLOSED MARKETS ←
          </div>
          <div className="absolute right-1 top-1/2 font-mono text-[11px] font-medium tracking-[0.04em] text-brand-dark [transform:translateY(-50%)_rotate(90deg)] [transform-origin:right_center]">
            → OPEN MARKETS
          </div>

          <div className="relative grid grid-cols-2 gap-4">
            <ScenarioCard s={map.TL} pos="TL" />
            <ScenarioCard s={map.TR} pos="TR" />
            <ScenarioCard s={map.BL} pos="BL" />
            <ScenarioCard s={map.BR} pos="BR" />
          </div>
        </div>

        {/* AI nudge */}
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-brand-orange100 bg-brand-orangeLight p-3.5">
          <Icons.Sparkle size={16} stroke="#F97316" />
          <div className="flex-1 text-[13px] text-brand-orange700">
            <strong>Pacific Connector</strong> is your most optimistic scenario. Test your strategy against the others
            first — Bamboo Curtain has the highest downside risk.
          </div>
          <Button variant="soft" size="sm">
            Stress test
          </Button>
        </div>
      </div>

      {/* Past scenarios (archived via re-axis) */}
      {archived.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-card p-[18px] shadow-card">
          <div className="mb-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-text-3">
            Past scenarios
          </div>
          <div className="flex flex-col gap-1.5">
            {archived.map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 rounded-md border border-[#F3F4F6] bg-[#FAFAFA] px-2.5 py-2">
                <span className="h-2 w-2 flex-shrink-0 rounded-full opacity-60" style={{ background: s.color }} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-muted-foreground">{s.name}</div>
                  <div className="truncate text-[11px] text-text-3">{s.tagline}</div>
                </div>
                <button
                  onClick={() => {
                    store.archiveScenario(s.id, false).catch((err) => console.error("[canvas] failed to restore scenario", err));
                  }}
                  className="flex-shrink-0 border-0 bg-transparent text-xs font-medium text-brand-orange"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Re-axis migration modal */}
      <ReAxisModal open={reaxisOpen} onClose={() => setReaxisOpen(false)} navigate={navigate} />
    </div>
  );
}
