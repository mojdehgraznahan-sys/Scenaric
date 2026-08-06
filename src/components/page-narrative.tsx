"use client";

// Scenario Narratives — full reading view. Faithful Tailwind/shadcn port of
// the handoff page-narrative.jsx.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { ScenarioContextHeader } from "@/components/storyline/scenario-context-header";

const IMPLICATIONS = [
  "Capital allocation: shift 15-25% of growth budget to scenario-resilient bets",
  "Hiring: anchor leadership in Singapore; build local talent benches in 2 priority markets",
  "Tech stack: federated architecture with country-level data plane",
  "Partners: cultivate 1-2 strategic JV options per market as optionality",
];

export function PageNarrative() {
  const store = useStore();
  const scenarios = store.scenarios;
  const navigate = useNavigate();
  const [active, setActive] = React.useState((scenarios[0] && scenarios[0].id) || "sc1");
  const current = scenarios.find((s) => s.id === active) || scenarios[0];

  // Empty state — no scenarios built yet.
  if (!scenarios.length || !current) {
    return (
      <div className="scroll-y flex-1 overflow-y-auto p-5">
        <div className="rounded-xl border border-border bg-card p-7 shadow-card">
          <ScenarioContextHeader view="narrative" className="pt-0 pb-4" />
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-brand-orangeLight">
              <Icons.Edit3 size={22} stroke="#F97316" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-brand-dark">No scenarios yet</h3>
            <p className="mb-[18px] max-w-[360px] text-sm leading-[1.5] text-muted-foreground">
              Build your four scenarios from the Matrix, then come back to write their narratives.
            </p>
            <Button variant="primary" size="sm" onClick={() => navigate("/matrix")}>
              <Icons.Grid size={12} /> Go to Matrix
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="grid grid-cols-[240px_1fr] gap-4">
        {/* Scenarios list */}
        <div className="self-start rounded-xl border border-border bg-card p-3 shadow-card">
          <div className="px-1.5 pb-2 pt-1 font-mono text-[10.5px] tracking-[0.06em] text-text-3">4 SCENARIOS</div>
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "mb-0.5 flex w-full flex-col gap-[3px] rounded-md border-0 px-[11px] py-2.5 text-left",
                active === s.id ? "bg-bg" : "bg-transparent"
              )}
            >
              <div className="flex items-center gap-2">
                <span className="h-[9px] w-[9px] rounded-full" style={{ background: s.color }} />
                <span className="text-[13px] font-semibold text-brand-dark">{s.name}</span>
              </div>
              <div className="pl-[17px] text-[11.5px] text-muted-foreground">{s.tagline}</div>
            </button>
          ))}
        </div>

        {/* Narrative reading view */}
        <div className="rounded-xl border border-border bg-card p-7 shadow-card">
          <ScenarioContextHeader view="narrative" className="pt-0 pb-4" />
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="h-4 w-4 rounded-full" style={{ background: current.color }} />
              <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">
                Scenario · {scenarios.indexOf(current) + 1}/4
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">
                <Icons.Edit3 size={12} /> Edit
              </Button>
              <Button variant="soft" size="sm">
                <Icons.Sparkle size={12} /> Expand with AI
              </Button>
            </div>
          </div>

          <h1 className="mb-1.5 text-[32px] font-semibold tracking-[-0.025em] [text-wrap:balance]">{current.name}</h1>
          <div className="mb-[26px] text-sm font-medium" style={{ color: current.color }}>
            {current.tagline}
          </div>

          <p className="mb-[22px] text-[17px] italic leading-[1.6] text-[#374151] [text-wrap:pretty]">{current.summary}</p>

          <div className="mb-[22px] h-px bg-border" />

          <p className="m-0 text-[15px] leading-[1.75] text-brand-dark [text-wrap:pretty]">{current.narrative}</p>

          {/* Implications */}
          <div className="mt-8">
            <h3 className="mb-3 font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-text-3">Implications</h3>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {IMPLICATIONS.map((imp, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-[1.55] text-[#374151]">
                  <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: current.color }} />
                  <span className="flex-1">{imp}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-7 flex gap-2">
            <Button variant="primary" onClick={() => navigate("/strategy")}>
              See strategic options <Icons.ArrowRight size={14} />
            </Button>
            <Button variant="ghost" onClick={() => navigate("/monitoring")}>
              Track signposts
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
