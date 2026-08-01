"use client";

// Critical-uncertainty selection row — Tailwind/token-driven.
import * as React from "react";
import type { MatrixDot, Signal } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Pick {
  sigId: string;
  title: string;
}

export function CriticalUncertaintyRow({
  dot,
  sig,
  isOn,
  isLockedAxis = false,
  atCapacity,
  currentPicks,
  onToggle,
  onReplace,
  onViewStoryline,
}: {
  dot: MatrixDot;
  sig?: Signal;
  isOn: boolean;
  // True once this signal is one of the 2 locked scenario axes — independence-checked and
  // passed, not just selected. Mirrors page-matrix.tsx's axesLocked gate on the plotted dot,
  // so the "this is a locked axis" state reads identically everywhere the signal appears.
  isLockedAxis?: boolean;
  atCapacity: boolean;
  currentPicks: Pick[];
  onToggle: () => void;
  onReplace: (removeId: string) => void;
  onViewStoryline?: () => void;
}) {
  const [hover, setHover] = React.useState(false);
  const [replaceOpen, setReplaceOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const title = (sig && sig.title) || dot.label;

  React.useEffect(() => {
    if (!replaceOpen) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setReplaceOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReplaceOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [replaceOpen]);

  const handleClick = () => {
    if (isOn) {
      onToggle();
      return;
    }
    if (atCapacity) {
      setReplaceOpen(true);
      return;
    }
    onToggle();
  };

  const showReveal = hover && !replaceOpen;

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "relative mb-1.5 rounded-lg px-2.5 py-[7px] transition-[border-color,box-shadow]",
        isOn ? "border-[1.5px] border-brand-orange bg-white" : "border border-brand-orange100 bg-white/50",
        // Second outer halo once this pick is independence-checked and locked (see
        // page-matrix.tsx's axesLocked) — same ring treatment as the plotted dot's "axis" state.
        isLockedAxis && "shadow-[0_0_0_3px_rgba(249,115,22,0.2)]"
      )}
    >
      <button
        onClick={handleClick}
        className="flex w-full items-center gap-2 border-0 bg-transparent p-0 text-left text-xs font-medium text-brand-dark"
      >
        {/* Checkbox */}
        <span
          className={cn(
            "inline-flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded border-[1.5px]",
            isOn ? "border-brand-orange bg-brand-orange" : "border-border-strong bg-white"
          )}
        >
          {isOn && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: dot.color }} />
        <span className="flex-1 truncate">{title}</span>
        {isLockedAxis && (
          <span className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-[0.4px] text-brand-orange">Axis</span>
        )}
      </button>

      <div
        className={cn(
          "overflow-hidden transition-[height,opacity,margin-top] duration-150",
          showReveal ? "mt-1 h-[18px] opacity-100" : "mt-0 h-0 opacity-0"
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onViewStoryline) onViewStoryline();
          }}
          className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs font-medium text-brand-orange"
        >
          → View storyline
        </button>
      </div>

      {/* Replace popover */}
      {replaceOpen && (
        <div className="slide-up absolute left-0 right-0 top-[calc(100%+4px)] z-40 rounded-[10px] border border-border bg-white p-3 shadow-[0_12px_30px_rgba(15,23,42,0.14)]">
          <div className="mb-2 text-xs font-medium leading-[1.4] text-brand-dark">
            You can pick 2 axes. Replace which one?
          </div>
          <div className="flex flex-col gap-1.5">
            {(currentPicks || []).map((p) => (
              <button
                key={p.sigId}
                onClick={() => {
                  onReplace(p.sigId);
                  setReplaceOpen(false);
                }}
                className="flex w-full items-center gap-[7px] rounded-[7px] border border-border bg-white px-[9px] py-[7px] text-left text-xs text-brand-dark transition-[border-color,background] [transition-duration:120ms] hover:border-brand-orange hover:bg-brand-orangeLight"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span className="truncate">{p.title}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setReplaceOpen(false)} className="mt-2 border-0 bg-transparent p-0 text-xs text-muted-foreground">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
