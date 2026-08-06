"use server";

// Scenario grounding — combines Plausibility and Signpost (SCHWARTZ_METHODOLOGY_SKILL.md's
// "Plausibility / confidence score" and "Signpost" sections) into ONE Claude call. Two
// deliberately different kinds of judgment sharing one call for cost reasons, not because
// they're the same thing:
//   - Plausibility: does the storyline chain's own causal logic hold together (every edge a
//     believable cause->effect link, no gaps/contradictions, the realized end state actually
//     following from the chain and the scenario's own `logic`) — reasoning over data already
//     in the DB, no web search needed for this half.
//   - Signposts: real, current, externally observable developments — needs web search.
// The model can still use web_search selectively within the same turn for the signposts half
// even though the plausibility half doesn't need it, so combining still saves a call.
//
// Distinct from Confidence (page-storyline.tsx's header stat, computeChainConfidence in
// story-adapter.ts) — a plain formula over the chain's own evidentiary strength (signal
// linkage, signal ratings, edge density), not an AI judgment, not stored here. The two used to
// accidentally read the same number; they're deliberately different questions now.
//
// Also distinct from the static, build-order Step 8 `indicators` table and from
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
  // Plausibility half — unconditional: always produce a score + rationale, even for a thin or
  // empty chain (the prompt asks the model to say so honestly rather than fabricate a
  // judgment). Never gated on sufficient_evidence — that gate is for signposts, where forcing
  // a weak candidate is worse than returning none; a coherence judgment doesn't have that
  // failure mode.
  plausibility_score: z.number().int().min(0).max(100),
  // min(20): observed in testing that the model can occasionally return an empty rationale
  // alongside a nonsensical/inconsistent score and garbled text — internally inconsistent
  // output that still satisfied a bare z.string(). Short enough to allow a terse real
  // rationale but rejects the empty-string degenerate case, which sends it back through
  // runStructured's existing retry-once-on-schema-failure path instead of writing garbage to
  // plausibility_checks.
  plausibility_rationale: z.string().min(20),
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

const GROUNDING_TASK_PROMPT = `Task: Produce two different judgments about ONE scenario in a single pass.

(1) Plausibility — does this scenario's storyline chain (chain_nodes,
    chain_edges, given below) actually hold together as a causal
    argument? This is NOT about whether real-world current events
    support the scenario (that's not what this field measures), and NOT
    the scenario's internal axis-pole logic (scenario_logic already
    passed step 5's static coherence check when the scenario was built —
    don't re-judge that). Specifically assess:
    - Does each edge represent a believable, defensible cause-effect
      link between its two nodes, respecting the stated relationship
      (Leads to / Enables / Amplifies / Blocks)?
    - Are there logical gaps — a node whose causal justification from
      what precedes it is weak or missing?
    - Are there contradictions — nodes that undermine or work against
      each other?
    - Does the "realized" phase node plausibly follow from the rest of
      the chain, and does the overall chain actually arrive at
      scenario_logic (not just gesture at it)?
    If chain_nodes is empty or too thin to assess (no storyline
    generated yet, or only 1-2 nodes), say so plainly in the rationale
    and give a low score reflecting "not yet assessable" — never
    fabricate a coherence judgment for a chain that isn't there.

(2) 3-6 signposts — specific, observable, near-term real-world
    developments that, if they happened, would suggest this scenario is
    becoming more likely. Each must be discriminating: it should NOT
    equally well signal one of this scenario's sibling scenarios (same
    axes, different quadrant). Use the web_search tool to find real,
    current news/developments relevant to the forces underpinning this
    scenario before answering this part — a genuine signpost is grounded
    in something you actually found, not a restatement of the scenario's
    own premise dressed up as evidence.

Input: { focal_question: string,
         scenario: {name, end_state, logic} /* end_state is the scenario's own
         already-written narrative/summary; logic is step 5's causal argument
         for the quadrant — the target chain_nodes/chain_edges should arrive
         at */,
         chain_nodes: [{phase, title, signal_id}] /* signal_id: null means a
         freeform/manual node, still valid, just not signal-grounded */,
         chain_edges: [{from, to, relationship, confidence}],
         axis_a: {signal_id, label}, axis_b: {signal_id, label} /* the 2
         forces that define this scenario's quadrant — signposts context only */,
         sibling_scenarios: [{name, tagline}] /* other scenarios sharing
         this project's axes, for signpost discrimination */,
         horizon: string }

Rules:
- plausibility_score: 0 (the chain doesn't hold together — major gaps
  or contradictions) to 100 (every link is well-justified and the chain
  clearly arrives at scenario_logic).
- plausibility_rationale: 2-4 sentences, citing the SPECIFIC node(s) or
  edge(s) that most support or undermine the score — not a generic
  restatement of the scenario.
- source_title/source_url (each signpost) must be a real URL/title you
  actually found via web_search — never fabricated, never a
  plausible-sounding source you didn't actually retrieve.
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
  is never gated the same way.

Output schema:
{ plausibility_score: number (0-100), plausibility_rationale: string,
  signposts_sufficient_evidence: boolean, signposts_gap?: string,
  signposts: [{ text, rationale, source_title, source_url }] }`;

export interface ScenarioGroundingResult {
  plausibility: {
    score: number;
    rationale: string;
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

  // The storyline chain itself — what the plausibility half actually reasons over. Absent
  // until autoSuggestStoryline (or manual editing) has produced nodes; an empty chain is a
  // valid, honestly-reportable input, not an error (see the prompt's own instruction for it).
  const { data: storylineNodes, error: nodesError } = await supabase
    .from("storyline_nodes")
    .select("id, phase, title, signal_id")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: true });
  if (nodesError) throw nodesError;

  const { data: storylineEdges, error: edgesError } = await supabase
    .from("storyline_edges")
    .select("from_node_id, to_node_id, relationship, confidence")
    .eq("scenario_id", scenarioId);
  if (edgesError) throw edgesError;

  const chainNodes = storylineNodes.map((n) => ({ phase: n.phase, title: n.title, signal_id: n.signal_id }));
  const chainEdges = storylineEdges.map((e) => ({
    from: e.from_node_id,
    to: e.to_node_id,
    relationship: e.relationship,
    confidence: e.confidence,
  }));

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
        scenario: { name: scenario.name, end_state: endState, logic: scenario.logic },
        chain_nodes: chainNodes,
        chain_edges: chainEdges,
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
      // mid-word) — this call's output can run long (rationale + up to 6 signposts), on top of
      // whatever the web_search tool turns consumed. A bit of headroom, not a fix in itself;
      // the schema tightening above is what actually rejects a bad response.
      maxTokens: 6000,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }

  // Plausibility is append-only — every call inserts a new row, never overwrites a prior
  // check. "Current score" is just the most recent row for a scenario_id; history is the
  // point of this table. citations is always [] now — this is a reasoning judgment over the
  // chain itself, not a web-search-grounded claim, so there's nothing to cite (the column
  // stays for schema compatibility with signposts' own citations, unused here).
  const { data: plausibilityRow, error: plausibilityError } = await supabase
    .from("plausibility_checks")
    .insert({
      project_id: scenario.project_id,
      scenario_id: scenarioId,
      score: output.plausibility_score,
      rationale: output.plausibility_rationale,
      citations: [],
    })
    .select()
    .single();
  if (plausibilityError) throw plausibilityError;

  const plausibility = { score: plausibilityRow.score, rationale: plausibilityRow.rationale, checkedAt: plausibilityRow.checked_at };

  if (!output.signposts_sufficient_evidence || output.signposts.length === 0) {
    return { plausibility, signposts: { sufficientEvidence: false, gap: output.signposts_gap, signposts: [] } };
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

  return { plausibility, signposts: { sufficientEvidence: true, signposts: insertedSignposts } };
}
