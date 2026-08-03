"use server";

// Scenario grounding — combines Signpost and Plausibility score (SCHWARTZ_METHODOLOGY_SKILL.md's
// "Signpost" and "Plausibility / confidence score" sections) into ONE web-search-grounded Claude
// call instead of two, since both need the same current-news research. Replaces the earlier
// separate checkScenarioPlausibility (ai-plausibility.ts) and generateSignposts (ai-signposts.ts) —
// neither had any caller yet, so this is a straight replacement, not a parallel path. Still
// distinct from the static, build-order Step 8 `indicators` table and from
// `scenarios.plausible`/`implausibility_note` (Step 5's one-time, static axis-logic coherence
// judgment) — never conflate either with its canonical cousin.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { StorylineScenarioNotFoundError, AIWebSearchError } from "@/lib/ai/errors";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";

type SignpostRow = Database["public"]["Tables"]["signposts"]["Row"];

const ScenarioGroundingSchema = z.object({
  // Plausibility half — unconditional: always produce a score + rationale, even if current
  // events say nothing either way, same as the standalone check this replaces. Never gated on
  // sufficient_evidence — "nothing directly relevant found" is itself a valid, honestly-
  // reported answer here, not a failure state.
  confidence_score: z.number().int().min(0).max(100),
  // min(20): observed in testing that the model can occasionally return an empty rationale
  // alongside a nonsensical/inconsistent score and garbled gap text — internally inconsistent
  // output that still satisfied a bare z.string(). This is short enough to allow a terse real
  // rationale but rejects the empty-string degenerate case, which sends it back through
  // runStructured's existing retry-once-on-schema-failure path instead of writing garbage to
  // plausibility_checks.
  plausibility_rationale: z.string().min(20),
  sources: z.array(z.object({ title: z.string(), url: z.string(), snippet: z.string() })),
  // Signposts half — gated: forcing weak/generic signposts when nothing discriminating was
  // found is worse than returning none.
  signposts_sufficient_evidence: z.boolean(),
  // min(10) for the same reason as plausibility_rationale above — only enforced when present
  // (the field itself stays optional).
  signposts_gap: z.string().min(10).optional(),
  signposts: z
    .array(
      z.object({
        text: z.string(),
        rationale: z.string(),
        source_title: z.string(),
        source_url: z.string(),
      })
    )
    .max(6),
});

const GROUNDING_TASK_PROMPT = `Task: Ground ONE scenario against the real, current state of the world, using
live web search. Produce two things from the same research pass:

(1) A plausibility assessment — how plausible this scenario currently
    looks given what's actually happening right now, NOT whether the
    scenario's internal axis-pole logic is coherent (that was already
    judged once, statically, when the scenario was built, and is a
    separate field you don't touch here).

(2) 3-6 signposts — specific, observable, near-term developments that,
    if they happened, would suggest this scenario is becoming more
    likely. Each must be discriminating: it should NOT equally well
    signal one of this scenario's sibling scenarios (same axes,
    different quadrant).

Use the web_search tool to find real, current news/developments relevant
to the forces underpinning this scenario (the axis forces, and the
causal logic in the scenario's own end-state description) before
answering either part.

Critical distinction for BOTH parts: a genuine signal is real-world
movement you found via search that bears on whether this future is
unfolding — NOT a restatement of the scenario's own premise dressed up
as evidence. If your rationale or a signpost could be written without
having searched anything, it's not grounded — discard it.

Input: { focal_question: string,
         scenario: {name, end_state} /* end_state is the scenario's own
         already-written narrative/summary — the target to assess
         plausibility of and build signposts toward, not something to
         re-derive */,
         axis_a: {signal_id, label}, axis_b: {signal_id, label} /* the 2
         forces that define this scenario's quadrant */,
         sibling_scenarios: [{name, tagline}] /* other scenarios sharing
         this project's axes, for signpost discrimination */,
         horizon: string }

Rules:
- Every source (plausibility) and source_title/source_url (each
  signpost) must be a real URL/title you actually found via web_search —
  never fabricated, never a plausible-sounding source you didn't
  actually retrieve. snippet is a short quote or paraphrase of what that
  source actually said, not a generic description.
- confidence_score: 0 (current events strongly undermine this
  trajectory) to 100 (current events strongly support it).
- plausibility_rationale: 2-4 sentences, citing specific real
  developments (or their genuine absence) that inform the score.
- Each signpost must be phrased as a checkable, dated, or thresholded
  event ("X ruling published", "Y index crosses Z%") — never a vague
  directional claim ("regulation increases"). rationale is one sentence:
  why this specific development would indicate movement toward this
  scenario.
- Reject (do not output) any signpost candidate that would equally well
  signal one of sibling_scenarios.
- If web search doesn't turn up anything discriminating enough for
  signposts, set signposts_sufficient_evidence:false, a one-sentence
  signposts_gap, and an empty signposts array — do not force weak or
  generic signposts. This does not affect the plausibility half, which
  is never gated.

Output schema:
{ confidence_score: number (0-100), plausibility_rationale: string,
  sources: [{ title, url, snippet }],
  signposts_sufficient_evidence: boolean, signposts_gap?: string,
  signposts: [{ text, rationale, source_title, source_url }] }`;

export interface ScenarioGroundingResult {
  plausibility: {
    score: number;
    rationale: string;
    sources: { title: string; url: string; snippet: string }[];
    checkedAt: string;
  };
  signposts: {
    sufficientEvidence: boolean;
    gap?: string;
    signposts: SignpostRow[];
  };
}

export async function generateScenarioGrounding(scenarioId: string): Promise<ScenarioGroundingResult> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id, axes_id, name, logic, tagline, summary, narrative, quadrant")
    .eq("id", scenarioId)
    .single();
  if (scenarioError) throw new StorylineScenarioNotFoundError(scenarioId, scenarioError);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, horizon")
    .eq("id", scenario.project_id)
    .single();
  if (projectError) throw new StorylineScenarioNotFoundError(scenarioId, projectError);

  // Poles (pole_pos/pole_neg) are only ever computed client-side (axis-data.ts's axisMeta())
  // and never persisted server-side — same honesty-about-what's-real-data convention as
  // ai-storyline.ts's autoSuggestStoryline.
  let axisA: { signal_id: string | null; label: string | null } = { signal_id: null, label: null };
  let axisB: { signal_id: string | null; label: string | null } = { signal_id: null, label: null };
  if (scenario.axes_id) {
    const { data: axes, error: axesError } = await supabase
      .from("axes")
      .select("x_signal_id, y_signal_id, x_label, y_label")
      .eq("id", scenario.axes_id)
      .single();
    if (axesError) throw axesError;
    axisA = { signal_id: axes.y_signal_id, label: axes.y_label };
    axisB = { signal_id: axes.x_signal_id, label: axes.x_label };
  }

  // Sibling scenarios share this project's currently-active axes row — used purely for the
  // signpost discrimination rule, same convention as the generateSignposts prompt it replaces.
  let siblingScenarios: { name: string; tagline: string | null }[] = [];
  if (scenario.axes_id) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("scenarios")
      .select("id, name, tagline")
      .eq("axes_id", scenario.axes_id)
      .neq("id", scenarioId);
    if (siblingsError) throw siblingsError;
    siblingScenarios = siblings.map((s) => ({ name: s.name, tagline: s.tagline }));
  }

  const focalQuestion = project.refined_focal_question ?? project.focal_question;
  // narrative is the scenario's own manually-written end-state description (Step 6) — nullable,
  // since not every scenario has one written yet. Fall back to the always-AI-generated summary
  // rather than requiring a narrative before a scenario can be grounded.
  const endState = scenario.narrative ?? scenario.summary;

  let output: z.infer<typeof ScenarioGroundingSchema>;
  try {
    output = await runStructured({
      step: "grounding.generate",
      projectId: scenario.project_id,
      taskPrompt: GROUNDING_TASK_PROMPT,
      input: {
        focal_question: focalQuestion,
        scenario: { name: scenario.name, end_state: endState },
        axis_a: axisA,
        axis_b: axisB,
        sibling_scenarios: siblingScenarios,
        horizon: project.horizon,
      },
      schema: ScenarioGroundingSchema,
      effort: "medium",
      thinking: false,
      webSearch: { maxUses: 5 },
      // Default (4096) left one observed response looking truncated (garbled gap text cut off
      // mid-word) — this call's output can run long (rationale + up to 6 signposts + sources),
      // on top of whatever the web_search tool turns consumed. A bit of headroom, not a fix in
      // itself; the schema tightening above is what actually rejects a bad response.
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }

  // Plausibility is append-only — every call inserts a new row, never overwrites a prior
  // check. "Current score" is just the most recent row for a scenario_id; history is the
  // point of this table.
  const { data: plausibilityRow, error: plausibilityError } = await supabase
    .from("plausibility_checks")
    .insert({
      project_id: scenario.project_id,
      scenario_id: scenarioId,
      score: output.confidence_score,
      rationale: output.plausibility_rationale,
      citations: output.sources,
    })
    .select()
    .single();
  if (plausibilityError) throw plausibilityError;

  if (!output.signposts_sufficient_evidence || output.signposts.length === 0) {
    return {
      plausibility: {
        score: plausibilityRow.score,
        rationale: plausibilityRow.rationale,
        sources: output.sources,
        checkedAt: plausibilityRow.checked_at,
      },
      signposts: { sufficientEvidence: false, gap: output.signposts_gap, signposts: [] },
    };
  }

  // Replace any prior generated set for this scenario — same "regenerate replaces"
  // convention already established by autoSuggestStoryline (ai-storyline.ts).
  const { error: deleteError } = await supabase.from("signposts").delete().eq("scenario_id", scenarioId);
  if (deleteError) throw deleteError;

  const { data: insertedSignposts, error: insertError } = await supabase
    .from("signposts")
    .insert(
      output.signposts.map((s) => ({
        project_id: scenario.project_id,
        scenario_id: scenarioId,
        name: s.text,
        rationale: s.rationale,
        citations: [{ title: s.source_title, url: s.source_url }],
        status: "Watch" as const,
      }))
    )
    .select();
  if (insertError) throw insertError;

  return {
    plausibility: {
      score: plausibilityRow.score,
      rationale: plausibilityRow.rationale,
      sources: output.sources,
      checkedAt: plausibilityRow.checked_at,
    },
    signposts: { sufficientEvidence: true, signposts: insertedSignposts },
  };
}
