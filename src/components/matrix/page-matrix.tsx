"use client";

// Impact × Uncertainty Matrix — Tailwind/token-driven.
// Drag-to-rank uses @dnd-kit/core (free positioning): dots follow the cursor via the
// draggable transform and commit their new x/y % on drag end. A 3px pointer activation
// distance lets a plain click (no drag) select a top-right candidate as a scenario axis.
// Dynamic values (dot left/top %, color, dnd transform) stay inline; everything else
// is Tailwind utilities + tokens.
import * as React from "react";
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
import type { MatrixDot, Signal } from "@/lib/types";
import type { Navigate } from "@/lib/use-navigate";
import { MethodologyInfo } from "./methodology-info";
import { IndependenceAssessment } from "./independence-assessment";
import { ScenarioPreview } from "./scenario-preview";
import { CriticalUncertaintyRow } from "./critical-uncertainty-row";
import { BuildScenariosModal, ReAxisModal } from "./modals";

type DotState = "axis" | "candidate" | "predetermined" | "other";

function dotState(d: MatrixDot, critical: string[]): DotState {
  const inCritical = d.x > 50 && d.y < 50; // top-right
  const inPredet = d.x <= 50 && d.y < 50; // top-left
  if (critical.includes(d.sigId)) return "axis";
  if (inCritical) return "candidate";
  if (inPredet) return "predetermined";
  return "other";
}

const PredeterminedGlyph = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Predetermined">
    <circle cx="12" cy="5" r="3" />
    <line x1="12" y1="22" x2="12" y2="8" />
    <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
  </svg>
);

const STATE_CLASS: Record<DotState, string> = {
  axis: "border-2 border-brand-orange shadow-[0_0_0_4px_rgba(249,115,22,0.2)]",
  candidate: "border-[1.5px] border-white cursor-pointer hover:scale-[1.08]",
  predetermined: "border-[1.5px] border-white",
  other: "border-[1.5px] border-white opacity-70",
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

  let scalePart = "";
  if (state === "axis") scalePart = " scale(1.15)";
  else if (state === "other") scalePart = " scale(0.9)";

  let titleText = sig?.title;
  if (state === "candidate") titleText = "Critical candidate — click to select as axis";
  else if (state === "predetermined") titleText = "Predetermined — appears in all scenarios";

  const dndPart = transform ? `translate(${transform.x}px, ${transform.y}px) ` : "";
  const composedTransform = `${dndPart}translate(-50%, -50%)${scalePart}`;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onSelect(dot.id)}
      className={cn(
        "absolute flex h-9 w-9 select-none items-center justify-center rounded-full text-[10px] font-semibold text-white transition-[box-shadow,transform,border-width] duration-150",
        isDragging ? "cursor-grabbing" : state === "candidate" ? "cursor-pointer" : "cursor-grab",
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
      title={titleText}
    >
      {state === "predetermined" ? <PredeterminedGlyph /> : dot.label}

      {state === "axis" && (
        <span className="absolute left-1/2 top-[calc(100%+3px)] -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.4px] text-brand-orange">
          Axis
        </span>
      )}
    </div>
  );
}

export function PageMatrix({ navigate }: { navigate: Navigate }) {
  const store = useStore();
  const seed = store.seed;
  const [dots, setDots] = React.useState<MatrixDot[]>(store.matrixDots);
  const [selectedId, setSelectedId] = React.useState<string>(store.selectedDot || dots[0]?.id);
  const [critical, setCritical] = React.useState<string[]>(store.criticalUncertainties);
  const matrixRef = React.useRef<HTMLDivElement>(null);
  const draggedRef = React.useRef(false);

  React.useEffect(() => {
    store.setMatrixDots(dots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dots]);
  React.useEffect(() => {
    store.setCriticalUncertainties(critical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [critical]);

  const selectedDot = dots.find((d) => d.id === selectedId);
  const selectedSignal = selectedDot ? seed.signals.find((s) => s.id === selectedDot.sigId) : null;
  const [reaxisOpen, setReaxisOpen] = React.useState(false);
  const [buildOpen, setBuildOpen] = React.useState(false);
  const hasScenarios = (store.scenarios || []).some((s) => !s.archived);
  const onBuildClick = () => {
    if (hasScenarios) setReaxisOpen(true);
    else setBuildOpen(true);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 3 } }));

  const onDragStart = (e: DragStartEvent) => {
    draggedRef.current = true;
    setSelectedId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const rect = matrixRef.current?.getBoundingClientRect();
    if (rect) {
      const id = String(e.active.id);
      setDots((prev) =>
        prev.map((d) => {
          if (d.id !== id) return d;
          const x = Math.max(2, Math.min(98, d.x + (e.delta.x / rect.width) * 100));
          const y = Math.max(2, Math.min(98, d.y + (e.delta.y / rect.height) * 100));
          return { ...d, x, y };
        })
      );
    }
    // Release click-suppression after the synthetic click fires.
    setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  // Click on a dot: select it; a click (not a drag) on a top-right candidate marks it
  // as an axis (max 2).
  const handleDotSelect = (id: string) => {
    if (draggedRef.current) return;
    setSelectedId(id);
    const d = dots.find((x) => x.id === id);
    if (d && d.x > 50 && d.y < 50 && !critical.includes(d.sigId) && critical.length < 2) {
      setCritical((prev) => (prev.length < 2 ? [...prev, d.sigId] : prev));
    }
  };

  const criticalSignals = critical.map((id) => seed.signals.find((s) => s.id === id)).filter(Boolean) as Signal[];

  return (
    <div className="scroll-y flex-1 overflow-y-auto p-5">
      {/* Project-level breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-0.5 flex items-center gap-2">
        <button
          onClick={() => navigate("/home")}
          className="border-0 bg-transparent p-0 text-xs text-muted-foreground transition-colors hover:text-brand-orange"
        >
          APAC Expansion 2030
        </button>
        <span aria-hidden className="text-xs text-border-strong">
          /
        </span>
        <span className="text-xs font-medium text-brand-dark">Matrix</span>
      </nav>

      {/* Project-level page header */}
      <div className="pb-5 pt-3">
        <h1 className="m-0 text-2xl font-semibold tracking-[-0.018em] text-brand-dark">Impact × Uncertainty Matrix</h1>
        <div className="mt-1 max-w-[672px] text-sm leading-[1.5] text-muted-foreground [text-wrap:pretty]">
          Rank all your signals by impact and uncertainty. The top-right quadrant becomes the source for your
          scenario axes.
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-[18px] shadow-card">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="text-[13px] text-muted-foreground">
            Drag signals to rank them. The top-right quadrant becomes your scenario axes.
          </div>
          <button
            onClick={onBuildClick}
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-md border border-brand-orange bg-brand-orange px-[11px] py-[7px] text-[13px] font-medium leading-none text-white transition-colors hover:bg-brand-orangeHover hover:border-brand-orangeHover"
          >
            Build Scenario Matrix <Icons.ArrowRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-[1fr_260px] gap-3.5">
          {/* Matrix */}
          <div className="relative">
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
                  const sig = seed.signals.find((s) => s.id === d.sigId);
                  return <Dot key={d.id} dot={d} sig={sig} state={dotState(d, critical)} onSelect={handleDotSelect} />;
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
                <span className="h-3 w-3 flex-shrink-0 rounded-full border-[1.5px] border-white bg-text-3" />
                Critical candidate
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-text-3">
                  <PredeterminedGlyph size={9} />
                </span>
                Predetermined
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div>
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
              {dots
                .filter((d) => d.x > 50 && d.y < 50)
                .map((d) => {
                  const sig = seed.signals.find((s) => s.id === d.sigId);
                  const isOn = critical.includes(d.sigId);
                  return (
                    <CriticalUncertaintyRow
                      key={d.id}
                      dot={d}
                      sig={sig}
                      isOn={isOn}
                      atCapacity={critical.length >= 2 && !isOn}
                      currentPicks={critical.map((id) => {
                        const cd = dots.find((x) => x.sigId === id);
                        const cs = cd && seed.signals.find((s) => s.id === cd.sigId);
                        return { sigId: id, title: (cs && cs.title) || (cd && cd.label) || id };
                      })}
                      onToggle={() => {
                        setCritical((prev) =>
                          prev.includes(d.sigId)
                            ? prev.filter((x) => x !== d.sigId)
                            : prev.length < 2
                              ? [...prev, d.sigId]
                              : prev
                        );
                      }}
                      onReplace={(removeId) => {
                        setCritical((prev) => [...prev.filter((x) => x !== removeId), d.sigId]);
                      }}
                      onViewStoryline={() => navigate("/storyline")}
                    />
                  );
                })}
              {dots.filter((d) => d.x > 50 && d.y < 50).length === 0 && (
                <div className="py-2 text-[11.5px] text-text-3">Drag signals into the top-right to mark as critical.</div>
              )}

              {/* Orthogonality assessment — only with exactly 2 axes */}
              <IndependenceAssessment signals={criticalSignals} library={seed.signals} />

              {/* Live 2×2 scenario preview */}
              <ScenarioPreview signals={criticalSignals} />
            </div>

            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="text-xs font-semibold text-[#1D4ED8]">Predetermined</span>
              </div>
              {dots
                .filter((d) => d.x <= 50 && d.y < 50)
                .map((d) => {
                  const sig = seed.signals.find((s) => s.id === d.sigId);
                  return (
                    <div key={d.id} className="flex items-center gap-2 py-1.5 text-xs text-brand-dark">
                      <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                      <span className="flex-1 truncate">{sig?.title || d.label}</span>
                    </div>
                  );
                })}
              {dots.filter((d) => d.x <= 50 && d.y < 50).length === 0 && (
                <div className="py-1 text-[11.5px] text-[#1D4ED8]">No predetermined forces yet.</div>
              )}
            </div>

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
      <ReAxisModal open={reaxisOpen} onClose={() => setReaxisOpen(false)} navigate={navigate} />
      {/* Build scenarios modal (first-time creation) */}
      <BuildScenariosModal open={buildOpen} onClose={() => setBuildOpen(false)} navigate={navigate} />
    </div>
  );
}
