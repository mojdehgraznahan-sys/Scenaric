"use client";

// Impact × Uncertainty Matrix — Tailwind/token-driven.
// Drag-to-rank uses @dnd-kit/core (free positioning): dots follow the cursor via the
// draggable transform and commit their new x/y % on drag end. A 3px pointer activation
// distance lets a plain click (no drag) select a top-right candidate as a scenario axis.
// Dynamic values (dot left/top %, color, dnd transform) stay inline; everything else
// is Tailwind utilities + tokens.
//
// Matrix backend build (Step 4-5, §7-§8): dots/signals are now real (store.matrixDots,
// store.signals) instead of the seed dataset — a dot's position is derived server-side from
// the signal's AI-scored (or user-overridden) impact/uncertainty. The Critical-Uncertainties
// panel is ranked by the real axis-candidates backend rather than raw insertion order, and
// the orthogonality check is a real AI call (see independence-assessment.tsx) instead of the
// old client-side hash.
import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useStore } from "@/lib/store";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { MatrixDot, Signal } from "@/lib/types";
import type { Navigate } from "@/lib/use-navigate";
import { getMatrixBuckets, type MatrixDotData, type MatrixBucketGroups } from "@/lib/actions/matrix";
import { DOT_MARGIN } from "@/lib/matrix-mapping";
import { checkAxisIndependence, type IndependenceResult } from "@/lib/actions/ai-matrix";
import { MethodologyInfo } from "./methodology-info";
import { IndependenceAssessment } from "./independence-assessment";
import { ScenarioPreview } from "./scenario-preview";
import { CriticalUncertaintyRow } from "./critical-uncertainty-row";
import { BuildScenariosModal, ReAxisModal } from "./modals";
import { ScenarioContextHeader } from "../storyline/scenario-context-header";

type DotState = "axis" | "topCandidate" | "candidate" | "predetermined" | "wildcard" | "background" | "unclassified";

// `critical` is the single source of truth for both the checkbox (CriticalUncertaintyRow)
// and this ring — PageMatrix keeps it auto-synced to the AI's top-2 ranking (topCandidateIds)
// until the user manually overrides it via a checkbox, or until it's axesLocked (see the sync
// effect in PageMatrix for the full rationale).
function dotState(d: MatrixDot, critical: string[], axesLocked: boolean): DotState {
  if (axesLocked && critical.includes(d.sigId)) return "axis";
  if (critical.includes(d.sigId)) return "topCandidate";
  if (d.bucket === "critical_uncertainty") return "candidate";
  if (d.bucket === "predetermined") return "predetermined";
  if (d.bucket === "wildcard") return "wildcard";
  if (d.bucket === "background") return "background";
  return "unclassified";
}

const PredeterminedGlyph = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Predetermined">
    <circle cx="12" cy="5" r="3" />
    <line x1="12" y1="22" x2="12" y2="8" />
    <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
  </svg>
);

const WildcardGlyph = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#fff" stroke="none" aria-label="Wildcard">
    <path d="M13 2 3 14h7l-1 8 11-13h-7l1-7z" />
  </svg>
);

const STATE_CLASS: Record<DotState, string> = {
  axis: "border-2 border-brand-orange shadow-[0_0_0_4px_rgba(249,115,22,0.2)]",
  // One of the current 2 axis picks (AI top-2 by default, or a manual checkbox override),
  // before the user has locked anything in — bold text + a yellow ring, visually a step below
  // the locked-axis orange ring.
  topCandidate: "border-2 border-[#EAB308] shadow-[0_0_0_3px_rgba(234,179,8,0.28)] font-bold cursor-pointer hover:scale-[1.1]",
  candidate: "border-[1.5px] border-white cursor-pointer hover:scale-[1.08]",
  predetermined: "border-[1.5px] border-white",
  wildcard: "border-2 border-[#8B5CF6] shadow-[0_0_0_3px_rgba(139,92,246,0.18)]",
  background: "border-[1.5px] border-white opacity-70",
  unclassified: "border-[1.5px] border-white opacity-40",
};

function Dot({
  dot,
  sig,
  state,
  onSelect,
}: {
  dot: MatrixDot;
  sig?: Signal;
  state: DotState;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: dot.id });
  const [showTooltip, setShowTooltip] = React.useState(false);

  let scalePart = "";
  if (state === "axis") scalePart = " scale(1.15)";
  else if (state === "topCandidate") scalePart = " scale(1.08)";
  else if (state === "background" || state === "unclassified") scalePart = " scale(0.9)";

  // Every state gets a second tooltip line — signal name alone doesn't answer "is this a
  // candidate for the scenario axes."
  let noteText: string;
  switch (state) {
    case "axis":
      noteText = "Locked scenario axis";
      break;
    case "topCandidate":
      noteText = "Selected axis candidate — one of your current 2 picks";
      break;
    case "candidate":
      noteText = "Critical candidate — click to select as axis";
      break;
    case "predetermined":
      noteText = "Predetermined — appears in all scenarios";
      break;
    case "wildcard":
      noteText = "Wildcard — a discrete shock, never a scenario axis";
      break;
    case "background":
      noteText = "Not a critical uncertainty — background force";
      break;
    default:
      noteText = "Not yet classified";
  }

  const dndPart = transform ? `translate(${transform.x}px, ${transform.y}px) ` : "";
  const composedTransform = `${dndPart}translate(-50%, -50%)${scalePart}`;

  // The plot has overflow-hidden (clips the quadrant-background divs to its rounded corners),
  // so a tooltip anchored above/centered on a dot near an edge would get clipped — flip its
  // anchor near each edge instead. dot.x/dot.y (0-100) are already in scope, no DOM measurement
  // needed.
  const nearTop = dot.y < 15;
  const nearLeft = dot.x < 15;
  const nearRight = dot.x > 85;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      tabIndex={0}
      onClick={() => onSelect(dot.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(dot.id);
        }
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      className={cn(
        "absolute flex h-9 w-9 select-none items-center justify-center rounded-full text-[10px] font-semibold text-white transition-[box-shadow,transform,border-width] duration-150",
        isDragging ? "cursor-grabbing" : state === "candidate" || state === "topCandidate" ? "cursor-pointer" : "cursor-grab",
        STATE_CLASS[state]
      )}
      style={{
        left: dot.x + "%",
        top: dot.y + "%",
        background: dot.color,
        transform: composedTransform,
        zIndex: isDragging ? 10 : state === "axis" ? 6 : undefined,
        touchAction: "none",
      }}
    >
      {state === "predetermined" ? <PredeterminedGlyph /> : state === "wildcard" ? <WildcardGlyph /> : dot.label}

      {state === "axis" && (
        <span className="absolute left-1/2 top-[calc(100%+3px)] -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.4px] text-brand-orange">
          Axis
        </span>
      )}

      {showTooltip && sig?.title && (
        <div
          className={cn(
            "pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-brand-dark px-2.5 py-1.5 text-left shadow-[0_8px_20px_rgba(15,23,42,0.25)]",
            // Vertical: flip below the dot near the top edge (further below still if an "Axis"
            // label is already occupying the immediate below-dot space) instead of the default
            // above-dot placement, which the plot's overflow-hidden would otherwise clip.
            nearTop ? (state === "axis" ? "top-[calc(100%+20px)]" : "top-[calc(100%+8px)]") : "bottom-[calc(100%+8px)]",
            // Horizontal: anchor to the dot's left/right edge near those sides instead of
            // centering, so the tooltip's whitespace-nowrap width can't run past the plot edge.
            nearLeft ? "left-0" : nearRight ? "right-0" : "left-1/2 -translate-x-1/2"
          )}
        >
          <div className="text-[11.5px] font-semibold leading-tight text-white">{sig.title}</div>
          {noteText && <div className="mt-0.5 text-[10.5px] leading-tight text-white/70">{noteText}</div>}
        </div>
      )}
    </div>
  );
}

const EMPTY_BUCKETS: MatrixBucketGroups = { critical_uncertainty: [], predetermined: [], background: [], wildcard: [], pendingClassificationIds: [] };

// Read-only rail for the Predetermined/Background/Wildcard buckets — Critical Uncertainties
// keeps its own richer row (axis picking, storyline link) via CriticalUncertaintyRow.
function BucketRail({
  title,
  className,
  titleClassName,
  emptyClassName,
  dots,
  emptyLabel,
}: {
  title: string;
  className: string;
  titleClassName: string;
  emptyClassName: string;
  dots: MatrixDotData[];
  emptyLabel: string;
}) {
  return (
    <div className={cn("mb-3 rounded-xl border p-3", className)}>
      <div className="mb-2 flex items-center gap-1.5">
        <span className={cn("text-xs font-semibold", titleClassName)}>{title}</span>
      </div>
      {dots.map((d) => (
        <div key={d.signalId} className="flex items-center gap-2 py-1.5 text-xs text-brand-dark">
          <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: d.color }} />
          <span className="flex-1 truncate">{d.signal.title || d.label}</span>
        </div>
      ))}
      {dots.length === 0 && <div className={cn("py-1 text-[11.5px]", emptyClassName)}>{emptyLabel}</div>}
    </div>
  );
}

export function PageMatrix({ navigate }: { navigate: Navigate }) {
  const store = useStore();
  const searchParams = useSearchParams();
  // /matrix?focus={signalId} — see src/components/page-signals.tsx's "+ Add to Matrix".
  // Dot id *is* the signal id (see store.tsx's toMatrixDot), so this matches directly.
  const focusId = searchParams.get("focus");
  const [dots, setDots] = React.useState<MatrixDot[]>(store.matrixDots);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [critical, setCritical] = React.useState<string[]>(store.criticalUncertainties);
  const matrixRef = React.useRef<HTMLDivElement>(null);
  const draggedRef = React.useRef(false);

  // store.matrixDots is now the server-fetched source of truth — resync whenever it changes
  // (initial load, after a persisted drag, after scoring completes elsewhere).
  React.useEffect(() => {
    setDots(store.matrixDots);
  }, [store.matrixDots]);

  React.useEffect(() => {
    if (selectedId || dots.length === 0) return;
    // Prefer the focused signal (arrived via "+ Add to Matrix") if it's actually loaded;
    // degrades silently to the first dot otherwise — same as a stale mergeInsight id.
    const focused = focusId && dots.find((d) => d.id === focusId);
    setSelectedId(focused ? focused.id : dots[0].id);
  }, [dots, selectedId, focusId]);

  React.useEffect(() => {
    store.setCriticalUncertainties(critical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [critical]);

  // All four Schwartz rank-forces buckets (GET .../matrix/buckets, §7) — critical_uncertainty
  // feeds the axis picker below (unchanged); predetermined/background/wildcard feed their own
  // read-only rails. Re-fetched whenever store.matrixDots changes (initial load, or once a
  // drag's full persist -> reclassify -> refresh round-trip lands) — deliberately NOT keyed on
  // local `dots`, which also changes the instant a drag optimistically updates x/y, well before
  // the dragged signal's bucket has actually been reclassified server-side (it's cleared to
  // null in that window). Fetching on that premature trigger was reading a genuinely
  // mid-transaction DB state, which is what caused the top-candidate ring to flicker to a
  // coincidentally-different signal and then revert once the real reclassification landed.
  const [buckets, setBuckets] = React.useState<MatrixBucketGroups>(EMPTY_BUCKETS);
  React.useEffect(() => {
    if (!store.activeProjectId) {
      setBuckets(EMPTY_BUCKETS);
      return;
    }
    let cancelled = false;
    getMatrixBuckets(store.activeProjectId)
      .then((result) => {
        if (!cancelled) setBuckets(result);
      })
      .catch((err) => console.error("[matrix] failed to load matrix buckets", err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.activeProjectId, store.matrixDots]);
  const candidates: MatrixDotData[] = buckets.critical_uncertainty;

  // Orthogonality check (real AI call) once exactly 2 critical signals are selected.
  const [independence, setIndependence] = React.useState<IndependenceResult | null>(null);
  const [independenceLoading, setIndependenceLoading] = React.useState(false);
  React.useEffect(() => {
    if (critical.length !== 2 || !store.activeProjectId) {
      setIndependence(null);
      return;
    }
    let cancelled = false;
    setIndependenceLoading(true);
    checkAxisIndependence({ projectId: store.activeProjectId, axisASignalId: critical[0], axisBSignalId: critical[1] })
      .then((result) => {
        if (!cancelled) setIndependence(result);
      })
      .catch((err) => {
        console.error("[matrix] independence check failed", err);
        if (!cancelled) setIndependence(null);
      })
      .finally(() => {
        if (!cancelled) setIndependenceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [critical, store.activeProjectId]);

  // Locked axis emphasis (larger halo dot + "AXIS" label, both on the plot and the rail row
  // below) only kicks in once the orthogonality check has actually passed — matching the
  // hard constraint in SCHWARTZ_METHODOLOGY_SKILL.md: "every axis-pair selection must pass
  // the orthogonality/independence check before Build Scenario Matrix is enabled." Before
  // that, a 2-signal selection still renders as a plain (unverified) candidate.
  const axesLocked = critical.length === 2 && independence?.state === "independent";

  // The AI's current top-2 axis recommendation — candidates is already rank-sorted descending
  // by impact x uncertainty_weight server-side (getMatrixBuckets, src/lib/actions/matrix.ts)
  // and re-fetched on every dots change, so dragging a signal into a higher impact/uncertainty
  // position automatically re-ranks it.
  const topCandidateIds = candidates.slice(0, 2).map((c) => c.signalId);

  // `critical` (the checkbox / yellow-ring selection) auto-follows the AI ranking above — this
  // is what makes the checkbox for the top-2 always pre-checked, and the ring always move with
  // a drag that changes the ranking. A manual checkbox pick (onToggle/onReplace below, or a
  // plot click in handleDotSelect) sets `critical` directly and sticks until the next actual
  // re-ranking event resyncs it back to the algorithmic default — including after the pair has
  // been independence-verified (axesLocked): "locked" only governs the orange/verified styling
  // and the Build Scenarios gate below, not whether the ring keeps tracking a real ranking
  // change. topCandidateIds is derived from `candidates` (buckets.critical_uncertainty), so a
  // dot that drops out of that bucket — dragged out of the quadrant, or reclassified — is
  // already excluded from it, which naturally prunes it out of `critical` here too.
  React.useEffect(() => {
    if (candidates.length === 0) return; // buckets not loaded yet — don't clobber a persisted pick with []
    setCritical(topCandidateIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topCandidateIds.join()]);

  const selectedDot = dots.find((d) => d.id === selectedId);
  const selectedSignal = selectedDot ? store.signals.find((s) => s.id === selectedDot.sigId) : null;

  // Ask AI drawer (ask-ai.tsx, context="matrix") lives in AppShell, a sibling of this page's
  // content — this is how it learns the currently-selected dot and top axis pair, same
  // convention Storyline/Monitoring already use for their own *AskAiContext slots.
  React.useEffect(() => {
    store.setMatrixAskAiContext({
      selectedDot: selectedSignal && selectedDot ? { signalId: selectedSignal.id, title: selectedSignal.title, bucket: selectedDot.bucket } : null,
      topAxisPair: critical.map((id) => {
        const s = store.signals.find((sig) => sig.id === id);
        const d = dots.find((x) => x.sigId === id);
        return { signalId: id, title: (s && s.title) || (d && d.label) || id };
      }),
      axesLocked,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSignal?.id, selectedDot?.bucket, critical.join(), axesLocked]);
  const [reaxisOpen, setReaxisOpen] = React.useState(false);
  const [buildOpen, setBuildOpen] = React.useState(false);
  const hasScenarios = (store.scenarios || []).some((s) => !s.archived);
  // Once scenarios exist, the primary CTA takes the user straight to what they built instead
  // of forcing them through the Re-axis wizard just to look at it — Re-axis is now only
  // reachable via its own explicit ghost button below.
  const onScenariosButtonClick = () => {
    if (hasScenarios) navigate("/canvas");
    else setBuildOpen(true);
  };

  // Ground truth for "what the live scenarios were actually built from" — distinct from
  // store.criticalUncertainties, which just mirrors whatever `critical` currently is on this
  // page (including an in-progress re-pick the user hasn't applied via Re-axis yet). Every
  // scenario from one build shares the same axes row (see ai-scenarios.ts's buildScenarios),
  // so any one non-archived scenario's axisA/axisB is representative of the whole set.
  const builtAxisIds = React.useMemo(() => {
    const built = (store.scenarios || []).find((s) => !s.archived && s.axisA?.signalId && s.axisB?.signalId);
    return built ? [built.axisA!.signalId as string, built.axisB!.signalId as string] : null;
  }, [store.scenarios]);
  // True once the user's current top-2 pick has drifted from the axes their live scenarios
  // were actually built with — the signal that Re-axis (not just "View Scenarios") is what
  // they need next.
  const axesStale = hasScenarios && !!builtAxisIds && axesLocked && !builtAxisIds.every((id) => critical.includes(id));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  const onDragStart = (e: DragStartEvent) => {
    draggedRef.current = true;
    setSelectedId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const rect = matrixRef.current?.getBoundingClientRect();
    const signalId = String(e.active.id); // dot.id is the signal id (see store.tsx's toMatrixDot)
    if (rect) {
      let newX = 0;
      let newY = 0;
      setDots((prev) =>
        prev.map((d) => {
          if (d.id !== signalId) return d;
          const x = Math.max(DOT_MARGIN, Math.min(100 - DOT_MARGIN, d.x + (e.delta.x / rect.width) * 100));
          let y = Math.max(DOT_MARGIN, Math.min(100 - DOT_MARGIN, d.y + (e.delta.y / rect.height) * 100));
          // Wildcards and predetermined forces are never axis material (§7/§8) — block a drag
          // from resting one in the top-right "Critical" quadrant instead of letting it land
          // there and only get silently reclassified back afterward.
          if ((d.bucket === "wildcard" || d.bucket === "predetermined") && x > 50 && y < 50) {
            y = 50;
          }
          newX = x;
          newY = y;
          return { ...d, x, y };
        })
      );
      if (store.activeProjectId) {
        store.updateMatrixDotPosition(store.activeProjectId, signalId, newX, newY).catch((err) => {
          console.error("[matrix] failed to persist dot position", err);
        });
      }
    }
    // Release click-suppression after the synthetic click fires.
    setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  // Click on a dot: select it; a click (not a drag) on a Critical Uncertainties candidate
  // marks it as an axis (max 2).
  const handleDotSelect = (id: string) => {
    if (draggedRef.current) return;
    setSelectedId(id);
    const d = dots.find((x) => x.id === id);
    if (d && d.bucket === "critical_uncertainty" && !critical.includes(d.sigId) && critical.length < 2) {
      setCritical((prev) => (prev.length < 2 ? [...prev, d.sigId] : prev));
    }
  };

  const criticalSignals = critical.map((id) => store.signals.find((s) => s.id === id)).filter(Boolean) as Signal[];

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-5">
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card p-[18px] shadow-card">
        <div className="mb-3.5 flex flex-shrink-0 items-start justify-between">
          <ScenarioContextHeader view="matrix" className="flex-shrink-0 p-0" />
          <div className="flex flex-shrink-0 items-center gap-2">
            {axesStale && (
              <span className="text-[11.5px] font-medium text-brand-orange">Top-2 changed — Re-axis to update scenarios</span>
            )}
            {hasScenarios && (
              <Button variant={axesStale ? "primary" : "ghost"} size="sm" onClick={() => setReaxisOpen(true)}>
                <Icons.Refresh size={12} /> Re-axis
              </Button>
            )}
            <Button variant={axesStale ? "ghost" : "primary"} size="sm" onClick={onScenariosButtonClick}>
              {hasScenarios ? "View Scenarios" : "Build Scenarios"} <Icons.ArrowRight size={12} />
            </Button>
          </div>
        </div>
        <div className="mb-3.5 flex-shrink-0 text-[13px] text-muted-foreground">
          Drag signals to rank them. The top-right quadrant becomes your scenario axes.
        </div>

        {store.pendingScoringCount > 0 && (
          <div className="mb-3.5 flex-shrink-0 rounded-[9px] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2.5 text-[12.5px] text-[#92400E]">
            {store.pendingScoringCount} signal{store.pendingScoringCount === 1 ? "" : "s"} need
            {store.pendingScoringCount === 1 ? "s" : ""} scoring before ranking.
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_260px] gap-3.5 overflow-hidden">
          {/* Matrix — vertically centered, fixed natural height, never scrolls */}
          <div className="flex h-full min-h-0 flex-col items-center justify-center overflow-hidden">
            <div className="relative w-full">
              <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
                <div ref={matrixRef} className="relative h-matrix overflow-hidden rounded-[12px] border border-border bg-white">
                  {/* Quadrant backgrounds */}
                  <div className="absolute left-0 top-0 h-1/2 w-1/2 bg-[#EFF6FF]" />
                  <div className="absolute left-1/2 top-0 h-1/2 w-1/2 bg-[#FFF7ED]" />
                  <div className="absolute left-0 top-1/2 h-1/2 w-1/2 bg-[#F3F4F6]" />
                  <div className="absolute left-1/2 top-1/2 h-1/2 w-1/2 bg-[rgba(245,243,255,0.5)]" />

                  {/* Quadrant labels */}
                  <div className="absolute left-3.5 top-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#3B82F6]">
                    PREDETERMINED
                  </div>
                  <div className="absolute right-3.5 top-3 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-orange">
                    CRITICAL ★
                  </div>
                  <div className="absolute bottom-8 left-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-text-3">
                    BACKGROUND
                  </div>
                  <div className="absolute bottom-8 right-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#8B5CF6]">
                    WILDCARDS
                  </div>

                  {/* Crosshairs (dashed) */}
                  <div className="absolute left-0 top-1/2 w-full border-t border-dashed border-border" />
                  <div className="absolute left-1/2 top-0 h-full border-l border-dashed border-border" />

                  {/* Axis labels */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">
                    Uncertainty →
                  </div>
                  <div className="absolute left-2 top-1/2 font-mono text-[11px] uppercase tracking-[0.06em] text-text-3 [transform:translateY(-50%)_rotate(-90deg)] [transform-origin:left_center]">
                    ← Impact
                  </div>

                  {/* Dots */}
                  {dots.map((d) => {
                    const sig = store.signals.find((s) => s.id === d.sigId);
                    return <Dot key={d.id} dot={d} sig={sig} state={dotState(d, critical, axesLocked)} onSelect={handleDotSelect} />;
                  })}
                </div>
              </DndContext>

              {/* Category legend */}
              <div className="mt-3 flex flex-wrap gap-[18px] px-3.5 pt-2 text-xs text-muted-foreground">
                {[
                  { label: "Social", color: "#8B5CF6" },
                  { label: "Technology", color: "#3B82F6" },
                  { label: "Economic", color: "#10B981" },
                  { label: "Ecological", color: "#14B8A6" },
                  { label: "Political", color: "#EF4444" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <span className="h-[9px] w-[9px] rounded-full" style={{ background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>

              {/* State legend */}
              <div className="mt-2.5 flex flex-wrap items-center gap-4 px-3.5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 flex-shrink-0 rounded-full border-2 border-brand-orange bg-text-3 shadow-[0_0_0_2.5px_rgba(249,115,22,0.2)]" />
                  Selected axis
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 flex-shrink-0 rounded-full border-2 border-[#EAB308] bg-text-3 shadow-[0_0_0_2px_rgba(234,179,8,0.25)]" />
                  Axis candidate
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 flex-shrink-0 rounded-full border-[1.5px] border-white bg-text-3" />
                  Critical candidate
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-text-3">
                    <PredeterminedGlyph size={9} />
                  </span>
                  Predetermined
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border-2 border-[#8B5CF6] bg-text-3">
                    <WildcardGlyph size={8} />
                  </span>
                  Wildcard
                </div>
              </div>
            </div>
          </div>

          {/* Right panel — scrolls independently of the plot column */}
          <div className="scroll-y h-full min-h-0 pb-2">
            <div className="mb-3 rounded-xl border border-brand-orange100 bg-brand-orangeLight p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-brand-orange">★</span>
                <span className="text-xs font-semibold text-brand-orange700">Critical Uncertainties</span>
              </div>

              {/* Selection counter pill */}
              {(() => {
                const done = critical.length === 2;
                return (
                  <span
                    className={cn(
                      "mb-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                      done ? "bg-[#ECFDF5] text-[#10B981]" : "bg-brand-orangeLight text-brand-orange"
                    )}
                  >
                    Selected: {critical.length} of 2{done ? " ✓" : ""}
                  </span>
                );
              })()}

              <div className="mb-2.5 flex items-center gap-[5px]">
                <span className="text-[11px] text-[#9A3412]">Select 2 as scenario axes</span>
                <MethodologyInfo />
              </div>
              {candidates.map((c) => {
                const dot = dots.find((d) => d.sigId === c.signalId);
                const sig = store.signals.find((s) => s.id === c.signalId);
                if (!dot) return null;
                const isOn = critical.includes(c.signalId);
                return (
                  <CriticalUncertaintyRow
                    key={dot.id}
                    dot={dot}
                    sig={sig}
                    isOn={isOn}
                    isLockedAxis={axesLocked && isOn}
                    atCapacity={critical.length >= 2 && !isOn}
                    currentPicks={critical.map((id) => {
                      const cs = store.signals.find((s) => s.id === id);
                      const cd = dots.find((x) => x.sigId === id);
                      return { sigId: id, title: (cs && cs.title) || (cd && cd.label) || id };
                    })}
                    onToggle={() => {
                      setCritical((prev) =>
                        prev.includes(c.signalId)
                          ? prev.filter((x) => x !== c.signalId)
                          : prev.length < 2
                            ? [...prev, c.signalId]
                            : prev
                      );
                    }}
                    onReplace={(removeId) => {
                      setCritical((prev) => [...prev.filter((x) => x !== removeId), c.signalId]);
                    }}
                    onViewStoryline={() => navigate("/storyline")}
                  />
                );
              })}
              {candidates.length === 0 && (
                <div className="py-2 text-[11.5px] text-text-3">Drag signals into the top-right to mark as critical.</div>
              )}

              {/* Orthogonality assessment — only with exactly 2 axes */}
              <IndependenceAssessment result={independence} loading={independenceLoading} />

              {/* Live 2×2 scenario preview */}
              <ScenarioPreview signals={criticalSignals} />
            </div>

            <BucketRail
              title="Predetermined"
              className="border-[#BFDBFE] bg-[#EFF6FF]"
              titleClassName="text-[#1D4ED8]"
              emptyClassName="text-[#1D4ED8]"
              dots={buckets.predetermined}
              emptyLabel="No predetermined forces yet."
            />

            <BucketRail
              title="Background"
              className="border-border bg-[#F9FAFB]"
              titleClassName="text-text-3"
              emptyClassName="text-text-3"
              dots={buckets.background}
              emptyLabel="No background forces yet."
            />

            <BucketRail
              title="Wildcard"
              className="border-[#DDD6FE] bg-[#F5F3FF]"
              titleClassName="text-[#6D28D9]"
              emptyClassName="text-[#6D28D9]"
              dots={buckets.wildcard}
              emptyLabel="No wildcards yet."
            />

            {/* Selected signal details */}
            {selectedSignal && (
              <div className="slide-up mt-3 rounded-xl border border-border bg-white p-3.5">
                <div className="mb-1 font-mono text-[10.5px] tracking-[0.06em] text-text-3">SELECTED SIGNAL</div>
                <div className="mb-1 text-[13.5px] font-semibold">{selectedSignal.title}</div>
                <div className="text-xs leading-[1.5] text-muted-foreground">{selectedSignal.body}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Re-axis migration modal (when scenarios already exist) */}
      <ReAxisModal open={reaxisOpen} onClose={() => setReaxisOpen(false)} navigate={navigate} builtAxes={builtAxisIds} />
      {/* Build scenarios modal (first-time creation) */}
      <BuildScenariosModal
        open={buildOpen}
        onClose={() => setBuildOpen(false)}
        navigate={navigate}
        independence={independence}
      />
    </div>
  );
}
