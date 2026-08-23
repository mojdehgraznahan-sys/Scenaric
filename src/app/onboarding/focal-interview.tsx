"use client";

// Onboarding Step 1 — the multi-block AI interview that replaced the old single-textarea +
// live-criteria-checklist flow. Reads/writes store.onboarding directly (same convention the
// rest of the onboarding wizard already uses) rather than being a fully controlled component;
// page.tsx stays a thin wizard shell and only receives the final picked focal question via
// onComplete once the whole interview is done. See ai-focal-question.ts for the backend calls
// this drives (researchOnboardingContext, draftFocalQuestionCandidates) and
// SCHWARTZ_METHODOLOGY_SKILL.md's research-mode section for why the research call is the one
// narrow exception to this page's otherwise closed-book reasoning.
import * as React from "react";
import { Icons } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { researchOnboardingContext, draftFocalQuestionCandidates } from "@/lib/actions/ai-focal-question";
import {
  EYEBROW,
  INDUSTRIES,
  INTRO_COPY,
  FOCAL_INTERVIEW_BLOCKS,
  SKIP_BLOCK_LABEL,
  BLOCK_HELPER_TEXT,
  CANDIDATES_HEADING,
  PICKED_FOCAL_PROMPT,
  type BlockCopy,
} from "./focal-interview-blocks";

type OnboardingSnapshot = ReturnType<typeof useStore>["onboarding"];
type BlockId = "A" | "B" | "C" | "D";
const BLOCK_ORDER: BlockId[] = ["A", "B", "C", "D"];

const RESEARCH_SECTIONS: { key: "competitors" | "regulatory" | "market" | "macro" | "recentNews"; label: string }[] = [
  { key: "competitors", label: "Competitors" },
  { key: "regulatory", label: "Regulatory" },
  { key: "market", label: "Market" },
  { key: "macro", label: "Macro" },
  { key: "recentNews", label: "Recent news" },
];

// The cast on each branch is safe: FOCAL_INTERVIEW_BLOCKS' question ids (focal-interview-
// blocks.ts) are hand-written to exactly match each block's field names, but the blocks'
// interfaces (store.tsx) intentionally have no index signature — so a plain assignment to
// Record<string,string> needs an explicit cast here rather than losing that per-block
// key-checking at every other read site.
function blockValues(onboarding: OnboardingSnapshot, id: BlockId): Record<string, string> {
  if (id === "A") return onboarding.blockA as unknown as Record<string, string>;
  if (id === "B") return onboarding.blockB as unknown as Record<string, string>;
  if (id === "C") return onboarding.blockC as unknown as Record<string, string>;
  return onboarding.blockD as unknown as Record<string, string>;
}

type TranscriptEntry = { kind: "user" | "ai" | "system"; text: string };

function buildTranscript(onboarding: OnboardingSnapshot): TranscriptEntry[] {
  const entries: TranscriptEntry[] = [];
  if (onboarding.companySubmitted) {
    entries.push({ kind: "user", text: `${onboarding.companyName} — ${onboarding.industry}` });
  }
  for (const block of FOCAL_INTERVIEW_BLOCKS) {
    const status = onboarding.blockStatus[block.id];
    if (status === "pending") break;
    entries.push({ kind: "ai", text: block.intro });
    if (status === "active") break;
    if (status === "answered") {
      const values = blockValues(onboarding, block.id);
      const combined = block.questions
        .map((q) => values[q.id] ?? "")
        .map((v) => v.trim())
        .filter(Boolean)
        .join(" · ");
      entries.push({ kind: "user", text: combined });
    } else {
      entries.push({ kind: "system", text: `Block ${block.id} skipped` });
    }
  }
  if (onboarding.pickedFocal) {
    entries.push({ kind: "ai", text: PICKED_FOCAL_PROMPT });
    entries.push({ kind: "user", text: onboarding.pickedFocal });
  }
  return entries;
}

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  if (entry.kind === "system") {
    return <div className="px-1 text-[11.5px] text-text-3">{entry.text}</div>;
  }
  return (
    <div
      className={cn(
        "max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[12.5px] leading-[1.5]",
        entry.kind === "ai" ? "self-start bg-bg text-brand-dark" : "self-end bg-brand-orange text-white"
      )}
    >
      {entry.text}
    </div>
  );
}

function BlockStepper({ blockStatus }: { blockStatus: OnboardingSnapshot["blockStatus"] }) {
  return (
    <div className="mb-1 flex gap-4">
      {FOCAL_INTERVIEW_BLOCKS.map((b) => {
        const status = blockStatus[b.id];
        const barColor = status === "pending" ? "bg-border" : status === "active" ? "bg-brand-orange" : "bg-[#15803D]";
        const textColor = status === "pending" ? "text-text-3" : status === "active" ? "text-brand-orange" : "text-[#15803D]";
        return (
          <div key={b.id} className="flex-1">
            <div className={cn("mb-1.5 h-[3px] rounded-full", barColor)} />
            <div className={cn("font-mono text-[10px] uppercase tracking-[0.05em]", textColor)}>
              {b.stepperLabel}
              {status === "skipped" && <span className="text-text-3"> · skipped</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// `values` is always one of onboarding.blockA/B/C/D, cast to Record<string,string> by the
// caller (those interfaces intentionally have no index signature — see blockValues' comment
// above). `q.id` (from the copy data) is hand-written to exactly match each block's field
// names, so indexing/assigning through it here is safe despite the loosened prop type.
function BlockForm({
  copy,
  values,
  onChange,
  onSubmit,
  researchCallout,
}: {
  copy: BlockCopy;
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
  researchCallout?: React.ReactNode;
}) {
  return (
    <div className="slide-up rounded-[14px] border border-dashed border-brand-orange100 bg-brand-orangeLight p-4">
      {researchCallout}
      <div className="flex flex-col gap-3">
        {copy.questions.map((q) => (
          <div key={q.id}>
            <Label className="mb-1 block text-[12.5px] text-brand-orange700">
              {q.label}
              {q.optional && <span className="font-normal text-text-3"> · optional</span>}
            </Label>
            <Textarea
              rows={2}
              value={values[q.id] ?? ""}
              onChange={(e) => onChange(q.id, e.target.value)}
              placeholder={q.placeholder}
              className="min-h-[54px] bg-white"
            />
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" onClick={onSubmit}>
          {copy.continueLabel} <Icons.ArrowRight size={12} />
        </Button>
        <Button variant="ghost" size="sm" onClick={onSubmit}>
          {SKIP_BLOCK_LABEL}
        </Button>
        <span className="ml-auto text-[11px] text-text-3">{BLOCK_HELPER_TEXT}</span>
      </div>
    </div>
  );
}

function ResearchPanel({ research, onRetry }: { research: OnboardingSnapshot["research"]; onRetry: () => void }) {
  return (
    <div className="h-fit rounded-[14px] border border-border bg-white p-4">
      <div className="mb-3 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.06em] text-brand-orange">
        <Icons.Sparkle size={12} /> Research findings
      </div>

      {research.status === "loading" && (
        <div className="pulse flex flex-col gap-2.5">
          {RESEARCH_SECTIONS.map((s) => (
            <div key={s.key} className="h-9 rounded-md bg-bg" />
          ))}
        </div>
      )}

      {research.status === "error" && (
        <div className="text-[12.5px] text-muted-foreground">
          Couldn&apos;t research this right now.
          <Button variant="ghost" size="sm" className="mt-2 block" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {research.status === "ready" && research.data && (
        <>
          <div className="mb-3 rounded-[8px] bg-[#EFF6FF] px-2.5 py-1.5 text-[10.5px] text-[#1D4ED8]">
            🌐 Live research — verify independently
          </div>
          <div className="flex flex-col gap-3">
            {RESEARCH_SECTIONS.map((s) => (
              <div key={s.key}>
                <div className="mb-0.5 text-[12.5px] font-semibold">{s.label}</div>
                <div className="text-[12px] leading-[1.5] text-muted-foreground">{research.data![s.key] || "Nothing current found."}</div>
              </div>
            ))}
          </div>
          {research.data.citations.length > 0 && (
            <ul className="m-0 mt-3 flex list-none flex-col gap-0.5 border-t border-border p-0 pt-2.5">
              {research.data.citations.map((c, i) => (
                <li key={i} className="truncate">
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-[11px] text-brand-orange">
                    {c.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function CandidatePicker({
  candidates,
  candidatesGap,
  drafting,
  rawWording,
  onPick,
  onGoBackToA,
}: {
  candidates: OnboardingSnapshot["candidates"];
  candidatesGap: string | null;
  drafting: boolean;
  rawWording: string;
  onPick: (question: string) => void;
  onGoBackToA: () => void;
}) {
  if (drafting || !candidates) {
    return (
      <div className="pulse rounded-[14px] border border-dashed border-brand-orange100 bg-brand-orangeLight p-3.5 font-mono text-[13px] text-brand-orange700">
        Drafting your focal question…
      </div>
    );
  }

  const rawWordingEmpty = !rawWording.trim();

  return (
    <div className="slide-up flex flex-col gap-2.5">
      <p className="text-[13px] text-muted-foreground">{CANDIDATES_HEADING}</p>

      {candidatesGap && (
        <div className="rounded-[10px] border border-[#FECACA] bg-[#FEF2F2] p-3 text-[12.5px] text-[#7F1D1D]">
          {candidatesGap}
          <Button variant="ghost" size="sm" className="mt-2 block" onClick={onGoBackToA}>
            Go back to Block A
          </Button>
        </div>
      )}

      {candidates.map((c, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick(c.question)}
          className="rounded-[14px] border border-brand-orange100 bg-brand-orangeLight p-4 text-left transition-[border] duration-150 hover:border-brand-orange"
        >
          <p className="mb-2 text-sm leading-[1.55] text-brand-orange700">{c.question}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {c.criteria.map((cr) => (
              <div key={cr.id} title={cr.reason} className={cn("flex items-center gap-1.5 text-[11.5px]", cr.ok ? "text-[#15803D]" : "text-text-3")}>
                <span
                  className={cn(
                    "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full text-[9px]",
                    cr.ok ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#F3F4F6] text-text-3"
                  )}
                >
                  {cr.ok ? "✓" : "·"}
                </span>
                {cr.label}
              </div>
            ))}
          </div>
        </button>
      ))}

      <button
        type="button"
        onClick={() => onPick(rawWording)}
        disabled={rawWordingEmpty}
        className="rounded-[14px] border border-border bg-white p-4 text-left text-sm leading-[1.55] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {rawWordingEmpty ? "Use my wording — nothing answered yet" : rawWording}
      </button>
    </div>
  );
}

export interface FocalInterviewCompleteResult {
  focal: string;
  industry: string;
  companyName: string;
}

export default function FocalInterview({
  onComplete,
  submitting = false,
}: {
  onComplete: (result: FocalInterviewCompleteResult) => void;
  submitting?: boolean;
}) {
  const store = useStore();
  const onboarding = store.onboarding;

  // Mirrors focalRef's role in the old page.tsx — async callbacks below (the research fetch,
  // the candidate draft) span real time, during which other fields (e.g. block answers the
  // user is still typing) can change; reading this ref instead of the render-time `onboarding`
  // closure keeps persist() merging onto the latest snapshot rather than a stale one.
  const onboardingRef = React.useRef(onboarding);
  onboardingRef.current = onboarding;

  const persist = React.useCallback(
    (patch: Partial<OnboardingSnapshot>) => {
      store.setOnboarding({ ...onboardingRef.current, ...patch });
    },
    [store]
  );

  const [companyDraft, setCompanyDraft] = React.useState(onboarding.companyName);
  const [industryDraft, setIndustryDraft] = React.useState(onboarding.industry || "Technology");
  const [draftingCandidates, setDraftingCandidates] = React.useState(false);

  // 1b — fires exactly once, right after the intro card is submitted (companySubmitted flips
  // true) — never re-fires per keystroke. See SCHWARTZ_METHODOLOGY_SKILL.md's research-mode
  // section for why this is the one call in this whole file allowed to pass webSearch.
  React.useEffect(() => {
    if (!onboarding.companySubmitted || onboarding.research.status !== "idle") return;
    let cancelled = false;
    persist({ research: { status: "loading", data: null, error: null } });
    researchOnboardingContext({ companyName: onboardingRef.current.companyName, industry: onboardingRef.current.industry })
      .then((result) => {
        if (cancelled) return;
        persist({
          research: {
            status: "ready",
            data: {
              competitors: result.competitors,
              regulatory: result.regulatory,
              market: result.market,
              macro: result.macro,
              recentNews: result.recentNews,
              citations: result.citations,
            },
            error: null,
          },
        });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[onboarding] research context failed", err);
        persist({ research: { status: "error", data: null, error: "Couldn't research this right now." } });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding.companySubmitted, onboarding.research.status]);

  // 1d — fires once all 4 blocks are past pending/active, regardless of how much was actually
  // answered; draftFocalQuestionCandidates's own sufficient_evidence escape valve (rendered as
  // candidatesGap) is what protects against drafting from a genuinely empty interview, not a
  // guard here.
  React.useEffect(() => {
    if (onboarding.activeBlock !== null || onboarding.candidates !== null || onboarding.pickedFocal !== null || draftingCandidates) return;
    setDraftingCandidates(true);
    const snap = onboardingRef.current;
    draftFocalQuestionCandidates({
      companyName: snap.companyName,
      industry: snap.industry,
      blockA: snap.blockA,
      blockB: snap.blockB,
      blockC: snap.blockC,
      blockD: snap.blockD,
      research: snap.research.status === "ready" && snap.research.data ? { sufficientEvidence: true, gap: null, ...snap.research.data } : null,
    })
      .then((result) => {
        persist({ candidates: result.candidates, candidatesGap: result.sufficientContent ? null : result.gap });
      })
      .catch((err) => {
        console.error("[onboarding] draft focal question candidates failed", err);
        persist({ candidatesGap: "Something went wrong drafting your focal question — try going back and answering a bit more." });
      })
      .finally(() => setDraftingCandidates(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding.activeBlock, onboarding.candidates, onboarding.pickedFocal, draftingCandidates]);

  const submitIntro = () => {
    if (!companyDraft.trim()) return;
    persist({ companyName: companyDraft.trim(), industry: industryDraft, companySubmitted: true });
  };

  const retryResearch = () => {
    persist({ research: { status: "idle", data: null, error: null } });
  };

  const handleBlockSubmit = (block: BlockId) => {
    const values = blockValues(onboardingRef.current, block);
    const hasAnyAnswer = Object.values(values).some((v) => v.trim().length > 0);
    const idx = BLOCK_ORDER.indexOf(block);
    const next = BLOCK_ORDER[idx + 1] ?? null;
    persist({
      blockStatus: { ...onboardingRef.current.blockStatus, [block]: hasAnyAnswer ? "answered" : "skipped", ...(next ? { [next]: "active" } : {}) },
      activeBlock: next,
    });
  };

  const goBackToBlockA = () => {
    persist({
      activeBlock: "A",
      blockStatus: { ...onboardingRef.current.blockStatus, A: "active" },
      candidates: null,
      candidatesGap: null,
    });
  };

  const onPickCandidate = (question: string) => {
    if (!question.trim()) return;
    persist({ pickedFocal: question });
  };

  const rawWording = React.useMemo(() => {
    return [
      ...Object.values(onboarding.blockA),
      ...Object.values(onboarding.blockB),
      ...Object.values(onboarding.blockC),
      ...Object.values(onboarding.blockD),
    ]
      .map((v) => v.trim())
      .filter(Boolean)
      .join(" · ");
  }, [onboarding.blockA, onboarding.blockB, onboarding.blockC, onboarding.blockD]);

  const researchCallout = React.useMemo(() => {
    if (onboarding.research.status !== "ready" || !onboarding.research.data) return null;
    const bits = [onboarding.research.data.competitors, onboarding.research.data.regulatory].filter((v): v is string => !!v);
    if (bits.length === 0) return null;
    return (
      <div className="mb-3 rounded-[10px] border border-dashed border-brand-orange300 bg-white/60 p-2.5 text-[12px] leading-[1.5] text-brand-orange700">
        <Icons.Sparkle size={11} stroke="#C2410C" className="mr-1 inline" />
        From research — candidate actors: {bits.join(" ")} Add them if they belong.
      </div>
    );
  }, [onboarding.research]);

  const transcript = React.useMemo(() => buildTranscript(onboarding), [onboarding]);
  const showResearchPanel = onboarding.companySubmitted && !onboarding.pickedFocal;

  return (
    <>
      <div className={EYEBROW}>STEP 1 OF 3 · FOCAL QUESTION</div>
      <h1 className="mb-2 text-[28px] font-semibold tracking-[-0.02em]">{INTRO_COPY.title}</h1>
      <p className="mb-[22px] text-sm text-muted-foreground">{INTRO_COPY.subtitle}</p>

      <div className={cn("grid gap-6", showResearchPanel ? "lg:grid-cols-[1fr_320px]" : "grid-cols-1")}>
        <div className="flex flex-col gap-3">
          {!onboarding.companySubmitted ? (
            <div className="rounded-[14px] border border-dashed border-brand-orange100 bg-brand-orangeLight p-4">
              <p className="mb-3 text-[13px] leading-[1.55] text-brand-orange700">{INTRO_COPY.calloutTitle}</p>
              <div className="flex flex-col gap-2.5">
                <Input value={companyDraft} onChange={(e) => setCompanyDraft(e.target.value)} placeholder="Company name" className="bg-white" />
                <Select value={industryDraft} onValueChange={setIndustryDraft}>
                  <SelectTrigger className="bg-white">
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
                <Button variant="primary" className="mt-1" onClick={submitIntro} disabled={!companyDraft.trim()}>
                  Continue <Icons.ArrowRight size={14} />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <BlockStepper blockStatus={onboarding.blockStatus} />

              <div className="flex flex-col gap-2">
                {transcript.map((entry, i) => (
                  <TranscriptBubble key={i} entry={entry} />
                ))}
              </div>

              {onboarding.activeBlock === "A" && (
                <BlockForm
                  copy={FOCAL_INTERVIEW_BLOCKS[0]}
                  values={onboarding.blockA as unknown as Record<string, string>}
                  onChange={(field, value) => persist({ blockA: { ...onboardingRef.current.blockA, [field]: value } })}
                  onSubmit={() => handleBlockSubmit("A")}
                />
              )}
              {onboarding.activeBlock === "B" && (
                <BlockForm
                  copy={FOCAL_INTERVIEW_BLOCKS[1]}
                  values={onboarding.blockB as unknown as Record<string, string>}
                  onChange={(field, value) => persist({ blockB: { ...onboardingRef.current.blockB, [field]: value } })}
                  onSubmit={() => handleBlockSubmit("B")}
                />
              )}
              {onboarding.activeBlock === "C" && (
                <BlockForm
                  copy={FOCAL_INTERVIEW_BLOCKS[2]}
                  values={onboarding.blockC as unknown as Record<string, string>}
                  onChange={(field, value) => persist({ blockC: { ...onboardingRef.current.blockC, [field]: value } })}
                  onSubmit={() => handleBlockSubmit("C")}
                />
              )}
              {onboarding.activeBlock === "D" && (
                <BlockForm
                  copy={FOCAL_INTERVIEW_BLOCKS[3]}
                  values={onboarding.blockD as unknown as Record<string, string>}
                  onChange={(field, value) => persist({ blockD: { ...onboardingRef.current.blockD, [field]: value } })}
                  onSubmit={() => handleBlockSubmit("D")}
                  researchCallout={researchCallout}
                />
              )}

              {onboarding.activeBlock === null && !onboarding.pickedFocal && (
                <CandidatePicker
                  candidates={onboarding.candidates}
                  candidatesGap={onboarding.candidatesGap}
                  drafting={draftingCandidates}
                  rawWording={rawWording}
                  onPick={onPickCandidate}
                  onGoBackToA={goBackToBlockA}
                />
              )}

              {onboarding.pickedFocal && (
                <Button
                  variant="primary"
                  className="mt-2 w-full rounded-[14px] px-4 py-3"
                  disabled={submitting}
                  onClick={() =>
                    onComplete({ focal: onboarding.pickedFocal!, industry: onboarding.industry, companyName: onboarding.companyName })
                  }
                >
                  {submitting ? "Thinking…" : "Continue"} <Icons.ArrowRight size={14} />
                </Button>
              )}
            </>
          )}
        </div>

        {showResearchPanel && <ResearchPanel research={onboarding.research} onRetry={retryResearch} />}
      </div>
    </>
  );
}
