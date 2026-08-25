"use client";

// Onboarding wizard — 3 steps. Faithful Tailwind/shadcn port of the handoff onboarding.jsx,
// with Step 1 rebuilt into a multi-block AI interview (focal-interview.tsx) — see that file
// and ai-focal-question.ts for the real backend wiring. Step 2/3 below are unchanged from the
// original single-textarea flow.
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
import { suggestFocalHorizon, draftProjectSummary } from "@/lib/actions/ai-focal-question";
import FocalInterview, { type FocalInterviewCompleteResult } from "./focal-interview";
import { EYEBROW, INDUSTRIES } from "./focal-interview-blocks";

const TOTAL_STEPS = 3;

// Horizon: stable ids (used by step-2 cards + step-3 select), en-dash display labels.
const HORIZONS = [
  { id: "1-2 years", label: "1–2 years", body: "Tactical · operational" },
  { id: "3-5 years", label: "3–5 years", body: "Strategic planning cycle" },
  { id: "5-10 years", label: "5–10 years", body: "Long view — recommended" },
  { id: "10+ years", label: "10+ years", body: "Transformative · directional" },
];

export default function OnboardingPage() {
  const store = useStore();
  const navigate = useNavigate();
  const [step, setStep] = React.useState(store.onboarding.step || 1);
  const [focal, setFocal] = React.useState(store.onboarding.focal || "");
  const [horizon, setHorizon] = React.useState(store.onboarding.horizon || "5-10 years");
  const [name, setName] = React.useState(store.onboarding.name || "");
  const [summary, setSummary] = React.useState(store.onboarding.summary || "");
  const [industry, setIndustry] = React.useState(store.onboarding.industry || "Technology");

  // Mirrors focal-interview.tsx's onboardingRef pattern — draftProjectSummary resolves
  // asynchronously, possibly after the user has already reached Step 3 and started typing;
  // reading this ref (not the render-time `summary` closure) at resolution time is how the
  // "never overwrite what the user already typed" check below stays correct regardless of
  // timing.
  const summaryRef = React.useRef(summary);
  summaryRef.current = summary;
  const [draftingSummary, setDraftingSummary] = React.useState(false);
  const [summaryAiDrafted, setSummaryAiDrafted] = React.useState(false);

  // Fires once FocalInterview's own multi-block interview is complete (a candidate picked, or
  // "Use my wording"). refined stays permanently null going forward — the old flow's separate
  // "refine one raw string" step is superseded by the interview drafting candidates directly.
  const [suggestedHorizon, setSuggestedHorizon] = React.useState<{ horizon: string; rationale: string } | null>(store.onboarding.suggestedHorizon);
  const [continuingStep1, setContinuingStep1] = React.useState(false);

  const persist = (patch: Partial<typeof store.onboarding>) => {
    store.setOnboarding({ ...store.onboarding, ...patch });
  };

  const onFocalInterviewComplete = async ({ focal: pickedFocal, industry: pickedIndustry, companyName }: FocalInterviewCompleteResult) => {
    setFocal(pickedFocal);
    setIndustry(pickedIndustry);
    setName((prev) => prev || companyName);
    setContinuingStep1(true);

    // Fires in true parallel with the horizon suggestion below — never awaited before that
    // block's `finally`, so it adds no latency to the Step 1→2 transition. Resolves in the
    // background while the user reads Step 2's horizon card; by the time they reach Step 3
    // the summary is normally already sitting in the field.
    setDraftingSummary(true);
    draftProjectSummary({
      companyName,
      industry: pickedIndustry,
      focalQuestion: pickedFocal,
      blockA: store.onboarding.blockA,
      blockB: store.onboarding.blockB,
      blockC: store.onboarding.blockC,
      blockD: store.onboarding.blockD,
      research:
        store.onboarding.research.status === "ready" && store.onboarding.research.data
          ? { sufficientEvidence: true, gap: null, ...store.onboarding.research.data }
          : null,
    })
      .then((result) => {
        if (summaryRef.current) return; // user already typed something — never overwrite
        setSummary(result.summary);
        setSummaryAiDrafted(true);
      })
      .catch((err) => console.error("[onboarding] summary draft failed", err))
      .finally(() => setDraftingSummary(false));

    let nextHorizon = horizon;
    let nextSuggestedHorizon = suggestedHorizon;
    try {
      const result = await suggestFocalHorizon({ focalQuestion: pickedFocal });
      nextHorizon = result.suggestedHorizon;
      nextSuggestedHorizon = { horizon: result.suggestedHorizon, rationale: result.rationale };
      setHorizon(nextHorizon);
      setSuggestedHorizon(nextSuggestedHorizon);
    } catch (err) {
      console.error("[onboarding] horizon suggestion failed", err);
    } finally {
      persist({ focal: pickedFocal, refined: null, industry: pickedIndustry, horizon: nextHorizon, suggestedHorizon: nextSuggestedHorizon, step: 2 });
      setContinuingStep1(false);
      setStep(2);
    }
  };

  const [launching, setLaunching] = React.useState(false);

  const launch = async () => {
    persist({ step: 3, focal, refined: null, horizon, name, summary, industry, complete: true });
    setLaunching(true);
    try {
      const proj = await store.createProject({
        name,
        focal_question: focal,
        refined_focal_question: null,
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
        <div
          key={step}
          className={cn(
            "slide-up w-full rounded-2xl border border-border bg-card p-9 shadow-card",
            step === 1 && store.onboarding.companySubmitted ? "max-w-[980px]" : "max-w-[640px]"
          )}
        >
          {step === 1 && <FocalInterview onComplete={onFocalInterviewComplete} submitting={continuingStep1} />}

          {step === 2 && (
            <>
              <div className={EYEBROW}>STEP 2 OF 3 · TIME HORIZON</div>
              <h1 className="mb-2 text-[28px] font-semibold tracking-[-0.02em]">How far ahead?</h1>
              <p className="mb-[22px] text-sm text-muted-foreground">
                Choose a horizon that gives your scenarios room to diverge meaningfully.
              </p>
              <div className="mb-3 grid grid-cols-2 gap-3">
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
              {suggestedHorizon && suggestedHorizon.horizon === horizon && (
                <div className="mb-[22px] flex items-start gap-1.5 rounded-[10px] bg-brand-orangeLight px-3 py-2 text-[11.5px] leading-[1.5] text-brand-orange700">
                  <Icons.Sparkle size={12} stroke="#C2410C" className="mt-0.5 flex-shrink-0" />
                  <span>AI suggested this horizon — {suggestedHorizon.rationale}</span>
                </div>
              )}
              <div className={cn("flex gap-2.5", !suggestedHorizon || suggestedHorizon.horizon !== horizon ? "mt-[19px]" : undefined)}>
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
                    onChange={(e) => {
                      setSummary(e.target.value);
                      setSummaryAiDrafted(false);
                    }}
                    placeholder={draftingSummary ? "Drafting a summary from your answers…" : "Your project summary..."}
                    className={cn("min-h-[80px]", draftingSummary && !summary && "pulse")}
                  />
                  {summaryAiDrafted && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-[1.5] text-brand-orange700">
                      <Icons.Sparkle size={12} stroke="#C2410C" className="mt-0.5 flex-shrink-0" />
                      <span>AI drafted this from your interview answers — edit freely.</span>
                    </div>
                  )}
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
