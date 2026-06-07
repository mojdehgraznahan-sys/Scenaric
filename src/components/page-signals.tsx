"use client";

// Signals Library — faithful Tailwind/shadcn port of the handoff page-signals.jsx.
import * as React from "react";
import { Icons, Stars } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/chip";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import type { Signal, SteepCategory } from "@/lib/types";

const CATEGORIES: Array<"All" | SteepCategory> = ["All", "Social", "Technology", "Economic", "Ecological", "Political"];

// Filter-pill classes (literal strings so Tailwind JIT keeps them).
const PILL: Record<string, { active: string; inactive: string }> = {
  All: { active: "bg-brand-orange text-white border-brand-orange", inactive: "bg-white text-muted-foreground border-border" },
  Social: { active: "bg-steep-social text-white border-steep-social", inactive: "bg-[#F5F3FF] text-steep-social border-[rgba(139,92,246,0.4)]" },
  Technology: { active: "bg-steep-technology text-white border-steep-technology", inactive: "bg-[#EFF6FF] text-steep-technology border-[rgba(59,130,246,0.4)]" },
  Economic: { active: "bg-steep-economic text-white border-steep-economic", inactive: "bg-[#ECFDF5] text-steep-economic border-[rgba(16,185,129,0.4)]" },
  Ecological: { active: "bg-steep-ecological text-white border-steep-ecological", inactive: "bg-[#F0FDFA] text-steep-ecological border-[rgba(20,184,166,0.4)]" },
  Political: { active: "bg-steep-political text-white border-steep-political", inactive: "bg-[#FEF2F2] text-steep-political border-[rgba(239,68,68,0.4)]" },
};

function uncertaintyBadge(u: Signal["uncertainty"]) {
  if (u === "High") return "bg-brand-orangeLight text-brand-orange700";
  if (u === "Medium") return "bg-[#FFFBEB] text-[#B45309]";
  return "bg-[#ECFDF5] text-[#065F46]";
}

const BADGE_BASE = "inline-flex items-center rounded px-[7px] py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]";

export function PageSignals() {
  const store = useStore();
  const signals = store.signals;
  const navigate = useNavigate();
  const [filter, setFilter] = React.useState<"All" | SteepCategory>("All");
  const [selected, setSelected] = React.useState<Signal | null>(null);

  const filtered = filter === "All" ? signals : signals.filter((s) => s.category === filter);

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      <div className="rounded-xl border border-border bg-card p-[18px] shadow-card">
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Signals Library</h2>
            <div className="mt-0.5 text-[13px] text-muted-foreground">
              STEEP forces. Rank by impact and uncertainty to find scenario axes.
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm">
              <Icons.Filter size={12} /> Sort
            </Button>
            <Button variant="primary" size="sm">
              <Icons.Plus size={12} /> Add Signal
            </Button>
          </div>
        </div>

        {/* Filter pills */}
        <div className="mb-[18px] flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const active = filter === c;
            return (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn("rounded-full border px-3 py-[5px] text-xs font-medium", active ? PILL[c].active : PILL[c].inactive)}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelected(s)}
              className="flex cursor-pointer flex-col gap-2 rounded-[10px] border border-border bg-white p-3.5 transition-[border,transform] duration-[120ms] hover:border-border-strong"
            >
              <div className="flex items-center justify-between">
                <Chip category={s.category} />
                <span className="font-mono text-[10.5px] text-text-3">{s.source}</span>
              </div>
              <div className="text-sm font-semibold leading-[1.3] tracking-[-0.01em] text-brand-dark">{s.title}</div>
              <div className="flex-1 text-[12.5px] leading-[1.5] text-muted-foreground">{s.body}</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="font-mono text-[11px] text-text-3">IMPACT</span>
                <Stars value={s.impact} size={11} />
                <span className={cn("ml-auto", BADGE_BASE, uncertaintyBadge(s.uncertainty))}>{s.uncertainty}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5">
                <Button
                  variant="soft"
                  size="sm"
                  className="flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/matrix");
                  }}
                >
                  + Add to Matrix
                </Button>
                <Button variant="ghost" size="sm" className="p-1.5" onClick={(e) => e.stopPropagation()}>
                  <Icons.MoreH size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-[540px] rounded-2xl p-6">
            <div className="mb-3">
              <Chip category={selected.category} />
            </div>
            <DialogTitle className="mb-1.5 text-xl font-semibold tracking-[-0.01em]">{selected.title}</DialogTitle>
            <div className="mb-3.5 font-mono text-[11.5px] text-text-3">SOURCE · {selected.source.toUpperCase()}</div>
            <p className="mb-[18px] text-sm leading-[1.6] text-[#374151]">{selected.body}</p>
            <div className="mb-[18px] grid grid-cols-2 gap-3">
              <div className="rounded-[10px] border border-border p-3">
                <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">IMPACT</div>
                <div className="mt-1.5 flex items-center gap-1">
                  <Stars value={selected.impact} size={14} />
                  <span className="ml-1 text-[13px] font-semibold">{selected.impact}/5</span>
                </div>
              </div>
              <div className="rounded-[10px] border border-border p-3">
                <div className="font-mono text-[10.5px] tracking-[0.06em] text-text-3">UNCERTAINTY</div>
                <div className="mt-1.5">
                  <span className={cn(BADGE_BASE, "text-[11px]", uncertaintyBadge(selected.uncertainty))}>
                    {selected.uncertainty}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  setSelected(null);
                  navigate("/matrix");
                }}
              >
                Place on matrix →
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
