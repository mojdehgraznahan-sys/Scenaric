"use server";

// §4 — Step 1: Focal question (build order §14 item 4a). Fires from onboarding step 1, before
// a project exists — every call here passes projectId: null (see runStructured's own doc
// comment on that) and page: "onboarding" so its ai_runs rows stay queryable as a unit despite
// having no project_id to group by. Closed-book throughout, with one narrow, explicit
// exception — SCHWARTZ_METHODOLOGY_SKILL.md's research-mode section lists Step 1 as
// closed-book except researchOnboardingContext (§5 below), the only call here that passes
// webSearch; RESEARCH_MODE_ALLOWED_STEPS (ai/client.ts) would reject it on any other call.
//
// Current lineup — the multi-block interview flow (focal-interview.tsx):
//   1. checkFocalCriteria — the 4-criterion scoring rubric, inlined into §6's candidate
//      scoring rather than called standalone by onboarding today; kept exported/unused in
//      case a future page wants a standalone checklist.
//   2. clarifyFocalQuestion — belonged to the old single-textarea flow's reactive "Refine with
//      AI" clarify step; obsolete now that the 4-block interview front-loads richer context
//      than 1-2 reactive questions ever gave. No longer called from onboarding; kept exported.
//   3. refineFocalQuestion — belonged to the old flow's "refine one raw string" step; its
//      shape doesn't fit synthesizing across a whole interview's worth of answers. Superseded
//      by §6's draftFocalQuestionCandidates. No longer called from onboarding; kept exported.
//   4. suggestFocalHorizon — unchanged, still fires once the interview's final "Continue" is
//      clicked, pre-selecting Step 2's horizon.
//   5. researchOnboardingContext — NEW. The interview's one-time research panel, fired after
//      the intro card's company+industry submit. The one explicit exception to this file's
//      closed-book rule — see SCHWARTZ_METHODOLOGY_SKILL.md's research-mode section.
//   6. draftFocalQuestionCandidates — NEW. Synthesizes the interview's block A-D answers (any
//      subset possibly empty/skipped) + research findings into 3 scored candidate questions.
//      Closed-book — never passes webSearch itself.
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { runStructured } from "@/lib/ai/client";
import { AIWebSearchError } from "@/lib/ai/errors";

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

/* ── 5. researchOnboardingContext ─────────────────────────────────────── */
// Onboarding's one narrow, explicit research exception (SCHWARTZ_METHODOLOGY_SKILL.md's
// research-mode section) — fires once, only after the user deliberately submits a company
// name + industry on the interview's intro card. Never re-fires per keystroke, and never
// called from draftFocalQuestionCandidates/checkFocalCriteria below (both stay closed-book).

export interface OnboardingResearchFindings {
  sufficientEvidence: boolean;
  gap: string | null;
  competitors: string | null;
  regulatory: string | null;
  market: string | null;
  macro: string | null;
  recentNews: string | null;
  citations: { title: string; url: string }[];
}

const ResearchContextSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  competitors: z.object({ found: z.boolean(), text: z.string().nullable() }),
  regulatory: z.object({ found: z.boolean(), text: z.string().nullable() }),
  market: z.object({ found: z.boolean(), text: z.string().nullable() }),
  macro: z.object({ found: z.boolean(), text: z.string().nullable() }),
  recent_news: z.object({ found: z.boolean(), text: z.string().nullable() }),
  citations: z.array(z.object({ title: z.string(), url: z.string() })),
});

const RESEARCH_CONTEXT_TASK_PROMPT = `Task: Research the given company (or, if it isn't a
findable public entity, its stated industry generally) using web_search, producing 5 short
sections of background a strategist would want before an interview about a pending decision.
You MUST call the web_search tool at least once and read real results before writing your
final answer — never finalize a response without having actually searched first; an
acknowledgment like "I'll research this now" is never a valid final answer on its own.

Input: { company_name: string, industry: string }

Produce exactly these 5 sections, each 1-2 sentences:
- competitors: notable recent competitor moves (entry, expansion, pricing, M&A) in this
  industry — real, dated where possible.
- regulatory: regulation/compliance changes actually in motion (proposed, enacted, or under
  review) relevant to this industry.
- market: demand/market-structure shifts (growth, consolidation, new entrants, customer-
  behavior shift).
- macro: macro/STEEP-level trends (economic, technological, geopolitical) bearing on this
  industry generally, not company-specific.
- recent_news: the single most relevant recent (last ~90 days) news item you can find and
  date, industry- or company-specific.

Rules:
- Each section's \`found\` is false and \`text\` is null when nothing real turns up via
  web_search for that section — never pad with generic industry-101 commentary to fill it.
- Every sentence must be traceable to something actually found via web_search; never state an
  unfound fact as if researched.
- If company_name is fictional/unfindable, rely on industry-level findings only — set
  found:false for company-specific sections (competitors, recent_news) rather than fabricating
  a company history.
- \`citations\` lists the real title/url of every source actually relied on across all 5
  sections — non-empty whenever sufficient_evidence is true.
- If nothing genuinely relevant turns up for ANY section, return sufficient_evidence:false and
  a gap explaining what you looked for — do not pad with generic commentary to look complete.

Output schema: { sufficient_evidence: boolean, gap: string | null,
  competitors: { found: boolean, text: string | null },
  regulatory: { found: boolean, text: string | null },
  market: { found: boolean, text: string | null },
  macro: { found: boolean, text: string | null },
  recent_news: { found: boolean, text: string | null },
  citations: [{ title: string, url: string }] }`;

export async function researchOnboardingContext(input: { companyName: string; industry: string }): Promise<OnboardingResearchFindings> {
  let output: z.infer<typeof ResearchContextSchema>;
  try {
    output = await runStructured({
      step: "onboarding.research_context",
      projectId: null,
      page: PAGE,
      taskPrompt: RESEARCH_CONTEXT_TASK_PROMPT,
      input: { company_name: input.companyName, industry: input.industry },
      schema: ResearchContextSchema,
      effort: "medium",
      webSearch: { maxUses: 6 },
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }

  return {
    sufficientEvidence: output.sufficient_evidence,
    gap: output.gap,
    competitors: output.competitors.found ? output.competitors.text : null,
    regulatory: output.regulatory.found ? output.regulatory.text : null,
    market: output.market.found ? output.market.text : null,
    macro: output.macro.found ? output.macro.text : null,
    recentNews: output.recent_news.found ? output.recent_news.text : null,
    citations: output.citations,
  };
}

/* ── 6. draftFocalQuestionCandidates ──────────────────────────────────── */
// Closed-book — synthesizes across the user's own block A-D interview answers (any subset may
// be empty/skipped) + company/industry + the already-fetched research findings (context only,
// never re-searched here) into 3 candidate focal questions, each pre-scored against the same
// 4 criteria checkFocalCriteria uses.

export interface FocalInterviewBlockAAnswers {
  keepsAwake: string | null;
  decision5to10yr: string | null;
  ownerAndDeadline: string | null;
  ifWrongBreaks: string | null;
}
export interface FocalInterviewBlockBAnswers {
  oracleQ1: string | null;
  oracleQ2: string | null;
  oracleQ3: string | null;
}
export interface FocalInterviewBlockCAnswers {
  bestCaseAndPath: string | null;
  worstCaseAndPivots: string | null;
  turningPoints: string | null;
}
export interface FocalInterviewBlockDAnswers {
  inevitable: string | null;
  genuinelyUncertain: string | null;
  dependencies: string | null;
}

export interface FocalInterviewAnswers {
  companyName: string;
  industry: string;
  blockA: FocalInterviewBlockAAnswers;
  blockB: FocalInterviewBlockBAnswers;
  blockC: FocalInterviewBlockCAnswers;
  blockD: FocalInterviewBlockDAnswers;
  research: OnboardingResearchFindings | null;
}

export interface FocalQuestionCandidate {
  question: string;
  criteria: FocalCriterion[];
}

const CandidateSchema = z.object({
  question: z.string(),
  owner: z.object({ ok: z.boolean(), reason: z.string() }),
  horizon: z.object({ ok: z.boolean(), reason: z.string() }),
  uncertain: z.object({ ok: z.boolean(), reason: z.string() }),
  action: z.object({ ok: z.boolean(), reason: z.string() }),
});

const DraftCandidatesSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  candidates: z.array(CandidateSchema).length(3),
});

const DRAFT_CANDIDATES_TASK_PROMPT = `Task: Synthesize the user's own interview answers (4
blocks, any subset possibly empty/skipped) plus company/industry plus optional research
findings, into exactly 3 candidate focal questions — Schwartz's required form: a single
decision-oriented question, specific about WHO decides and WHAT changes. Each candidate is
independently pre-scored against Schwartz's 4 requirements, shown to the user as a diagnostic
checklist, not a filter you apply yourself.

Input: { company_name: string, industry: string,
  block_a: { keeps_awake: string|null, decision_5_to_10yr: string|null,
    owner_and_deadline: string|null, if_wrong_breaks: string|null } /* the pending decision */,
  block_b: { oracle_q1: string|null, oracle_q2: string|null, oracle_q3: string|null }
    /* the real uncertainties */,
  block_c: { best_case_and_path: string|null, worst_case_and_pivots: string|null,
    turning_points: string|null } /* both endings, for scope/stakes framing */,
  block_d: { inevitable: string|null, genuinely_uncertain: string|null,
    dependencies: string|null } /* predetermined vs open */,
  research: { competitors, regulatory, market, macro, recent_news: string|null,
    sufficient_evidence: boolean } | null /* context only — never re-search, never treat as
    the user's own words */ }

Score each of these 4 criteria independently, exact same rubric as the live checklist:
- owner: does the candidate name (or clearly imply) WHO actually makes this decision?
- horizon: does the candidate state or clearly bound a time horizon?
- uncertain: does the candidate's outcome remain genuinely open — could this plausibly resolve
  in more than one direction?
- action: is the candidate tied to a real action or investment, not just an abstract topic?

Rules:
- Ground every candidate ONLY in what the user actually wrote in block_a-d plus \`research\` —
  never invent a competitor, regulation, number, or date not present in those inputs.
  \`research\` findings may be referenced only as context (e.g. "given consolidation among
  competitors"), never asserted as something the user said.
- block_a is the primary source of the decision/owner/action; block_b is the primary source of
  genuine uncertainty; block_c's two endings inform scope/stakes (describe them in prose —
  never commit to one of the 4 fixed horizon buckets, which the user picks in a later step);
  block_d's inevitable/uncertain answers sharpen what's genuinely open vs already settled.
- The 3 candidates must be genuinely different framings of the same underlying decision (e.g.
  different central trade-off, different scope, single-option vs choice-among-options) — not
  near-duplicate rewordings of each other.
- Score each candidate's own 4 criteria honestly and specifically — \`reason\` is one sentence
  citing what's actually in (or missing from) that specific candidate, never generic
  boilerplate. A candidate scoring some criteria false should still be returned if it's a
  genuinely useful framing — never silently dropped or padded to look better than it is.
- If block_a's core decision question AND block_b's oracle question are BOTH empty/skipped,
  and no other block has enough concrete content to ground a real decision, return
  sufficient_evidence:false and a gap explaining what's missing — do not fabricate a
  plausible-sounding question from company/industry alone. Still return 3 candidates in this
  case if you genuinely can from whatever partial content exists; only use
  sufficient_evidence:false when there is truly nothing decision-shaped to draft from.

Output schema: { sufficient_evidence: boolean, gap: string | null,
  candidates: [{ question: string, owner: {ok,reason}, horizon: {ok,reason},
    uncertain: {ok,reason}, action: {ok,reason} }] } // exactly 3 items`;

export async function draftFocalQuestionCandidates(
  input: FocalInterviewAnswers
): Promise<{ sufficientContent: boolean; gap: string | null; candidates: FocalQuestionCandidate[] }> {
  const output = await runStructured({
    step: "focal_question.draft_candidates",
    projectId: null,
    page: PAGE,
    taskPrompt: DRAFT_CANDIDATES_TASK_PROMPT,
    input: {
      company_name: input.companyName,
      industry: input.industry,
      block_a: {
        keeps_awake: input.blockA.keepsAwake,
        decision_5_to_10yr: input.blockA.decision5to10yr,
        owner_and_deadline: input.blockA.ownerAndDeadline,
        if_wrong_breaks: input.blockA.ifWrongBreaks,
      },
      block_b: { oracle_q1: input.blockB.oracleQ1, oracle_q2: input.blockB.oracleQ2, oracle_q3: input.blockB.oracleQ3 },
      block_c: {
        best_case_and_path: input.blockC.bestCaseAndPath,
        worst_case_and_pivots: input.blockC.worstCaseAndPivots,
        turning_points: input.blockC.turningPoints,
      },
      block_d: { inevitable: input.blockD.inevitable, genuinely_uncertain: input.blockD.genuinelyUncertain, dependencies: input.blockD.dependencies },
      research: input.research
        ? {
            competitors: input.research.competitors,
            regulatory: input.research.regulatory,
            market: input.research.market,
            macro: input.research.macro,
            recent_news: input.research.recentNews,
            sufficient_evidence: input.research.sufficientEvidence,
          }
        : null,
    },
    schema: DraftCandidatesSchema,
    effort: "high",
    thinking: true,
  });

  const order: CriterionId[] = ["owner", "horizon", "uncertain", "action"];
  return {
    sufficientContent: output.sufficient_evidence,
    gap: output.gap,
    candidates: output.candidates.map((c) => ({
      question: c.question,
      criteria: order.map((id) => ({ id, label: CRITERION_LABEL[id], ok: c[id].ok, reason: c[id].reason })),
    })),
  };
}
