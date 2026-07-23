"use server";

// §4 — Step 1: Focal question refine (build order §14 item 4a). Fires from onboarding
// step 1's "Refine with AI" button, before a project exists — see the plan's note on
// runStructured's nullable projectId.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";

const RefineFocalQuestionSchema = z.object({
  refined_question: z.string(),
  changed: z.boolean(),
  rationale: z.array(z.string()).min(1).max(3),
});

const TASK_PROMPT = `Task: Sharpen the user's rough focal question into Schwartz's required form:
a single decision-oriented question, bounded by the stated time horizon,
specific about WHO is deciding and WHAT the decision changes.

Input: { raw_question: string, horizon: string, industry: string }

Requirements for the refined question:
- Must be answerable "yes we should" / "no we shouldn't" or as a choice
  among named options — not an open-ended topic ("the future of X").
- Must name the actual decision-maker's scope (the company / product /
  market), not a generic industry question.
- Must include the time horizon verbatim.
- Must NOT introduce new facts (competitors, markets, financial figures)
  that were not in raw_question — reword and sharpen only.

If raw_question is already well-formed, set changed:false and return it
unmodified rather than rewriting for the sake of it.`;

export async function refineFocalQuestion(input: { rawQuestion: string; horizon: string; industry: string }) {
  return runStructured({
    step: "focal_question.refine",
    projectId: null,
    taskPrompt: TASK_PROMPT,
    input: { raw_question: input.rawQuestion, horizon: input.horizon, industry: input.industry },
    schema: RefineFocalQuestionSchema,
    effort: "medium",
  });
}
