"use client";

// Orthogonality assessment panel — Tailwind/token-driven.
import * as React from "react";
import type { Signal } from "@/lib/types";
import { cn } from "@/lib/utils";
import { assessIndependence, type AssessState } from "./axis-data";

interface Theme {
  wrap: string; // bg + border color (literal classes for JIT)
  borderTop: string; // matching top-border color
  iconStroke: string; // svg stroke hex
  dotBg: string; // rationale bullet bg
  head: string; // heading text color class
  body: string; // body text color class
  heading: string;
  bodyText: string;
  suggest?: string;
}

const THEME: Record<AssessState, Theme> = {
  independent: {
    wrap: "bg-[#ECFDF5] border-[rgba(16,185,129,0.4)]",
    borderTop: "border-t-[rgba(16,185,129,0.4)]",
    iconStroke: "#10B981",
    dotBg: "bg-[#10B981]",
    head: "text-[#065F46]",
    body: "text-[#065F46]",
    heading: "Independent axes ✓",
    bodyText: "These two uncertainties appear to resolve independently. Good axis pairing.",
  },
  correlated: {
    wrap: "bg-[#FFFBEB] border-[rgba(245,158,11,0.4)]",
    borderTop: "border-t-[rgba(245,158,11,0.4)]",
    iconStroke: "#F59E0B",
    dotBg: "bg-[#F59E0B]",
    head: "text-[#92400E]",
    body: "text-[#92400E]",
    heading: "Axes may be correlated ⚠",
    bodyText:
      "These two uncertainties often move together. Scenarios built on correlated axes can lose distinctiveness. Consider swapping one.",
    suggest: "Suggest a more independent pair →",
  },
  uncertain: {
    wrap: "bg-bg border-border",
    borderTop: "border-t-border",
    iconStroke: "#6B7280",
    dotBg: "bg-[#6B7280]",
    head: "text-brand-dark",
    body: "text-muted-foreground",
    heading: "Independence unclear",
    bodyText:
      "Not enough signal data to assess correlation. Add more signals related to both axes to improve this check.",
  },
};

export function IndependenceAssessment({ signals, library }: { signals: Signal[]; library: Signal[] }) {
  const result = assessIndependence(signals, library);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    if (result) {
      const t = setTimeout(() => setMounted(true), 10);
      return () => clearTimeout(t);
    }
    setMounted(false);
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result ? result.state : null, !!result]);

  if (!result) return null;

  const t = THEME[result.state];

  const renderIcon = () => {
    if (result.state === "independent") {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    }
    if (result.state === "correlated") {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    }
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={t.iconStroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  };

  return (
    <div
      className={cn(
        "mt-2.5 rounded-[10px] border p-3 transition-[opacity,transform] duration-200",
        t.wrap,
        mounted ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      )}
    >
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-start gap-2 border-0 bg-transparent p-0 text-left">
        <span className="mt-px flex-shrink-0">{renderIcon()}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={cn("text-[13px] font-medium", t.head)}>{t.heading}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={cn("ml-auto flex-shrink-0 opacity-60 transition-transform duration-150", t.head, open && "rotate-180")}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
          <span className={cn("mt-[3px] block text-xs leading-[1.5] [text-wrap:pretty]", t.body)}>{t.bodyText}</span>
        </span>
      </button>

      {t.suggest && (
        <button
          onClick={(e) => e.stopPropagation()}
          className="ml-6 mt-2 border-0 bg-transparent p-0 text-xs font-medium text-[#F59E0B]"
        >
          {t.suggest}
        </button>
      )}

      {/* Details drawer */}
      {open && (
        <div className={cn("slide-up ml-6 mt-2.5 border-t pt-[9px]", t.borderTop)}>
          <div className={cn("mb-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.04em]", t.head)}>
            Why this assessment?
          </div>
          <ul className="m-0 flex list-none flex-col gap-[5px] p-0">
            {result.rationale.map((r, i) => (
              <li key={i} className={cn("flex gap-[7px] text-xs leading-[1.45]", t.body)}>
                <span className={cn("mt-1.5 h-1 w-1 flex-shrink-0 rounded-full", t.dotBg)} />
                <span className="flex-1 [text-wrap:pretty]">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
