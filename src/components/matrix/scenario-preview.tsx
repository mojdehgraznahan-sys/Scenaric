"use client";

// Live 2×2 scenario preview — Tailwind/token-driven.
import * as React from "react";
import type { Signal, Quadrant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { axisMeta, pickNames } from "./axis-data";

// Per-quadrant tint + accent color as literal Tailwind classes (so JIT keeps them).
const QUAD_STYLE: Record<Quadrant, { tint: string; color: string }> = {
  TL: { tint: "bg-[#EFF6FF]", color: "text-[#3B82F6]" },
  TR: { tint: "bg-[#FFF7ED]", color: "text-[#F97316]" },
  BL: { tint: "bg-[#FEF2F2]", color: "text-[#EF4444]" },
  BR: { tint: "bg-[rgba(245,243,255,0.6)]", color: "text-[#8B5CF6]" },
};

export function ScenarioPreview({ signals }: { signals: Signal[] }) {
  const ready = signals && signals.length === 2;
  const [regen, setRegen] = React.useState(0);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (ready) {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }
    setMounted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, signals ? signals.map((s) => s.id).join("|") : ""]);

  // Empty state — greyed 2×2 with overlay.
  if (!ready) {
    return (
      <div className="mt-2.5 rounded-[10px] border border-border bg-white p-4">
        <div className="mb-3 font-mono text-[13px] font-medium uppercase tracking-[0.6px] text-muted-foreground">
          Scenario preview
        </div>
        <div className="relative grid aspect-square grid-cols-2 grid-rows-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-md bg-bg" />
          ))}
          <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[11px] text-muted-foreground">
            Select 2 axes to preview scenarios
          </div>
        </div>
      </div>
    );
  }

  const [aSig, bSig] = signals; // A = vertical (first), B = horizontal (second)
  const a = axisMeta(aSig);
  const b = axisMeta(bSig);
  const correlated = aSig.category === bSig.category;

  const seedStr = aSig.id + "|" + bSig.id + "|" + regen;
  const names = pickNames(seedStr, 4);

  const quads: Record<Quadrant, { combo: string; name: string; tag?: string }> = {
    TL: { combo: `${a.pos} + ${b.neg}`, name: names[0] },
    TR: { combo: `${a.pos} + ${b.pos}`, name: names[1], tag: "Best case" },
    BL: { combo: `${a.neg} + ${b.neg}`, name: names[2] },
    BR: { combo: `${a.neg} + ${b.pos}`, name: names[3] },
  };
  const order: Quadrant[] = ["TL", "TR", "BL", "BR"];

  // Plausibility: correlated axes make one corner self-contradictory.
  const implausibleQuad: Quadrant | null = correlated ? "BL" : null;

  return (
    <div
      className={cn(
        "mt-2.5 rounded-[10px] border border-border bg-white p-4 transition-[opacity,transform] duration-200",
        mounted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      )}
    >
      <div className="mb-3 font-mono text-[13px] font-medium uppercase tracking-[0.6px] text-muted-foreground">
        Scenario preview
      </div>

      {/* Grid + axis labels */}
      <div className="flex gap-1.5">
        {/* Vertical axis label */}
        <div className="flex w-4 items-center justify-center">
          <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.6px] text-muted-foreground [writing-mode:vertical-rl] [transform:rotate(180deg)]">
            {a.axis}
          </span>
        </div>

        <div className="flex-1">
          <div className="grid aspect-square grid-cols-2 grid-rows-2 gap-1.5">
            {order.map((q) => {
              const Q = quads[q];
              const S = QUAD_STYLE[q];
              const flagged = implausibleQuad === q;
              return (
                <div
                  key={q}
                  className={cn(
                    "relative flex flex-col gap-1 rounded-md border p-2.5",
                    S.tint,
                    flagged ? "border-dashed border-[#F59E0B]" : "border-transparent"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className={cn("text-[10px] font-semibold", S.color)}>{q}</span>
                    {Q.tag && (
                      <span className={cn("font-mono text-[8.5px] font-semibold uppercase tracking-[0.04em]", S.color)}>
                        {Q.tag}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] leading-[1.3] text-brand-dark">{Q.combo}</div>
                  <div className="mt-auto text-[10px] italic text-muted-foreground">{Q.name}</div>
                </div>
              );
            })}
          </div>
          {/* Horizontal axis label */}
          <div className="mt-1.5 text-center">
            <span className="text-[10px] uppercase tracking-[0.6px] text-muted-foreground">{b.axis}</span>
          </div>
        </div>
      </div>

      {/* Regenerate */}
      <button
        onClick={() => setRegen((r) => r + 1)}
        className="mt-2 inline-flex items-center gap-[5px] border-0 bg-transparent p-0 text-xs font-medium text-brand-orange"
      >
        <span className="text-[13px] leading-none">↻</span> Regenerate scenario names
      </button>

      {/* Plausibility check */}
      <div className="mt-2">
        {implausibleQuad ? (
          <span
            title="Correlated axes can produce a self-contradictory corner — review whether this future is story-able."
            className="cursor-help text-[11px] text-[#F59E0B] hover:underline"
          >
            One quadrant may be implausible — review {implausibleQuad} ⚠
          </span>
        ) : (
          <span className="text-[11px] text-[#10B981]">All four quadrants are plausible ✓</span>
        )}
      </div>
    </div>
  );
}
