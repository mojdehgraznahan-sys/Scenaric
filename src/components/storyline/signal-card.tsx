"use client";

// SignalCard — the timeline node component used on the Storyline canvas.
// States: default, hover, selected, dragging, placeholder, dimmed. Drag/arrow
// protocol is pointer-driven and owned by the canvas. Faithful port of signal-card.jsx;
// dynamic per-state border/shadow stay inline.
import * as React from "react";
import { Chip } from "@/components/chip";
import { CARD_W, type StoryNode } from "./data";

const CARD_MIN_H = 140;

const UNCERTAINTY_STYLE: Record<string, { bg: string; fg: string }> = {
  High: { bg: "#FEF2F2", fg: "#EF4444" },
  Medium: { bg: "#FFFBEB", fg: "#F59E0B" },
  Low: { bg: "#ECFDF5", fg: "#10B981" },
};

export function ImpactStars({ value = 0, max = 5, size = 11 }: { value?: number; max?: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Impact ${value} of ${max}`}>
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i < value ? "#F97316" : "#E5E7EB"} stroke="none">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  );
}

export interface SignalCardProps {
  node: StoryNode;
  selected?: boolean;
  dim?: boolean;
  dragging?: boolean;
  isDropTarget?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  onCardPointerDown?: (e: React.PointerEvent) => void;
  onConnectorPointerDown?: (e: React.PointerEvent) => void;
  accentColor?: string;
}

export const SignalCard = React.forwardRef<HTMLDivElement, SignalCardProps>(function SignalCard(props, ref) {
  const {
    node,
    selected = false,
    dim = false,
    dragging = false,
    isDropTarget = false,
    onClick,
    onEdit,
    onCardPointerDown,
    onConnectorPointerDown,
    accentColor = "#F97316",
  } = props;

  const [hover, setHover] = React.useState(false);
  const u = UNCERTAINTY_STYLE[node.uncertainty || "Medium"] || UNCERTAINTY_STYLE.Medium;

  // Resolve border + shadow per state.
  let borderColor = "#E5E7EB";
  let borderWidth = 1;
  let boxShadow = "none";
  if (selected) {
    borderColor = accentColor;
    borderWidth = 2;
    boxShadow = `0 0 0 2px ${accentColor}33, 0 4px 12px rgba(15,23,42,0.06)`;
  } else if (isDropTarget) {
    borderColor = accentColor;
    borderWidth = 2;
    boxShadow = `0 0 0 4px ${accentColor}26, 0 4px 14px rgba(15,23,42,0.10)`;
  } else if (hover && !dragging) {
    borderColor = accentColor;
    borderWidth = 1;
    boxShadow = "0 4px 14px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.04)";
  }

  const opacity = dragging ? 0 : dim ? 0.4 : 1;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (onCardPointerDown) onCardPointerDown(e);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (onClick) onClick();
        }
      }}
      data-signal-card={node.id}
      className="relative flex select-none flex-col gap-2 rounded-[10px] bg-white"
      style={{
        width: CARD_W,
        minHeight: CARD_MIN_H,
        border: `${borderWidth}px solid ${borderColor}`,
        padding: borderWidth === 2 ? 15 : 16,
        boxShadow,
        opacity,
        transition: "border-color .15s ease, box-shadow .15s ease, opacity .15s ease, transform .3s cubic-bezier(.4,0,.2,1)",
        cursor: dragging ? "grabbing" : hover ? "grab" : "pointer",
        touchAction: "none",
        animation: isDropTarget ? "fmDropPulse 1s ease-in-out infinite" : "none",
      }}
    >
      {/* Drag handle (visual only; the whole card is the drag handle) */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground transition-opacity duration-[120ms]"
        style={{ opacity: hover && !dragging ? 1 : 0 }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="5" r="1" />
          <circle cx="9" cy="12" r="1" />
          <circle cx="9" cy="19" r="1" />
          <circle cx="15" cy="5" r="1" />
          <circle cx="15" cy="12" r="1" />
          <circle cx="15" cy="19" r="1" />
        </svg>
      </div>

      {/* Right-edge connector "+" — start a new outgoing arrow */}
      <button
        title="Drag to connect to another signal"
        aria-label="Create connection"
        onPointerDown={(e) => {
          e.stopPropagation();
          if (onConnectorPointerDown) onConnectorPointerDown(e);
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-[-10px] top-1/2 z-[6] flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-brand-orange p-0 text-white shadow-[0_2px_8px_rgba(249,115,22,0.45)] transition-[opacity,transform] duration-150"
        style={{
          cursor: "crosshair",
          opacity: hover && !dragging ? 1 : 0,
          pointerEvents: hover && !dragging ? "auto" : "none",
          touchAction: "none",
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {/* Row 1 — STEEP pill + source */}
      <div className="flex items-center justify-between gap-2" style={{ paddingRight: hover ? 14 : 0 }}>
        <Chip category={node.cat} />
        <span className="max-w-[100px] truncate font-mono text-[10px] tracking-[0.02em] text-muted-foreground">
          {node.source || node.year}
        </span>
      </div>

      {/* Row 2 — title (2 lines) */}
      <div className="overflow-hidden text-sm font-semibold leading-[1.3] tracking-[-0.005em] text-brand-dark [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
        {node.title}
      </div>

      {/* Row 3 — body (2 lines) */}
      <div className="flex-1 overflow-hidden text-xs leading-[1.5] text-muted-foreground [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
        {node.body}
      </div>

      {/* Row 4 — impact stars + uncertainty */}
      <div className="mt-0.5 flex min-h-[22px] items-center gap-2">
        <ImpactStars value={node.impact || 3} />
        <span
          className="ml-auto rounded-full px-[7px] py-0.5 text-[10px] font-semibold tracking-[0.02em]"
          style={{ background: u.bg, color: u.fg }}
        >
          {node.uncertainty || "Medium"}
        </span>
      </div>

      {/* Hover-revealed action row */}
      <div
        className="-mt-0.5 overflow-hidden transition-[height,opacity] duration-[120ms]"
        style={{ height: hover && !dragging ? 16 : 0, opacity: hover && !dragging ? 1 : 0 }}
      >
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (onEdit) onEdit();
          }}
          className="inline-flex items-center gap-1 border-0 bg-transparent p-0 text-[11.5px] font-medium text-brand-orange"
        >
          Edit chain
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </button>
      </div>
    </div>
  );
});

export function SignalCardPlaceholder({ label = "Drop signal here" }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-brand-orange100 bg-[rgba(255,247,237,0.4)] text-xs font-medium tracking-[0.02em] text-brand-orange700"
      style={{ width: CARD_W, minHeight: CARD_MIN_H }}
    >
      {label}
    </div>
  );
}
