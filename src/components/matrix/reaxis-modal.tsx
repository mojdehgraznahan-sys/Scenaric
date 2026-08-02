"use client";

// Re-axis migration modal — non-destructive flow for changing scenario axes.
// Three steps: choose new axes → review signal migration → preserve/drop narratives.
// Commits via store setters and offers a 30s undo. Faithful port of reaxis-modal.jsx.
import * as React from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Navigate } from "@/lib/use-navigate";
import type { Scenario, Signal, SteepCategory } from "@/lib/types";
import { reaxisPreview, type ScenarioLogic } from "@/lib/actions/ai-scenarios";
import { axisMeta } from "./axis-data";

const SIGNAL_AXIS: Record<string, string> = {
  sg1: "Carbon Policy",
  sg2: "AI Adoption",
  sg3: "Talent Values",
  sg4: "Geopolitical Alignment",
  sg5: "Consumer Growth",
  sg6: "Climate Risk",
  sg7: "Channel Shift",
  sg8: "Market Openness",
  sg9: "FX Stability",
};
const rxAxisName = (sig?: Signal) => (sig ? SIGNAL_AXIS[sig.id] || (sig.title || "").split(" ").slice(0, 2).join(" ") : "—");

const QUADS = ["TL", "TR", "BL", "BR"];

function catColor(cat: SteepCategory) {
  return ({ Social: "#8B5CF6", Technology: "#3B82F6", Economic: "#10B981", Ecological: "#14B8A6", Political: "#EF4444" } as Record<SteepCategory, string>)[cat] || "#9CA3AF";
}

interface MigrationRow {
  sigId: string;
  title: string;
  oldQuad: string;
  newQuad: string;
  confidence: "high" | "medium" | "low";
}
type NarrativeChoice = "migrate" | "archive" | "delete";
interface FmWindow extends Window {
  FM_toast?: (opts: { message: string; actionText?: string; action?: string; duration?: number }) => void;
  __fmUndo?: { scenarios: Scenario[]; critical: string[] } | null;
}

export function ReAxisModal({ open, onClose, navigate }: { open: boolean; onClose: () => void; navigate: Navigate }) {
  const store = useStore();
  const signals = store.signals || store.seed.signals;
  const dots = store.matrixDots || [];
  const scenarios = store.scenarios || [];
  const currentAxes = store.criticalUncertainties || [];

  const [step, setStep] = React.useState(1);
  const [newAxes, setNewAxes] = React.useState<string[]>(currentAxes);
  const [changingFor, setChangingFor] = React.useState<number | null>(null);
  const [narrativeChoices, setNarrativeChoices] = React.useState<Record<string, NarrativeChoice>>({});
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const applyReaxisRef = React.useRef<() => void>(() => {});

  // Real scenario-logic preview for the candidate new axes (§8) — replaces the old hash-based
  // pickNames() fabrication. Grounded the same way as buildScenarios: predetermined/wildcard
  // signals pulled from matrix_dots and fed into the same scenario-logic prompt, just not
  // persisted (see reaxisPreview, ai-scenarios.ts).
  const [previewScenarios, setPreviewScenarios] = React.useState<ScenarioLogic[] | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setStep(1);
      setNewAxes(currentAxes);
      setChangingFor(null);
      setNarrativeChoices(Object.fromEntries(scenarios.map((s) => [s.id, "migrate"])) as Record<string, NarrativeChoice>);
      setConfirmDelete(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Axis-eligible candidates — critical_uncertainty bucket only (real, persisted classification),
  // matching build-scenarios-modal.tsx's axis picker and page-matrix.tsx's click-to-select guard.
  // Was previously a stale d.x > 50 && d.y < 50 position check, which could surface a
  // wildcard/predetermined dot that just happened to be plotted in the top-right quadrant.
  const candidates = React.useMemo(
    () => dots.filter((d) => d.bucket === "critical_uncertainty").map((d) => signals.find((s) => s.id === d.sigId)).filter(Boolean),
    [dots, signals]
  ) as Signal[];

  const sigById = (id: string) => signals.find((s) => s.id === id);
  const oldA = sigById(currentAxes[0]);
  const oldB = sigById(currentAxes[1]);
  const newA = sigById(newAxes[0]);
  const newB = sigById(newAxes[1]);

  React.useEffect(() => {
    if (!open || !newA || !newB || newAxes[0] === newAxes[1] || !store.activeProjectId) {
      setPreviewScenarios(null);
      setPreviewError(null);
      return;
    }
    const metaA = axisMeta(newA);
    const metaB = axisMeta(newB);
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    reaxisPreview({
      projectId: store.activeProjectId,
      axisA: { signalId: newA.id, label: metaA.axis, polePos: metaA.pos, poleNeg: metaA.neg },
      axisB: { signalId: newB.id, label: metaB.axis, polePos: metaB.pos, poleNeg: metaB.neg },
    })
      .then((result) => {
        if (!cancelled) setPreviewScenarios(result.scenarios);
      })
      .catch((err) => {
        console.error("[reaxis] preview failed", err);
        if (!cancelled) {
          setPreviewScenarios(null);
          setPreviewError("Couldn't generate a preview for these axes — try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, newAxes.join(), store.activeProjectId]);

  const scenariosByQuad = React.useMemo(() => new Map<string, ScenarioLogic>((previewScenarios ?? []).map((s) => [s.quadrant, s])), [previewScenarios]);
  const proposedNames = QUADS.map((q) => scenariosByQuad.get(q)?.name ?? "");
  const proposedTaglines = QUADS.map((q) => scenariosByQuad.get(q)?.tagline ?? "");

  const migration = React.useMemo<MigrationRow[]>(() => {
    return dots.map((d) => {
      const sig = signals.find((s) => s.id === d.sigId);
      const oldQuad = d.x > 50 ? (d.y < 50 ? "TR" : "BR") : d.y < 50 ? "TL" : "BL";
      const h = Math.abs((d.sigId + newAxes.join()).split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0));
      const score = h % 100;
      let confidence: MigrationRow["confidence"] = "high";
      if (score < 20) confidence = "low";
      else if (score < 45) confidence = "medium";
      const idx = QUADS.indexOf(oldQuad);
      const newQuad = confidence === "high" ? oldQuad : confidence === "medium" ? QUADS[(idx + 1) % 4] : "?";
      return { sigId: d.sigId, title: (sig && sig.title) || d.label, oldQuad, newQuad, confidence };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dots, signals, newAxes.join()]);

  React.useEffect(() => {
    if (!open) return;
    const onEnter = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (step < 3) {
        if (!(step === 1 && (!newAxes[0] || !newAxes[1] || newAxes[0] === newAxes[1]))) setStep((s) => s + 1);
      } else {
        applyReaxisRef.current();
      }
    };
    window.addEventListener("keydown", onEnter);
    return () => window.removeEventListener("keydown", onEnter);
  });

  if (!open) return null;

  const counts = migration.reduce<Record<string, number>>((acc, m) => {
    acc[m.confidence] = (acc[m.confidence] || 0) + 1;
    return acc;
  }, {});
  const cleanCount = counts.high || 0;
  const reviewCount = (counts.medium || 0) + (counts.low || 0);

  const CONF: Record<MigrationRow["confidence"], { color: string; label: string; icon: string }> = {
    high: { color: "#10B981", label: "High", icon: "✓" },
    medium: { color: "#F59E0B", label: "Medium", icon: "?" },
    low: { color: "#EF4444", label: "Low", icon: "⚠" },
  };

  const applyReaxis = () => {
    const snapshot = { scenarios: JSON.parse(JSON.stringify(scenarios)) as Scenario[], critical: [...currentAxes] };
    const now = Date.now();
    const nextScenarios = scenarios
      .filter((s) => narrativeChoices[s.id] !== "delete")
      .map((s, i) => ({
        ...s,
        name: narrativeChoices[s.id] === "archive" ? s.name : proposedNames[i] || s.name,
        archived: narrativeChoices[s.id] === "archive",
        reaxedAt: now,
      }));

    store.setScenarios(nextScenarios);
    store.setCriticalUncertainties(newAxes);
    const review = migration.filter((m) => m.confidence !== "high").map((m) => m.sigId);
    try {
      localStorage.setItem("fm.reaxReview", JSON.stringify(review));
    } catch {}

    onClose();
    const w = window as FmWindow;
    w.__fmUndo = snapshot;
    if (w.FM_toast) w.FM_toast({ message: "Re-axis applied", actionText: "Undo", action: "undo-reax", duration: 30000 });
    if (navigate) navigate("/canvas");
  };
  applyReaxisRef.current = applyReaxis;

  const STEPS = [
    { n: 1, label: "Choose new axes" },
    { n: 2, label: "Review impact" },
    { n: 3, label: "Preserve narratives" },
  ];
  const step1Invalid = !newAxes[0] || !newAxes[1] || newAxes[0] === newAxes[1];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Re-axis scenarios"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fade-in fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(30,27,46,0.40)] p-6 backdrop-blur-[4px]"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="slide-up relative flex max-h-[calc(100vh-48px)] w-full max-w-[900px] flex-col rounded-xl bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25),0_8px_24px_rgba(15,23,42,0.12)]"
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-0 bg-transparent text-muted-foreground hover:bg-bg">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>

        <div className="pr-8">
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-brand-dark">Re-axis scenarios</h2>
          <div className="mt-1 text-[13.5px] text-muted-foreground">Pick new scenario axes. We&apos;ll help you migrate existing work.</div>
        </div>

        {/* Stepper */}
        <div className="my-4 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <button onClick={() => setStep(s.n)} className="flex items-center gap-[7px] border-0 bg-transparent p-0">
                <span
                  className={cn(
                    "flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold",
                    step >= s.n ? "bg-brand-orange text-white" : "bg-border text-muted-foreground"
                  )}
                >
                  {s.n}
                </span>
                <span className={cn("text-[12.5px]", step === s.n ? "font-semibold text-brand-dark" : "font-medium text-muted-foreground")}>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="scroll-y min-h-[200px] flex-1 overflow-y-auto overflow-x-hidden">
          {step === 1 && (
            <StepChooseAxes
              currentAxes={currentAxes}
              newAxes={newAxes}
              setNewAxes={setNewAxes}
              candidates={candidates}
              sigById={sigById}
              changingFor={changingFor}
              setChangingFor={setChangingFor}
              oldA={oldA}
              oldB={oldB}
              newA={newA}
              newB={newB}
            />
          )}
          {step === 2 && (
            <StepReviewImpact
              scenarios={scenarios}
              proposedNames={proposedNames}
              proposedTaglines={proposedTaglines}
              previewLoading={previewLoading}
              previewError={previewError}
              migration={migration}
              CONF={CONF}
              cleanCount={cleanCount}
              reviewCount={reviewCount}
              total={migration.length}
            />
          )}
          {step === 3 && (
            <StepNarratives
              scenarios={scenarios}
              proposedNames={proposedNames}
              narrativeChoices={narrativeChoices}
              setNarrativeChoices={setNarrativeChoices}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#F3F4F6] pt-3.5">
          <button onClick={onClose} className="border-0 bg-transparent px-1 py-1.5 text-[13.5px] font-medium text-muted-foreground hover:text-brand-dark">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="rounded-md border border-border bg-white px-3.5 py-2 text-[13.5px] font-medium text-brand-dark">
                Back
              </button>
            )}
            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && step1Invalid}
                className="rounded-md border-0 bg-brand-orange px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-40"
              >
                Next
              </button>
            )}
            {step === 3 && (
              <>
                <button onClick={() => setStep(2)} className="rounded-md border border-border bg-white px-3.5 py-2 text-[13.5px] font-medium text-brand-dark">
                  Preview migration
                </button>
                <button onClick={applyReaxis} className="rounded-md border-0 bg-brand-orange px-4 py-2 text-[13.5px] font-semibold text-white">
                  Apply re-axis →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 1 — choose axes ─────────────────────────────────────────── */
function StepChooseAxes({
  currentAxes,
  newAxes,
  setNewAxes,
  candidates,
  sigById,
  changingFor,
  setChangingFor,
  oldA,
  oldB,
  newA,
  newB,
}: {
  currentAxes: string[];
  newAxes: string[];
  setNewAxes: React.Dispatch<React.SetStateAction<string[]>>;
  candidates: Signal[];
  sigById: (id: string) => Signal | undefined;
  changingFor: number | null;
  setChangingFor: (v: number | null) => void;
  oldA?: Signal;
  oldB?: Signal;
  newA?: Signal;
  newB?: Signal;
}) {
  const AxisSlot = ({ slot }: { slot: number }) => {
    const sig = sigById(newAxes[slot]);
    const isCurrent = newAxes[slot] === currentAxes[slot];
    return (
      <div className="relative flex-1">
        <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Axis {slot + 1}</div>
        <div className="flex items-center gap-2 rounded-[9px] border border-border px-3 py-2.5">
          <span className="h-[9px] w-[9px] flex-shrink-0 rounded-full" style={{ background: (sig && catColor(sig.category)) || "#9CA3AF" }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-brand-dark">{rxAxisName(sig)}</div>
            <div className="truncate text-[11px] text-text-3">{sig && sig.title}</div>
          </div>
          {isCurrent && (
            <span className="rounded-full bg-bg px-[7px] py-px font-mono text-[9.5px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">Current</span>
          )}
          <button onClick={() => setChangingFor(changingFor === slot ? null : slot)} className="flex-shrink-0 border-0 bg-transparent text-xs font-medium text-brand-orange">
            Change
          </button>
        </div>
        {changingFor === slot && (
          <div className="slide-up absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-[220px] overflow-auto rounded-[10px] border border-border bg-white p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.14)]">
            {candidates.map((c) => {
              const sel = newAxes[slot] === c.id;
              const isCur = currentAxes.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setNewAxes((prev) => {
                      const nx = [...prev];
                      nx[slot] = c.id;
                      return nx;
                    });
                    setChangingFor(null);
                  }}
                  className={cn("flex w-full items-center gap-2 rounded-[7px] border-0 px-2.5 py-2 text-left", sel ? "bg-brand-orangeLight" : "bg-transparent hover:bg-[#FAFAFA]")}
                >
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: catColor(c.category) }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-brand-dark">{c.title}</span>
                  {isCur && <span className="font-mono text-[9.5px] uppercase text-muted-foreground">current</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-start gap-3.5">
        <AxisSlot slot={0} />
        <div className="pt-[30px] text-base text-text-3">×</div>
        <AxisSlot slot={1} />
      </div>
      <div className="mt-4 rounded-[9px] bg-[#F9FAFB] px-3 py-2.5 text-[12.5px] leading-[1.5] text-muted-foreground">
        <span className="text-text-3">Old:</span>{" "}
        <strong className="font-semibold text-brand-dark">
          {rxAxisName(oldA)} × {rxAxisName(oldB)}
        </strong>
        <span className="mx-2 text-brand-orange">→</span>
        <span className="text-text-3">New:</span>{" "}
        <strong className="font-semibold text-brand-dark">
          {rxAxisName(newA)} × {rxAxisName(newB)}
        </strong>
      </div>
    </div>
  );
}

/* ── Step 2 — review impact ───────────────────────────────────────── */
function StepReviewImpact({
  scenarios,
  proposedNames,
  proposedTaglines,
  previewLoading,
  previewError,
  migration,
  CONF,
  cleanCount,
  reviewCount,
  total,
}: {
  scenarios: Scenario[];
  proposedNames: string[];
  proposedTaglines: string[];
  previewLoading: boolean;
  previewError: string | null;
  migration: MigrationRow[];
  CONF: Record<MigrationRow["confidence"], { color: string; label: string; icon: string }>;
  cleanCount: number;
  reviewCount: number;
  total: number;
}) {
  return (
    <div>
      <div className="mb-3.5 text-[13px] text-muted-foreground">
        <strong className="font-semibold text-brand-dark">
          {cleanCount} of {total}
        </strong>{" "}
        signals will migrate cleanly.{" "}
        {reviewCount > 0 ? (
          <>
            <strong className="font-semibold text-[#92400E]">{reviewCount}</strong> need your review.
          </>
        ) : (
          "None need review."
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">Current scenarios</div>
          {scenarios.map((s) => (
            <div key={s.id} className="mb-1.5 flex items-center gap-2 rounded-md border border-border px-2.5 py-2">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-semibold text-brand-dark">{s.name}</div>
                <div className="font-mono text-[10.5px] text-text-3">9 signals · 12 links</div>
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">Proposed scenarios</div>
          {previewError && <div className="mb-1.5 text-[11.5px] text-[#EF4444]">{previewError}</div>}
          {previewLoading && !proposedNames.some(Boolean) ? (
            <div className="py-2 text-[11.5px] text-text-3">Generating scenario logic for these axes…</div>
          ) : (
            proposedNames.map((nm, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-2 rounded-md border border-dashed border-brand-orange100 bg-brand-orangeLight px-2.5 py-2">
                <span className="font-mono text-[9.5px] font-semibold text-brand-orange">{QUADS[i]}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-brand-dark">{nm || "…"}</div>
                  <div className="truncate text-[10.5px] italic text-brand-orange700">{proposedTaglines[i] || "auto-suggested"}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.06em] text-text-3">Signal migration</div>
      <div className="flex flex-col gap-1">
        {migration.map((m) => {
          const c = CONF[m.confidence];
          return (
            <div key={m.sigId} className="flex items-center gap-2.5 rounded-md border border-[#F3F4F6] px-2.5 py-[7px]">
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px] text-white" style={{ background: c.color }}>
                {c.icon}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-brand-dark">{m.title}</span>
              <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                {m.oldQuad} <span style={{ color: c.color }}>→</span> {m.newQuad}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 3 — narratives ──────────────────────────────────────────── */
function StepNarratives({
  scenarios,
  proposedNames,
  narrativeChoices,
  setNarrativeChoices,
  confirmDelete,
  setConfirmDelete,
}: {
  scenarios: Scenario[];
  proposedNames: string[];
  narrativeChoices: Record<string, NarrativeChoice>;
  setNarrativeChoices: React.Dispatch<React.SetStateAction<Record<string, NarrativeChoice>>>;
  confirmDelete: string | null;
  setConfirmDelete: (v: string | null) => void;
}) {
  const OPTIONS: { id: NarrativeChoice; label: string }[] = [
    { id: "migrate", label: "Migrate" },
    { id: "archive", label: "Archive" },
    { id: "delete", label: "Delete" },
  ];
  return (
    <div>
      <div className="mb-3.5 text-[13px] text-muted-foreground">Choose what happens to each existing narrative.</div>
      <div className="flex flex-col gap-2.5">
        {scenarios.map((s, i) => {
          const choice = narrativeChoices[s.id] || "migrate";
          return (
            <div key={s.id} className="rounded-[9px] border border-border px-3 py-2.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="text-[13px] font-semibold text-brand-dark">{s.name}</span>
                {choice === "migrate" && <span className="text-[11px] text-text-3">→ {proposedNames[i] || "new quadrant"}</span>}
              </div>
              <div className="grid grid-cols-3 gap-0.5 rounded-md bg-[#F3F4F6] p-0.5">
                {OPTIONS.map((o) => {
                  const active = choice === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => {
                        if (o.id === "delete") {
                          setConfirmDelete(s.id);
                          return;
                        }
                        setNarrativeChoices((prev) => ({ ...prev, [s.id]: o.id }));
                      }}
                      className={cn(
                        "rounded-md border-0 px-2 py-1.5 text-xs",
                        active
                          ? cn("bg-white shadow-[0_1px_2px_rgba(15,23,42,0.08)] font-semibold", o.id === "delete" ? "text-[#EF4444]" : "text-brand-dark")
                          : "bg-transparent font-medium text-muted-foreground"
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {confirmDelete === s.id && (
                <div className="mt-2 rounded-[7px] border border-[#FECACA] bg-[#FEF2F2] px-2.5 py-2 text-xs text-[#991B1B]">
                  Delete &quot;{s.name}&quot; and its narrative permanently?
                  <div className="mt-1.5 flex gap-2">
                    <button
                      onClick={() => {
                        setNarrativeChoices((prev) => ({ ...prev, [s.id]: "delete" }));
                        setConfirmDelete(null);
                      }}
                      className="rounded-md border-0 bg-[#EF4444] px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      Delete
                    </button>
                    <button onClick={() => setConfirmDelete(null)} className="border-0 bg-transparent text-xs text-muted-foreground">
                      Keep
                    </button>
                  </div>
                </div>
              )}
              {choice === "delete" && confirmDelete !== s.id && <div className="mt-1.5 text-[11px] text-[#EF4444]">Will be deleted on apply.</div>}
              {choice === "archive" && <div className="mt-1.5 text-[11px] text-muted-foreground">Preserved in “Past scenarios.”</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
