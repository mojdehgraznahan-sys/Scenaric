"use server";

// Settings page's "Ask AI" — a fixed task menu (ask-ai.tsx's context="settings" branch),
// never freeform (freeform is ai-settings-chat.ts). A third task, draftFocalQuestion, used to
// live here too — removed (Ask AI audit, 2026-10-14 follow-up): every project reaching this
// page was already given a non-empty focal_question during onboarding (onboarding won't let
// you launch a project without picking one), and Settings' own inline Ask-AI panel
// (page-settings.tsx) never offered a draft chip in the first place. These two tasks are the
// real post-onboarding gap: onboarding never re-checks or re-sharpens the question once picked.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { PERSONA_DECISION_CLARIFIER } from "@/lib/ai/personas";
import { getOnboardingAnswers } from "./projects";
import { decisionFraming, theUnknowns } from "@/lib/onboarding/prompt-context";
import { z } from "zod";

const FOCAL_QUESTION_FORM_RULES = `A well-formed focal question must:
- Be answerable "yes we should" / "no we shouldn't", or as a choice among named options —
  never an open-ended topic ("the future of X").
- Name the actual decision-maker's scope (the company / product / market), not a generic
  industry question.
- Include the time horizon verbatim.
- Never introduce new facts (competitors, markets, financial figures) not present in the
  project's own data.`;

const ONBOARDING_INPUT_DOC = `onboarding_decision: { decision: string|null, owner: string|null, stakes: string|null } | null
  /* the user's own onboarding answers on what's actually being decided, who decides it, and
  what breaks if it's gotten wrong — context only, never a substitute for real grounding */,
  onboarding_unknowns: { o1: string|null, o2: string|null, o3: string|null } | null
  /* the user's own "oracle question" drafts of their real uncertainties from onboarding —
  context only, never a license to introduce a fact not otherwise in evidence */`;

// ─────────────────────── Task 1: Sharpen my focal question ───────────────────────

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

const SHARPEN_TASK_PROMPT = `${PERSONA_DECISION_CLARIFIER}

Task: Tighten the project's current focal question into 2-3
alternative, sharper phrasings per Schwartz's required form — the user picks one, never
auto-applied.

Input: { current_question: string, horizon: string, industry: string,
  ${ONBOARDING_INPUT_DOC} }

${FOCAL_QUESTION_FORM_RULES}

Rules:
- Each alternative must be a genuinely different sharpening (different decision framing or
  scope), not near-duplicate rewordings of each other.
- rationale is one sentence per alternative explaining what it tightens vs. the current
  question.
- When onboarding is given, prefer sharpenings that stay faithful to onboarding_decision's
  stakes and that resemble onboarding_unknowns where one is a close fit — never force a match
  that isn't genuinely there.
- Never introduce a new fact not already implied by current_question/industry/onboarding.

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
  const onboarding = await getOnboardingAnswers(projectId);

  const output = await runStructured({
    step: "settings_ask_ai.sharpen_focal_question",
    projectId,
    taskPrompt: SHARPEN_TASK_PROMPT,
    input: {
      current_question: currentQuestion,
      horizon: project.horizon,
      industry: project.industry,
      onboarding_decision: decisionFraming(onboarding),
      onboarding_unknowns: theUnknowns(onboarding),
    },
    schema: SharpenFocalQuestionSchema,
    effort: "medium",
  });

  return { alternatives: output.alternatives.map((a) => ({ refinedQuestion: a.refined_question, rationale: a.rationale })) };
}

// ─────────────────────── Task 2: Is this focal question too broad/narrow? ───────────────

const CritiqueFocalQuestionSchema = z.object({
  verdict: z.enum(["too_broad", "too_narrow", "well_scoped"]),
  rationale: z.string(),
});

const CRITIQUE_TASK_PROMPT = `${PERSONA_DECISION_CLARIFIER}

Task: Critique-only — judge whether the project's current focal
question is too broad, too narrow, or well-scoped per Schwartz's required form. Never propose
a rewrite; this task only narrates a diagnosis.

Input: { current_question: string, horizon: string, industry: string,
  ${ONBOARDING_INPUT_DOC} }

${FOCAL_QUESTION_FORM_RULES}

Rules:
- too_broad: reads as an open-ended topic rather than a bounded decision.
- too_narrow: so specific it wouldn't meaningfully vary across different plausible futures —
  scenarios wouldn't actually change the answer.
- well_scoped: satisfies the form rules above.
- When onboarding is given, weigh the verdict against whether the question actually resolves
  onboarding_decision's stakes and stays close to what onboarding_unknowns actually asked —
  not just a generic judgment of the wording in isolation.
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
  const onboarding = await getOnboardingAnswers(projectId);

  const output = await runStructured({
    step: "settings_ask_ai.critique_focal_question",
    projectId,
    taskPrompt: CRITIQUE_TASK_PROMPT,
    input: {
      current_question: currentQuestion,
      horizon: project.horizon,
      industry: project.industry,
      onboarding_decision: decisionFraming(onboarding),
      onboarding_unknowns: theUnknowns(onboarding),
    },
    schema: CritiqueFocalQuestionSchema,
    effort: "low",
    thinking: false,
  });

  return { verdict: output.verdict, rationale: output.rationale };
}
