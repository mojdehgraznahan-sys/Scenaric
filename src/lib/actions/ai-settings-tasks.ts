"use server";

// Settings page's "Ask AI" — a fixed task menu (ask-ai.tsx's context="settings" branch),
// never freeform (freeform is ai-settings-chat.ts). All three tasks mirror the Schwartz-form
// rubric ai-focal-question.ts's refineFocalQuestion already encodes for onboarding's
// pre-project (projectId: null) flow — that file is left untouched; these are the
// project-scoped variants, each logging against a real projectId.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { z } from "zod";

const FOCAL_QUESTION_FORM_RULES = `A well-formed focal question must:
- Be answerable "yes we should" / "no we shouldn't", or as a choice among named options —
  never an open-ended topic ("the future of X").
- Name the actual decision-maker's scope (the company / product / market), not a generic
  industry question.
- Include the time horizon verbatim.
- Never introduce new facts (competitors, markets, financial figures) not present in the
  project's own data.`;

// ─────────────────────── Task 1: Draft a focal question from my project description ───────

const DraftFocalQuestionSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  focal_question: z.string(),
  horizon: z.string(),
  rationale: z.string(),
});

const DRAFT_TASK_PROMPT = `Task: Propose a focal question in Schwartz's required form (see rules
below) for this project, grounded in its name/industry/summary and any existing signals — a
first draft the user must explicitly review and accept, never silently applied.

Input: { name: string, industry: string, horizon: string, summary: string,
         existing_signal_titles: string[] }

${FOCAL_QUESTION_FORM_RULES}

Rules:
- If summary/name/industry give too little to ground a real decision-specific question,
  return sufficient_evidence:false and a gap explaining what's missing — do not guess a
  generic-sounding question to look complete.
- horizon should be the given horizon if one exists and is usable, else a reasonable proposal
  consistent with the industry/signals given.
- rationale is 1-2 sentences explaining why this framing fits the project.

Output schema:
{ sufficient_evidence: boolean, gap: string | null, focal_question: string, horizon: string,
  rationale: string }`;

export interface DraftFocalQuestionResult {
  sufficientEvidence: boolean;
  gap: string | null;
  focalQuestion: string;
  horizon: string;
  rationale: string;
}

export async function draftFocalQuestion(projectId: string): Promise<DraftFocalQuestionResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name, industry, horizon, summary")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const { data: signals, error: signalsError } = await supabase.from("signals").select("title").eq("project_id", projectId);
  if (signalsError) throw signalsError;

  const output = await runStructured({
    step: "settings_ask_ai.draft_focal_question",
    projectId,
    taskPrompt: DRAFT_TASK_PROMPT,
    input: {
      name: project.name,
      industry: project.industry,
      horizon: project.horizon,
      summary: project.summary,
      existing_signal_titles: signals.map((s) => s.title),
    },
    schema: DraftFocalQuestionSchema,
    effort: "medium",
  });

  return {
    sufficientEvidence: output.sufficient_evidence,
    gap: output.gap,
    focalQuestion: output.focal_question,
    horizon: output.horizon,
    rationale: output.rationale,
  };
}

// ─────────────────────── Task 2: Sharpen my focal question ───────────────────────

const SharpenFocalQuestionSchema = z.object({
  alternatives: z
    .array(
      z.object({
        refined_question: z.string(),
        rationale: z.string(),
      })
    )
    .min(2)
    .max(3),
});

const SHARPEN_TASK_PROMPT = `Task: Tighten the project's current focal question into 2-3
alternative, sharper phrasings per Schwartz's required form — the user picks one, never
auto-applied.

Input: { current_question: string, horizon: string, industry: string }

${FOCAL_QUESTION_FORM_RULES}

Rules:
- Each alternative must be a genuinely different sharpening (different decision framing or
  scope), not near-duplicate rewordings of each other.
- rationale is one sentence per alternative explaining what it tightens vs. the current
  question.
- Never introduce a new fact not already implied by current_question/industry.

Output schema:
{ alternatives: [{ refined_question: string, rationale: string }] } (2-3 items)`;

export interface SharpenFocalQuestionResult {
  alternatives: { refinedQuestion: string; rationale: string }[];
}

export async function sharpenFocalQuestion(projectId: string): Promise<SharpenFocalQuestionResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, horizon, industry")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  const currentQuestion = project.refined_focal_question ?? project.focal_question;

  const output = await runStructured({
    step: "settings_ask_ai.sharpen_focal_question",
    projectId,
    taskPrompt: SHARPEN_TASK_PROMPT,
    input: { current_question: currentQuestion, horizon: project.horizon, industry: project.industry },
    schema: SharpenFocalQuestionSchema,
    effort: "medium",
  });

  return { alternatives: output.alternatives.map((a) => ({ refinedQuestion: a.refined_question, rationale: a.rationale })) };
}

// ─────────────────────── Task 3: Is this focal question too broad/narrow? ───────────────

const CritiqueFocalQuestionSchema = z.object({
  verdict: z.enum(["too_broad", "too_narrow", "well_scoped"]),
  rationale: z.string(),
});

const CRITIQUE_TASK_PROMPT = `Task: Critique-only — judge whether the project's current focal
question is too broad, too narrow, or well-scoped per Schwartz's required form. Never propose
a rewrite; this task only narrates a diagnosis.

Input: { current_question: string, horizon: string, industry: string }

${FOCAL_QUESTION_FORM_RULES}

Rules:
- too_broad: reads as an open-ended topic rather than a bounded decision.
- too_narrow: so specific it wouldn't meaningfully vary across different plausible futures —
  scenarios wouldn't actually change the answer.
- well_scoped: satisfies the form rules above.
- rationale is 2-3 sentences citing the specific wording that drove the verdict.

Output schema: { verdict: "too_broad"|"too_narrow"|"well_scoped", rationale: string }`;

export interface CritiqueFocalQuestionResult {
  verdict: "too_broad" | "too_narrow" | "well_scoped";
  rationale: string;
}

export async function critiqueFocalQuestion(projectId: string): Promise<CritiqueFocalQuestionResult> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, horizon, industry")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  const currentQuestion = project.refined_focal_question ?? project.focal_question;

  const output = await runStructured({
    step: "settings_ask_ai.critique_focal_question",
    projectId,
    taskPrompt: CRITIQUE_TASK_PROMPT,
    input: { current_question: currentQuestion, horizon: project.horizon, industry: project.industry },
    schema: CritiqueFocalQuestionSchema,
    effort: "low",
    thinking: false,
  });

  return { verdict: output.verdict, rationale: output.rationale };
}
