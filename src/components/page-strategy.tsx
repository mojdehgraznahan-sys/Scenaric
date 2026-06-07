"use client";

// Strategic Options — robustness grid. Faithful Tailwind/shadcn port of page-strategy.jsx.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Strategy } from "@/lib/types";

const BADGE_BASE = "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";
const GRID_COLS = "grid-cols-[minmax(260px,2fr)_repeat(4,1fr)_100px_90px]";

function riskBadge(risk: Strategy["risk"]) {
  if (risk === "Low") return "bg-[#ECFDF5] text-[#065F46]";
  if (risk === "Medium") return "bg-[#FFFBEB] text-[#B45309]";
  return "bg-brand-orangeLight text-brand-orange700";
}

export function PageStrategy() {
  const store = useStore();
  const strategies = store.strategies;
  const scenarios = store.scenarios;
  const [selected, setSelected] = React.useState<Strategy | null>(null);

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Strategic Options</h2>
            <div className="mt-0.5 text-[13px] text-muted-foreground">How robust is each option across your scenarios?</div>
          </div>
          <Button variant="primary" size="sm">
            <Icons.Sparkle size={12} /> Generate options
          </Button>
        </div>

        {/* Robustness grid */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className={cn("grid border-b border-border bg-[#F9FAFB] px-3.5 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground", GRID_COLS)}>
            <div>OPTION</div>
            {scenarios.map((s) => (
              <div key={s.id} className="flex flex-col items-center gap-1 text-center">
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] leading-[1.1]">
                  {s.name.split(" ").map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </span>
              </div>
            ))}
            <div className="text-center">RISK</div>
            <div className="text-center">COST</div>
          </div>

          {strategies.map((st, i) => (
            <div
              key={st.id}
              onClick={() => setSelected(st)}
              className={cn("grid cursor-pointer items-center px-3.5 py-3.5 hover:bg-[#FAFAFA]", GRID_COLS, i < strategies.length - 1 && "border-b border-[#F3F4F6]")}
            >
              <div>
                <div className="text-sm font-semibold text-brand-dark">{st.name}</div>
                <div className="mt-0.5 text-xs leading-[1.45] text-muted-foreground">{st.notes}</div>
              </div>
              {scenarios.map((s) => {
                const robust = st.robustIn.includes(s.name);
                return (
                  <div key={s.id} className="flex justify-center">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold",
                        robust ? "bg-[#ECFDF5] text-[#10B981]" : "bg-[#FEF2F2] text-[#EF4444]"
                      )}
                    >
                      {robust ? "✓" : "·"}
                    </span>
                  </div>
                );
              })}
              <div className="text-center">
                <span className={cn(BADGE_BASE, riskBadge(st.risk))}>{st.risk}</span>
              </div>
              <div className="text-center text-xs font-medium text-muted-foreground">{st.cost}</div>
            </div>
          ))}
        </div>

        {/* AI recommendation */}
        <div className="mt-4 rounded-xl border border-brand-orange100 bg-brand-orangeLight p-4">
          <div className="mb-1.5 flex items-center gap-2">
            <Icons.Sparkle size={14} stroke="#F97316" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-orange700">AI Recommendation</span>
          </div>
          <div className="text-sm leading-[1.6] text-brand-dark">
            <strong>Federated regional architecture</strong> is robust across 2 scenarios with low risk. Combine with{" "}
            <strong>JV-first market entry</strong> to cover all 4 futures. This pairing minimises downside in Bamboo
            Curtain while capturing 80% of Pacific Connector upside.
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-[540px] p-6">
            <div className="mb-3">
              <div className="font-mono text-[11px] tracking-[0.06em] text-text-3">STRATEGIC OPTION</div>
            </div>
            <DialogTitle className="mb-1.5 text-[22px] font-semibold tracking-[-0.015em]">{selected.name}</DialogTitle>
            <p className="mb-[18px] text-sm leading-[1.55] text-muted-foreground">{selected.notes}</p>
            <div className="mb-3.5">
              <div className="mb-2 font-mono text-[11px] tracking-[0.06em] text-text-3">ROBUST IN</div>
              <div className="flex flex-wrap gap-1.5">
                {selected.robustIn.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(16,185,129,0.25)] bg-[#ECFDF5] px-[9px] py-[3px] text-[11px] font-medium text-[#065F46]"
                  >
                    ✓ {name}
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-[18px] grid grid-cols-2 gap-2.5">
              <div className="rounded-[10px] border border-border p-3">
                <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">RISK</div>
                <div className="mt-1.5">
                  <span className={cn(BADGE_BASE, riskBadge(selected.risk))}>{selected.risk}</span>
                </div>
              </div>
              <div className="rounded-[10px] border border-border p-3">
                <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">COST</div>
                <div className="mt-1.5 text-[13px] font-semibold">{selected.cost}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" className="flex-1">
                Mark as primary
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
