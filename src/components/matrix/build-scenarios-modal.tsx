"use client";

// Build Scenarios modal — first-time scenario creation from the chosen axes.
// Three steps: confirm axes → preview & name → confirm. On commit it writes four
// fresh scenarios (one per quadrant) and routes to the Canvas. Faithful port of
// build-scenarios-modal.jsx; bespoke overlay + dynamic quadrant colors stay inline.
import * as React from "react";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Navigate } from "@/lib/use-navigate";
import type { Quadrant, SteepCategory } from "@/lib/types";
import type { IndependenceResult } from "@/lib/actions/ai-matrix";
import { axisMeta } from "./axis-data";

const QUAD_COLOR: Record<Quadrant, string> = { TL: "#3B82F6", TR: "#10B981", BL: "#EF4444", BR: "#F97316" };
const QUAD_TINT: Record<Quadrant, string> = { TL: "#EFF6FF", TR: "#FFF7ED", BL: "#FEF2F2", BR: "rgba(245,243,255,0.6)" };
const ORDER: Quadrant[] = ["TL", "TR", "BL", "BR"];

const NAME_POOL = [
  "Open Horizons", "Sovereign Silos", "Tidal Shift", "Monsoon Markets",
  "Archipelago", "Crosscurrents", "Safe Harbor", "Riptide",
  "Trade Winds", "Storm Front", "Calm Waters", "High Tide",
];

function pickNames(seedStr: string, n: number) {
  let h = seedStr.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  const pool = [...NAME_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

const CAT_COLOR: Record<SteepCategory, string> = {
  Social: "#8B5CF6",
  Technology: "#3B82F6",
  Economic: "#10B981",
  Ecological: "#14B8A6",
  Political: "#EF4444",
};

interface FmWindow extends Window {
  FM_toast?: (opts: { message: string; actionText?: string; action?: string; duration?: number }) => void;
}

export function BuildScenariosModal({
  open,
  onClose,
  navigate,
  independence,
}: {
  open: boolean;
  onClose: () => void;
  navigate: Navigate;
  independence: IndependenceResult | null;
}) {
  const store = useStore();
  const signals = store.signals || store.seed.signals;
  const dots = store.matrixDots || [];
  const currentAxes = store.criticalUncertainties || [];

  const [step, setStep] = React.useState(1);
  const [axes, setAxes] = React.useState<string[]>(currentAxes);
  const [changingFor, setChangingFor] = React.useState<number | null>(null);
  const [names, setNames] = React.useState<string[]>([]);
  const [regen, setRegen] = React.useState(0);
  const [openCanvas, setOpenCanvas] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [building, setBuilding] = React.useState(false);

  const candidates = React.useMemo(
    () => dots.filter((d) => d.bucket === "critical_uncertainty").map((d) => signals.find((s) => s.id === d.sigId)).filter(Boolean),
    [dots, signals]
  ) as typeof signals;

  const sigById = (id: string) => signals.find((s) => s.id === id);
  const a = axisMeta(sigById(axes[0]));
  const b = axisMeta(sigById(axes[1]));

  const suggested = React.useMemo(() => pickNames((axes[0] || "") + "|" + (axes[1] || "") + "|" + regen, 4), [axes, regen]);

  React.useEffect(() => {
    setNames(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested.join()]);

  React.useEffect(() => {
    if (open) {
      setStep(1);
      setAxes(currentAxes);
      setChangingFor(null);
      setRegen(0);
      setOpenCanvas(true);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const axesValid = !!axes[0] && !!axes[1] && axes[0] !== axes[1];
  // Independence must have already passed (real AI check, run on the Matrix page as soon as
  // 2 candidates are selected) — mirrors the server-side rejection in buildScenarios itself,
  // so the button reflects the block instead of only surfacing it after a failed call.
  const canBuild = axesValid && independence?.state === "independent";

  const build = async () => {
    if (!canBuild || !store.activeProjectId) {
      setError(
        !axesValid
          ? "Pick two different axes first."
          : "These axes aren't independent yet — pick a different pair or resolve the correlation."
      );
      return;
    }
    setBuilding(true);
    setError(null);
    try {
      const requestedNames: Partial<Record<Quadrant, string>> = {};
      ORDER.forEach((q, i) => {
        if (names[i]?.trim()) requestedNames[q] = names[i];
      });
      await store.buildScenarios({
        projectId: store.activeProjectId,
        axisA: { signalId: axes[0], label: a.axis, polePos: a.pos, poleNeg: a.neg },
        axisB: { signalId: axes[1], label: b.axis, polePos: b.pos, poleNeg: b.neg },
        independenceState: independence!.state,
        independenceRationale: independence!.rationale,
        requestedNames,
      });
      try {
        localStorage.removeItem("fm.reaxReview");
      } catch {}
      onClose();
      const w = window as FmWindow;
      if (w.FM_toast) w.FM_toast({ message: "4 scenarios created", actionText: "Open Canvas", action: "open-canvas", duration: 4000 });
      if (openCanvas && navigate) navigate("/canvas");
    } catch (err) {
      console.error("[matrix] buildScenarios failed", err);
      setError("Couldn't build scenarios. Try again or pick different axes.");
    } finally {
      setBuilding(false);
    }
  };

  // Esc close, body lock, Enter = primary.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") {
        const tag = (document.activeElement && document.activeElement.tagName) || "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (step < 3) {
          if (axesValid) setStep((s) => s + 1);
        } else if (canBuild && !building) build();
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  });

  if (!open) return null;

  const STEPS = [
    { n: 1, label: "Confirm axes" },
    { n: 2, label: "Preview & name" },
    { n: 3, label: "Confirm" },
  ];

  const AxisSlot = ({ slot }: { slot: number }) => {
    const sig = sigById(axes[slot]);
    const m = axisMeta(sig);
    return (
      <div className="relative flex-1">
        <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">Axis {slot + 1}</div>
        <div className="flex items-center gap-2 rounded-[9px] border border-border px-3 py-2.5">
          <span className="h-[9px] w-[9px] flex-shrink-0 rounded-full" style={{ background: (sig && CAT_COLOR[sig.category]) || "#9CA3AF" }} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-brand-dark">{m.axis}</div>
            <div className="truncate text-[11px] text-text-3">{sig && sig.title}</div>
          </div>
          <button onClick={() => setChangingFor(changingFor === slot ? null : slot)} className="flex-shrink-0 border-0 bg-transparent text-xs font-medium text-brand-orange">
            Change
          </button>
        </div>
        {changingFor === slot && (
          <div className="slide-up absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-[220px] overflow-auto rounded-[10px] border border-border bg-white p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.14)]">
            {candidates.map((c) => {
              const sel = axes[slot] === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setAxes((prev) => {
                      const nx = [...prev];
                      nx[slot] = c.id;
                      return nx;
                    });
                    setChangingFor(null);
                  }}
                  className={cn("flex w-full items-center gap-2 rounded-[7px] border-0 px-2.5 py-2 text-left", sel ? "bg-brand-orangeLight" : "bg-transparent hover:bg-[#FAFAFA]")}
                >
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: CAT_COLOR[c.category] }} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-brand-dark">{c.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Build your scenarios"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fade-in fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(30,27,46,0.40)] p-6 backdrop-blur-[4px]"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="slide-up relative flex max-h-[calc(100vh-48px)] w-full max-w-[640px] flex-col rounded-xl bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.25),0_8px_24px_rgba(15,23,42,0.12)]"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-0 bg-transparent text-muted-foreground hover:bg-bg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="6" y1="18" x2="18" y2="6" />
          </svg>
        </button>

        <div className="pr-8">
          <h2 className="text-xl font-semibold tracking-[-0.01em] text-brand-dark">Build your scenarios</h2>
          <div className="mt-1 text-[13.5px] text-muted-foreground">Confirm your two axes and we&apos;ll generate four scenarios.</div>
        </div>

        {/* Stepper */}
        <div className="my-4 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <button onClick={() => (s.n === 1 || axesValid) && setStep(s.n)} className="flex items-center gap-[7px] border-0 bg-transparent p-0">
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

        <div className="scroll-y min-h-[180px] flex-1 overflow-auto">
          {step === 1 && (
            <div>
              <div className="flex items-start gap-3.5">
                <AxisSlot slot={0} />
                <div className="pt-[30px] text-base text-text-3">×</div>
                <AxisSlot slot={1} />
              </div>
              <div className="mt-4 rounded-[9px] bg-[#F9FAFB] px-3 py-2.5 text-[12.5px] text-muted-foreground">
                Axes:{" "}
                <strong className="font-semibold text-brand-dark">
                  {a.axis} × {b.axis}
                </strong>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="flex gap-1.5">
                <div className="flex w-4 items-center justify-center">
                  <span className="whitespace-nowrap text-[10px] uppercase tracking-[0.6px] text-muted-foreground [writing-mode:vertical-rl] [transform:rotate(180deg)]">{a.axis}</span>
                </div>
                <div className="flex-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    {ORDER.map((q, i) => {
                      const combo = { TL: `${a.pos} + ${b.neg}`, TR: `${a.pos} + ${b.pos}`, BL: `${a.neg} + ${b.neg}`, BR: `${a.neg} + ${b.pos}` }[q];
                      return (
                        <div key={q} className="flex min-h-[78px] flex-col gap-1.5 rounded-md p-2.5" style={{ background: QUAD_TINT[q] }}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold" style={{ color: QUAD_COLOR[q] }}>
                              {q}
                            </span>
                            {q === "TR" && (
                              <span className="font-mono text-[8.5px] font-semibold uppercase" style={{ color: QUAD_COLOR[q] }}>
                                Best case
                              </span>
                            )}
                          </div>
                          <input
                            value={names[i] || ""}
                            onChange={(e) =>
                              setNames((prev) => {
                                const nx = [...prev];
                                nx[i] = e.target.value;
                                return nx;
                              })
                            }
                            placeholder="Name…"
                            className="w-full border-0 border-b border-dashed border-b-transparent bg-transparent p-0 text-[12.5px] font-semibold text-brand-dark outline-none"
                            onFocus={(e) => (e.target.style.borderBottomColor = QUAD_COLOR[q])}
                            onBlur={(e) => (e.target.style.borderBottomColor = "transparent")}
                          />
                          <div className="mt-auto text-[10.5px] text-muted-foreground">{combo}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 text-center">
                    <span className="text-[10px] uppercase tracking-[0.6px] text-muted-foreground">{b.axis}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setRegen((r) => r + 1)} className="mt-2.5 inline-flex items-center gap-[5px] border-0 bg-transparent p-0 text-xs font-medium text-brand-orange">
                <span className="text-[13px] leading-none">↻</span> Regenerate names
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              {independence && independence.state !== "independent" && (
                <div className="mb-3 rounded-md border border-[rgba(245,158,11,0.4)] bg-[#FFFBEB] p-2.5 text-[12.5px] text-[#92400E]">
                  These axes came back <strong>{independence.state}</strong> in the independence
                  check — building is blocked until you pick a different pair.
                </div>
              )}
              <div className="mb-3.5 text-[13.5px] leading-[1.5] text-[#374151]">
                This will create <strong className="text-brand-dark">4 new scenarios</strong>, with AI-generated logic and
                summaries for each quadrant. You can edit, rename, or delete them later on the Canvas page.
              </div>
              <label className="flex cursor-pointer items-center gap-[9px] text-[13px] text-brand-dark">
                <span
                  onClick={() => setOpenCanvas((o) => !o)}
                  className={cn("inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[5px] border-[1.5px]", openCanvas ? "border-brand-orange bg-brand-orange" : "border-border-strong bg-white")}
                >
                  {openCanvas && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                Open the Canvas page after building
              </label>
              <div className="mt-3.5 flex flex-col gap-1.5">
                {ORDER.map((q, i) => (
                  <div key={q} className="flex items-center gap-2 text-[12.5px] text-brand-dark">
                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: QUAD_COLOR[q] }} />
                    <span className="font-semibold">{names[i] || suggested[i]}</span>
                    <span className="font-mono text-[10.5px] text-text-3">{q}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3.5 rounded-md border border-[rgba(239,68,68,0.4)] bg-[#FEF2F2] p-3">
              <div className="mb-1.5 text-[12.5px] text-[#991B1B]">{error}</div>
              <button onClick={build} className="border-0 bg-transparent p-0 text-[12.5px] font-semibold text-[#EF4444]">
                Retry
              </button>
            </div>
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
            {step < 3 ? (
              <button
                onClick={() => axesValid && setStep(step + 1)}
                disabled={!axesValid}
                className="rounded-md border-0 bg-brand-orange px-4 py-2 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                onClick={build}
                disabled={!canBuild || building}
                className="rounded-md border-0 bg-brand-orange px-4 py-2 text-[13.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {building ? "Building…" : "Build scenarios →"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
