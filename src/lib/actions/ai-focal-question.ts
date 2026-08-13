"use server";

// §4 — Step 1: Focal question (build order §14 item 4a). Fires from onboarding step 1, before
// a project exists — every call here passes projectId: null (see runStructured's own doc
// comment on that) and page: "onboarding" so its ai_runs rows stay queryable as a unit despite
// having no project_id to group by. Closed-book throughout — SCHWARTZ_METHODOLOGY_SKILL.md's
// research-mode table lists Step 1 as "No" research; none of the 4 calls below pass webSearch,
// and RESEARCH_MODE_ALLOWED_STEPS (ai/client.ts) would reject it if one ever tried to.
//
// Four calls, one per onboarding Step 1 interaction:
//   1. checkFocalCriteria — debounced ~500ms as the user types, live 4-criterion checklist.
//   2. clarifyFocalQuestion — "Refine with AI" clicked while any criterion is unmet.
//   3. refineFocalQuestion — after clarify answers (or immediately if nothing was missing).
//   4. suggestFocalHorizon — once Step 1's "Continue" is clicked, pre-selects Step 2's horizon.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";

const PAGE = "onboarding";

/* ── 1. checkFocalCriteria ────────────────────────────────────────────── */

const CRITERION_LABEL: Record<CriterionId, string> = {
  owner: "Names a decision-owner",
  horizon: "Bounded time horizon",
  uncertain: "Outcome is genuinely uncertain",
  action: "Tied to a real action or investment",
};

type CriterionId = "owner" | "horizon" | "uncertain" | "action";

export interface FocalCriterion {
  // Widened to `string` (rather than the narrower CriterionId) so this matches
  // OnboardingState's plain-string persisted shape (store.tsx) without store.tsx needing to
  // import this module's internal criterion-id union.
  id: string;
  label: string;
  ok: boolean;
  reason: string;
}

const CheckFocalCriteriaSchema = z.object({
  owner: z.object({ ok: z.boolean(), reason: z.string() }),
  horizon: z.object({ ok: z.boolean(), reason: z.string() }),
  uncertain: z.object({ ok: z.boolean(), reason: z.string() }),
  action: z.object({ ok: z.boolean(), reason: z.string() }),
});

const CHECK_TASK_PROMPT = `Task: Score a draft focal question against Schwartz's 4 requirements for
a well-formed focal question — a live checklist shown while the user is still typing, not a
final judgment.

Input: { draft_text: string }

Score each of these 4 criteria independently:
- owner: does the draft name (or clearly imply) WHO actually makes this decision — a specific
  team/company/role, not a passive or generic subject?
- horizon: does the draft state or clearly bound a time horizon for the decision?
- uncertain: does the draft's outcome remain genuinely open — could this plausibly resolve in
  more than one direction — rather than being a foregone conclusion or a statement of fact?
- action: is the draft tied to a real action or investment (enter, launch, expand, build,
  acquire, partner, invest, etc.), not just an abstract topic?

Rules:
- \`reason\` is one short sentence explaining the score, specific to what's actually in (or
  missing from) draft_text — never generic boilerplate.
- Judge only what's actually written — do not give credit for an intention you're inferring
  charitably. A very short or empty draft_text should score every criterion false.
- This is a live, in-progress check — be encouraging but honest; don't inflate scores to avoid
  discouraging the user mid-typing.

Output schema:
{ owner: { ok: boolean, reason: string }, horizon: { ok: boolean, reason: string },
  uncertain: { ok: boolean, reason: string }, action: { ok: boolean, reason: string } }`;

export async function checkFocalCriteria(input: { draftText: string }): Promise<{ criteria: FocalCriterion[] }> {
  const output = await runStructured({
    step: "focal_question.check",
    projectId: null,
    page: PAGE,
    taskPrompt: CHECK_TASK_PROMPT,
    input: { draft_text: input.draftText },
    schema: CheckFocalCriteriaSchema,
    effort: "low",
    thinking: false,
  });

  const order: CriterionId[] = ["owner", "horizon", "uncertain", "action"];
  return {
    criteria: order.map((id) => ({
      id,
      label: CRITERION_LABEL[id],
      ok: output[id].ok,
      reason: output[id].reason,
    })),
  };
}

/* ── 2. clarifyFocalQuestion ──────────────────────────────────────────── */

export interface ClarifyQuestion {
  criterionId: string;
  question: string;
}

const ClarifyFocalQuestionSchema = z.object({
  questions: z
    .array(z.object({ criterion_id: z.string(), question: z.string() }))
    .min(1)
    .max(2),
});

const CLARIFY_TASK_PROMPT = `Task: The user's draft focal question is missing one or more of Schwartz's
4 requirements. Ask 1-2 short, specific questions that would let you fix the SPECIFIC thing(s)
missing — never a generic "tell me more."

Input: { draft_text: string, missing_criteria: string[] /* subset of
         "owner"|"horizon"|"uncertain"|"action" */ }

Rules:
- One question per missing criterion, tailored to that criterion specifically:
  - missing "owner" → ask who actually makes this decision (a specific team/role/company).
  - missing "horizon" → ask over what timeframe this decision needs to be made.
  - missing "uncertain" → ask what could plausibly happen instead — a second, different way
    this could play out — to confirm the outcome is genuinely open rather than a foregone
    conclusion.
  - missing "action" → ask what specific action, investment, or commitment is actually on the
    table.
- If more than 2 criteria are missing, ask about the 2 most foundational ones first (owner and
  action matter more than horizon/uncertain, since those two are usually salvageable by
  rewording once the actor and the ask are clear).
- Each question must be answerable in one short sentence — never multi-part.
- Reference the draft's own content where it helps (e.g. "You mention Southeast Asia — who at
  your company owns that call?") rather than a fully generic question, when the draft gives you
  something concrete to react to.

Output schema:
{ questions: [{ criterion_id: string, question: string }] } // 1-2 items`;

export async function clarifyFocalQuestion(input: { draftText: string; missingCriteria: string[] }): Promise<{ questions: ClarifyQuestion[] }> {
  const output = await runStructured({
    step: "focal_question.clarify",
    projectId: null,
    page: PAGE,
    taskPrompt: CLARIFY_TASK_PROMPT,
    input: { draft_text: input.draftText, missing_criteria: input.missingCriteria },
    schema: ClarifyFocalQuestionSchema,
    effort: "low",
  });

  return { questions: output.questions.map((q) => ({ criterionId: q.criterion_id, question: q.question })) };
}

/* ── 3. refineFocalQuestion ───────────────────────────────────────────── */

const RefineFocalQuestionSchema = z.object({
  primary: z.string(),
  alternatives: z.array(z.string()).length(2),
});

const REFINE_TASK_PROMPT = `Task: Sharpen the user's rough focal question into Schwartz's required form:
a single decision-oriented question, bounded by the stated time horizon, specific about WHO is
deciding and WHAT the decision changes. Produce one primary rewrite plus 2 alternative framings.

Input: { raw_question: string, horizon: string, industry: string,
         clarify_answers: [{ criterion_id: string, question: string, answer: string }]
         /* the user's own answers to targeted clarifying questions, when asked — use these as
         real grounding for who decides / why now / what's actually uncertain, never invent
         this context yourself when clarify_answers is empty */ }

Requirements — \`primary\` AND each of the 2 \`alternatives\` must independently satisfy all 4:
- Must be answerable "yes we should" / "no we shouldn't" or as a choice among named options —
  not an open-ended topic ("the future of X").
- Must name the actual decision-maker's scope (the company / product / market), using
  clarify_answers' owner answer when provided — not a generic industry question.
- Must include the time horizon verbatim.
- Must NOT introduce new facts (competitors, markets, financial figures) that were not in
  raw_question or clarify_answers — reword and sharpen only, never fabricate detail to sound
  more specific.

\`primary\` is your best single rewrite. The 2 \`alternatives\` must be genuinely different
framings of the same underlying decision (e.g. different sequencing, different central
trade-off, single-option-vs-choice-among-options) — not minor rewordings of \`primary\`.

If raw_question is already well-formed, \`primary\` may return it close to unmodified — but
still provide 2 meaningfully different alternative framings.

Output schema:
{ primary: string, alternatives: [string, string] }`;

export async function refineFocalQuestion(input: {
  rawQuestion: string;
  horizon: string;
  industry: string;
  clarifyAnswers?: { criterionId: string; question: string; answer: string }[];
}): Promise<{ primary: string; alternatives: string[] }> {
  return runStructured({
    step: "focal_question.refine",
    projectId: null,
    page: PAGE,
    taskPrompt: REFINE_TASK_PROMPT,
    input: {
      raw_question: input.rawQuestion,
      horizon: input.horizon,
      industry: input.industry,
      clarify_answers: (input.clarifyAnswers ?? []).map((a) => ({ criterion_id: a.criterionId, question: a.question, answer: a.answer })),
    },
    schema: RefineFocalQuestionSchema,
    effort: "medium",
  });
}

/* ── 4. suggestFocalHorizon ───────────────────────────────────────────── */

const HORIZON_VALUES = ["1-2 years", "3-5 years", "5-10 years", "10+ years"] as const;

const SuggestFocalHorizonSchema = z.object({
  suggested_horizon: z.enum(HORIZON_VALUES),
  rationale: z.string(),
});

const SUGGEST_HORIZON_TASK_PROMPT = `Task: Given a finalized focal question, suggest which of 4 fixed time
horizons best fits the decision it describes — pre-selecting Step 2's horizon picker, which the
user can still freely override.

Input: { focal_question: string }

Horizon rubric (pick exactly one, do not invent a different range):
- "1-2 years": tactical/operational decisions with a near-term deadline.
- "3-5 years": a standard strategic planning cycle.
- "5-10 years": genuinely long-view decisions where forces need real room to diverge.
- "10+ years": transformative, directional decisions (infrastructure, market creation, etc.).

Rules:
- Base the choice only on what the focal_question itself implies about deadline/scope/stakes —
  never assume a default.
- \`rationale\` is one sentence citing the specific mechanism (e.g. "regulatory cycles in this
  market typically play out over 5+ years"), not a vibe.

Output schema:
{ suggested_horizon: "1-2 years"|"3-5 years"|"5-10 years"|"10+ years", rationale: string }`;

export async function suggestFocalHorizon(input: { focalQuestion: string }): Promise<{ suggestedHorizon: (typeof HORIZON_VALUES)[number]; rationale: string }> {
  const output = await runStructured({
    step: "focal_question.suggest_horizon",
    projectId: null,
    page: PAGE,
    taskPrompt: SUGGEST_HORIZON_TASK_PROMPT,
    input: { focal_question: input.focalQuestion },
    schema: SuggestFocalHorizonSchema,
    effort: "low",
  });

  return { suggestedHorizon: output.suggested_horizon, rationale: output.rationale };
}
