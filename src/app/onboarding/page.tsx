"use client";

// Onboarding wizard — 3 steps. Faithful Tailwind/shadcn port of the handoff onboarding.jsx.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { useNavigate } from "@/lib/use-navigate";
import { refineFocalQuestion } from "@/lib/actions/ai-focal-question";

const TOTAL_STEPS = 3;
const EYEBROW = "mb-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-brand-orange";

// Horizon: stable ids (used by step-2 cards + step-3 select), en-dash display labels.
const HORIZONS = [
  { id: "1-2 years", label: "1–2 years", body: "Tactical · operational" },
  { id: "3-5 years", label: "3–5 years", body: "Strategic planning cycle" },
  { id: "5-10 years", label: "5–10 years", body: "Long view — recommended" },
  { id: "10+ years", label: "10+ years", body: "Transformative · directional" },
];

const INDUSTRIES = ["Technology", "Financial Services", "Energy", "Healthcare", "Consumer Goods", "Public Sector"];

export default function OnboardingPage() {
  const store = useStore();
  const navigate = useNavigate();
  const [step, setStep] = React.useState(store.onboarding.step || 1);
  const [focal, setFocal] = React.useState(store.onboarding.focal || "");
  const [refined, setRefined] = React.useState<string | null>(store.onboarding.refined);
  const [refining, setRefining] = React.useState(false);
  const [refineError, setRefineError] = React.useState<string | null>(null);
  const [horizon, setHorizon] = React.useState(store.onboarding.horizon || "5-10 years");
  const [name, setName] = React.useState(store.onboarding.name || "");
  const [summary, setSummary] = React.useState(store.onboarding.summary || "");
  const [industry, setIndustry] = React.useState(store.onboarding.industry || "Technology");

  const persist = (patch: Partial<typeof store.onboarding>) => {
    store.setOnboarding({ ...store.onboarding, ...patch });
  };

  const focalReady = focal.trim().length >= 20;

  const refine = async () => {
    if (!focalReady) return;
    setRefining(true);
    setRefineError(null);
    try {
      const result = await refineFocalQuestion({ rawQuestion: focal, horizon, industry });
      setRefined(result.refined_question);
    } catch (err) {
      console.error("[onboarding] focal question refine failed", err);
      setRefineError("Couldn't refine your focal question right now — try again in a moment.");
    } finally {
      setRefining(false);
    }
  };

  const [launching, setLaunching] = React.useState(false);

  const launch = async () => {
    persist({ step: 3, focal, refined, horizon, name, summary, industry, complete: true });
    setLaunching(true);
    try {
      const proj = await store.createProject({
        name,
        focal_question: focal,
        refined_focal_question: refined,
        horizon,
        industry,
        summary,
      });
      store.setActiveProjectId(proj.id);
      navigate("/home");
    } catch (err) {
      console.error("[onboarding] failed to create project", err);
      setLaunching(false);
    }
  };

  return (
    <div data-screen-label={`Onboarding step ${step}`} className="flex min-h-screen flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center border-b border-border bg-white px-8 py-3.5">
        <div className="flex items-center gap-2.5">
          <Icons.Logo size={26} />
          <span className="text-sm font-semibold">Scenaric.ai</span>
        </div>
        <div className="ml-auto font-mono text-[13px] text-muted-foreground">
          Step {step} of {TOTAL_STEPS}
        </div>
      </div>
      {/* Progress */}
      <div className="h-1 bg-border">
        <div
          className="h-full bg-brand-orange transition-[width] duration-[350ms]"
          style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Body */}
      <div className="flex flex-1 items-start justify-center px-6 py-14">
        <div key={step} className="slide-up w-full max-w-[640px] rounded-2xl border border-border bg-card p-9 shadow-card">
          {step === 1 && (
            <>
              <div className={EYEBROW}>STEP 1 OF 3 · FOCAL QUESTION</div>
              <h1 className="mb-2 text-[28px] font-semibold tracking-[-0.02em]">What decision are you planning for?</h1>
              <p className="mb-[22px] text-sm text-muted-foreground">
                This is your <strong className="text-brand-dark">focal question</strong> — the strategic decision
                scenario planning will help you navigate.
              </p>

              <Textarea
                rows={4}
                value={focal}
                onChange={(e) => setFocal(e.target.value)}
                className="min-h-[110px] rounded-[14px] p-3.5 text-[15px] leading-[1.55]"
                placeholder="e.g. How should we approach SEA market entry given geopolitical uncertainty?"
              />
              <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-text-3">
                <span>{focal.length} characters</span>
                <span>{focalReady ? "" : `${Math.max(0, 20 - focal.length)} more for AI refine`}</span>
              </div>

              {focalReady && (
                <Button variant="soft" className="mt-3.5 w-full px-3 py-2.5" onClick={refine} disabled={refining}>
                  <Icons.Sparkle size={14} />
                  {refining ? "Refining…" : "Refine with AI"}
                </Button>
              )}

              {refining && (
                <div className="pulse mt-3.5 rounded-[14px] border border-dashed border-brand-orange100 bg-brand-orangeLight p-3.5 font-mono text-[13px] text-brand-orange700">
                  AI is sharpening your question…
                </div>
              )}

              {refineError && !refining && (
                <div className="mt-3.5 rounded-[14px] border border-[#FECACA] bg-[#FEF2F2] p-3.5 text-[13px] text-[#7F1D1D]">
                  {refineError}
                </div>
              )}

              {refined && !refining && (
                <div className="slide-up mt-3.5 rounded-[14px] border border-brand-orange100 bg-brand-orangeLight p-4">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Icons.Sparkle size={12} stroke="#C2410C" />
                    <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-brand-orange700">
                      AI refined version
                    </span>
                  </div>
                  <p className="mb-3 text-sm leading-[1.55] text-brand-orange700">{refined}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setFocal(refined);
                        setRefined(null);
                      }}
                    >
                      Use this version
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setRefined(null)}>
                      Keep original
                    </Button>
                  </div>
                </div>
              )}

              <Button
                variant="primary"
                className="mt-[22px] w-full rounded-[14px] px-4 py-3"
                disabled={!focalReady}
                onClick={() => {
                  persist({ focal, refined, step: 2 });
                  setStep(2);
                }}
              >
                Continue <Icons.ArrowRight size={14} />
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className={EYEBROW}>STEP 2 OF 3 · TIME HORIZON</div>
              <h1 className="mb-2 text-[28px] font-semibold tracking-[-0.02em]">How far ahead?</h1>
              <p className="mb-[22px] text-sm text-muted-foreground">
                Choose a horizon that gives your scenarios room to diverge meaningfully.
              </p>
              <div className="mb-[22px] grid grid-cols-2 gap-3">
                {HORIZONS.map((h) => {
                  const selected = horizon === h.id;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setHorizon(h.id)}
                      className={cn(
                        "rounded-xl text-left transition-[border,background] duration-150",
                        selected
                          ? "border-2 border-brand-orange bg-brand-orangeLight px-[15px] py-[13px]"
                          : "border border-border bg-white px-4 py-3.5 hover:border-border-strong"
                      )}
                    >
                      <div className="mb-[3px] text-base font-semibold">{h.label}</div>
                      <div className="text-xs text-muted-foreground">{h.body}</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2.5">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep(1);
                    persist({ step: 1 });
                  }}
                >
                  <Icons.ArrowLeft size={14} /> Back
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 rounded-[14px] px-4 py-3"
                  onClick={() => {
                    persist({ horizon, step: 3 });
                    setStep(3);
                  }}
                >
                  Continue <Icons.ArrowRight size={14} />
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className={EYEBROW}>STEP 3 OF 3 · PROJECT</div>
              <h1 className="mb-2 text-[28px] font-semibold tracking-[-0.02em]">Name your project</h1>
              <p className="mb-[22px] text-sm text-muted-foreground">
                Give it a memorable name so the team can find it later.
              </p>

              <div className="flex flex-col gap-3.5">
                <div>
                  <Label htmlFor="proj-name" className="mb-1.5 block text-[13px]">
                    Project name
                  </Label>
                  <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="APAC Expansion 2030" />
                </div>
                <div>
                  <Label htmlFor="proj-summary" className="mb-1.5 block text-[13px]">
                    Summary <span className="font-normal text-text-3">· optional</span>
                  </Label>
                  <Textarea
                    id="proj-summary"
                    rows={3}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Your project summary..."
                    className="min-h-[80px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <Label className="mb-1.5 block text-[13px]">Horizon</Label>
                    <Select value={horizon} onValueChange={setHorizon}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HORIZONS.map((h) => (
                          <SelectItem key={h.id} value={h.id}>
                            {h.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-[13px]">Industry</Label>
                    <Select value={industry} onValueChange={setIndustry}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mt-[22px] flex gap-2.5">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep(2);
                    persist({ step: 2 });
                  }}
                >
                  <Icons.ArrowLeft size={14} /> Back
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 rounded-[14px] px-4 py-3"
                  onClick={launch}
                  disabled={!name.trim() || launching}
                >
                  <Icons.Rocket size={14} /> {launching ? "Launching…" : "Launch project"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
