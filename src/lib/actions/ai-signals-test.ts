"use server";

// Signals "Ask AI" Group 4 "Test" (SIGNALS_ASK_AI_PROMPTS.md) — closed-book, adversarial,
// effort:"low", thinking:false, never webSearch (same structural safety net as
// ai-signals-sharpen.ts: these step names are deliberately absent from
// RESEARCH_MODE_ALLOWED_STEPS). Pure read + reasoning over buildSignalsContext, zero writes,
// rendered straight into the Ask AI drawer.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { buildSignalsContext } from "./signals-context";

// ---- 4.1 "What would a sceptic say I've got wrong?" ----
const SkepticPointSchema = z.object({
  signal_id: z.string().nullable(),
  signal_title: z.string().nullable(),
  point: z.string(),
});
const TestSkepticSchema = z.object({
  conventional_wisdom: z.array(SkepticPointSchema),
  easy_to_research_bias: z.array(SkepticPointSchema),
  blind_spot: z.string(),
});

const TEST_SKEPTIC_TASK_PROMPT = `Task: Take the position of a well-informed sceptic reviewing
this signal set before the scenario matrix is built. Be specific and cite signals by name. Do
not soften — the value here is the objection, not the balance.

Input: { focal_question: string, industry: string, signals: [{ id: string, title: string,
         body: string, category: string, impact: number | null }] }

Rules:
- conventional_wisdom: which signals are filler that everyone in industry would list —
  name each by signal_id/signal_title and state the objection in \`point\`.
- easy_to_research_bias: which high-impact scores reflect what was easy to research rather
  than what actually matters to focal_question — same per-item shape.
- blind_spot: one paragraph on what this set would miss entirely if the future rhymes with
  nothing in recent memory (i.e. a genuine discontinuity, not covered by either list above).
- Use signal_id/signal_title: null only for a set-level objection not tied to one specific
  signal (rare — most objections should name a signal).
- If a list has nothing substantive, return it empty rather than padding it.

Output schema:
{ conventional_wisdom: [{ signal_id: string|null, signal_title: string|null, point: string }],
  easy_to_research_bias: (same shape)[],
  blind_spot: string }`;

export interface TestSkepticResult {
  conventionalWisdom: { signalId: string | null; signalTitle: string | null; point: string }[];
  easyToResearchBias: { signalId: string | null; signalTitle: string | null; point: string }[];
  blindSpot: string;
}

export async function runTestSkeptic(projectId: string): Promise<TestSkepticResult> {
  const ctx = await buildSignalsContext(projectId);
  if (ctx.signals.length === 0) return { conventionalWisdom: [], easyToResearchBias: [], blindSpot: "" };

  const output = await runStructured({
    step: "signals.test.skeptic",
    projectId,
    taskPrompt: TEST_SKEPTIC_TASK_PROMPT,
    input: {
      focal_question: ctx.focalQuestion,
      industry: ctx.industry,
      signals: ctx.signals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category, impact: s.impact })),
    },
    schema: TestSkepticSchema,
    effort: "low",
    maxTokens: 6000,
  });

  const toPoints = (arr: z.infer<typeof SkepticPointSchema>[]) => arr.map((p) => ({ signalId: p.signal_id, signalTitle: p.signal_title, point: p.point }));

  return {
    conventionalWisdom: toPoints(output.conventional_wisdom),
    easyToResearchBias: toPoints(output.easy_to_research_bias),
    blindSpot: output.blind_spot,
  };
}

// ---- 4.2 "What did I say keeps me awake — is it covered?" — needs onboarding.awake/good/bad
// (Phase 0). Same soft-fallback convention as Group 1's onboarding-dependent prompts: return a
// graceful "no onboarding data" result rather than blocking client-side. ----
const CoverageItemSchema = z.object({
  covered: z.boolean(),
  covering_signal_titles: z.array(z.string()),
  gap: z.string().nullable(),
});
const TestCoverageSchema = z.object({
  awake: CoverageItemSchema.nullable(),
  good: CoverageItemSchema.nullable(),
  bad: CoverageItemSchema.nullable(),
  most_important_gap: z.string().nullable(),
});

const TEST_COVERAGE_TASK_PROMPT = `Task: Audit the current signal set against 3 statements the
user made during onboarding: what keeps them awake at night, their best case, and their worst
case. For each (when given — some may be null, meaning the user didn't answer that one; skip
those, set them null in your output), state whether the project has signals that would let the
user see it coming, name them if so, and identify the gap if not.

Input: { awake: string | null, good: string | null, bad: string | null,
         signals: [{ id: string, title: string, body: string, category: string }] }

Rules:
- For each non-null statement: covered:true only if one or more EXISTING signals would
  genuinely let the user see this coming — list their titles in covering_signal_titles. If not
  covered, covering_signal_titles is empty and gap explains what's missing.
- Set a statement's whole output object to null only if its input was null.
- most_important_gap names the single most important missing signal across all 3 statements
  and why its absence matters more than the others — null only if all 3 are fully covered (or
  all 3 inputs were null).

Output schema:
{ awake: { covered: boolean, covering_signal_titles: string[], gap: string|null } | null,
  good: (same shape) | null, bad: (same shape) | null,
  most_important_gap: string | null }`;

export interface TestCoverageItem {
  covered: boolean;
  coveringSignalTitles: string[];
  gap: string | null;
}
export interface TestCoverageResult {
  hasOnboardingData: boolean;
  awake: TestCoverageItem | null;
  good: TestCoverageItem | null;
  bad: TestCoverageItem | null;
  mostImportantGap: string | null;
}

function toCoverageItem(c: z.infer<typeof CoverageItemSchema> | null): TestCoverageItem | null {
  if (!c) return null;
  return { covered: c.covered, coveringSignalTitles: c.covering_signal_titles, gap: c.gap };
}

export async function runTestCoverage(projectId: string): Promise<TestCoverageResult> {
  const ctx = await buildSignalsContext(projectId);
  const { awake, good, bad } = ctx.onboarding ?? { awake: null, good: null, bad: null };
  if (!awake && !good && !bad) {
    return { hasOnboardingData: false, awake: null, good: null, bad: null, mostImportantGap: null };
  }

  const output = await runStructured({
    step: "signals.test.coverage",
    projectId,
    taskPrompt: TEST_COVERAGE_TASK_PROMPT,
    input: { awake, good, bad, signals: ctx.signals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category })) },
    schema: TestCoverageSchema,
    effort: "low",
    maxTokens: 4096,
  });

  return {
    hasOnboardingData: true,
    awake: toCoverageItem(output.awake),
    good: toCoverageItem(output.good),
    bad: toCoverageItem(output.bad),
    mostImportantGap: output.most_important_gap,
  };
}

// ---- 4.3 "Wildcards" ----
const WildcardItemSchema = z.object({
  title: z.string(),
  description: z.string(),
  precursor: z.string(),
});
const TestWildcardsSchema = z.object({
  items: z.array(WildcardItemSchema).max(5),
});

const TEST_WILDCARDS_TASK_PROMPT = `Task: Identify low-probability, high-impact discontinuities
relevant to the focal question over the horizon that the current signal set does not cover —
the ones that would invalidate the whole scenario frame rather than move a variable inside it.

Input: { focal_question: string, horizon: string, industry: string,
         existing_signal_titles: string[] }

Rules:
- Limit to 3-5 items.
- Each must be specific enough to have an observable early precursor — name that precursor in
  \`precursor\`. Exclude generic catastrophes with no discriminating early indicator (e.g. a
  bare "global recession" with no specific mechanism named).
- \`description\` is 1-2 sentences on the discontinuity and why it would invalidate the
  scenario frame, not just move one variable.
- These are wildcards, not forces to be ranked on the matrix — do not propose them as
  candidate signals.

Output schema:
{ items: [{ title: string, description: string, precursor: string }] }`;

export interface TestWildcardsResult {
  items: { title: string; description: string; precursor: string }[];
}

export async function runTestWildcards(projectId: string): Promise<TestWildcardsResult> {
  const ctx = await buildSignalsContext(projectId);

  const output = await runStructured({
    step: "signals.test.wildcards",
    projectId,
    taskPrompt: TEST_WILDCARDS_TASK_PROMPT,
    input: { focal_question: ctx.focalQuestion, horizon: ctx.horizon, industry: ctx.industry, existing_signal_titles: ctx.existingSignalTitles },
    schema: TestWildcardsSchema,
    effort: "low",
    maxTokens: 4096,
  });

  return { items: output.items };
}
