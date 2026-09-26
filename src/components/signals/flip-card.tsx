"use client";

// Signals page "Events" view — flip mechanics, ported from the design prototype's
// components/events.jsx FlipCard. Two additions beyond the literal prototype (which had
// neither, despite the build plan requiring both): prefers-reduced-motion (swap instantly, no
// rotation) and keyboard support (focusable, Enter/Space flips) — see scenaric.pdf's Prompt D/F.
import * as React from "react";

export interface FlipCardProps {
  id: string;
  flipped: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
  focused?: boolean;
  onFlip: () => void;
}

export function FlipCard({ id, flipped, front, back, focused, onFlip }: FlipCardProps) {
  const [reducedMotion, setReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <div
      data-card-id={id}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFlip();
        }
      }}
      className="rounded-[10px] outline-none transition-shadow duration-200"
      style={{
        perspective: 1200,
        boxShadow: focused ? "0 0 0 2px #F97316, 0 0 0 6px rgba(249,115,22,.18)" : "none",
      }}
    >
      <div
        className="grid h-full"
        style={{
          transformStyle: "preserve-3d",
          transition: reducedMotion ? "none" : "transform .45s cubic-bezier(.2,.7,.2,1)",
          transform: flipped ? "rotateY(180deg)" : "none",
        }}
      >
        <div
          className="flex"
          style={{ gridArea: "1/1", backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", pointerEvents: flipped ? "none" : "auto" }}
          aria-hidden={flipped}
        >
          {front}
        </div>
        <div
          className="flex"
          style={{
            gridArea: "1/1",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            pointerEvents: flipped ? "auto" : "none",
          }}
          aria-hidden={!flipped}
        >
          {back}
        </div>
      </div>
    </div>
  );
}

export function FlipHint({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-text-3">
      {label} ↻
    </span>
  );
}
