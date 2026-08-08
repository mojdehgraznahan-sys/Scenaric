"use server";

// Narrative's "Ask AI" — a fixed task menu (ask-ai.tsx's context="narrative" branch), never
// a freeform chat, same convention as ai-storyline-tasks.ts. All four tasks reason ONLY over
// this project's own scenario/storyline/implications data — no web search, no general
// external knowledge.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { StorylineScenarioNotFoundError } from "@/lib/ai/errors";
import { z } from "zod";
import { getStoryline } from "./storyline";
import { listImplications } from "./implications";
import { generateImplicationsForScenario, type GenerateImplicationsResult } from "./ai-implications";
import { generateIndicatorsForScenario, type GenerateIndicatorsResult } from "./ai-indicators";
import { PHASE_ORDER, type Phase } from "../storyline-mapping";

async function loadScenario(supabase: ReturnType<typeof createClient>, scenarioId: string) {
  const { data: scenario, error } = await supabase
    .from("scenarios")
    .select("id, project_id, axes_id, name, narrative")
    .eq("id", scenarioId)
    .single();
  if (error) throw new StorylineScenarioNotFoundError(scenarioId, error);
  return scenario;
}

// ─────────────────────── Task 1: Check narrative fidelity to storyline ───────────────────────

const FidelitySchema = z.object({
  nodes_covered: z.array(
    z.object({
      node_id: z.string(),
      covered: z.boolean(),
      note: z.string().optional(),
    })
  ),
  causal_order_ok: z.boolean(),
  order_issue: z.string().optional(),
  invented_details: z.array(
    z.object({
      text: z.string(),
      note: z.string(),
    })
  ),
});

const FIDELITY_TASK_PROMPT = `Task: Verify that a scenario's narrative prose faithfully represents its
approved storyline chain — the same discipline the narrative/expand prompt itself is held to,
checked after the fact.

Reason ONLY over the given narrative/storyline_nodes — no general knowledge, no opinion on
writing quality, only fidelity to the chain.

Input: { narrative: string, storyline_nodes: [{id, phase, title, body}] /* already ordered
         precursors -> catalysts -> first_order -> second_order -> realized */ }

Rules:
- For EVERY node in storyline_nodes, decide whether the narrative mentions that node's core
  fact (even if paraphrased) — covered:true/false. If false, note briefly what's missing.
- causal_order_ok: true only if, among the nodes the narrative DOES cover, they appear in the
  narrative in the same relative order as storyline_nodes (precursors before catalysts before
  first-order effects, etc.) — never claim true if the narrative reorders or reverses the
  chain's own sequence. If false, order_issue must say specifically which nodes are
  out of order.
- invented_details: any specific named fact, statistic, policy, or event in the narrative
  that does NOT trace to any storyline_node's title/body — this is what the narrative/expand
  prompt itself is forbidden from doing (see ai-narrative.ts), so a genuinely faithful
  narrative should have an EMPTY invented_details array; do not force an entry to fill it.

Output schema:
{ nodes_covered: [{ node_id: string, covered: boolean, note?: string }],
  causal_order_ok: boolean, order_issue?: string,
  invented_details: [{ text: string, note: string }] }`;

export interface CheckNarrativeFidelityResult {
  hasNarrative: boolean;
  hasStoryline: boolean;
  nodesCovered: { nodeId: string; covered: boolean; note?: string }[];
  causalOrderOk: boolean;
  orderIssue?: string;
  inventedDetails: { text: string; note: string }[];
}

export async function checkNarrativeFidelity(scenarioId: string): Promise<CheckNarrativeFidelityResult> {
  const supabase = createClient();
  const scenario = await loadScenario(supabase, scenarioId);
  const { nodes } = await getStoryline(scenarioId);

  if (!scenario.narrative || nodes.length === 0) {
    return {
      hasNarrative: !!scenario.narrative,
      hasStoryline: nodes.length > 0,
      nodesCovered: [],
      causalOrderOk: true,
      inventedDetails: [],
    };
  }

  const orderedNodes = [...nodes].sort((a, b) => PHASE_ORDER[a.phase as Phase] - PHASE_ORDER[b.phase as Phase]);
  const nodeIds = new Set(orderedNodes.map((n) => n.id));

  const output = await runStructured({
    step: "narrative_ask_ai.check_fidelity",
    projectId: scenario.project_id,
    taskPrompt: FIDELITY_TASK_PROMPT,
    input: {
      narrative: scenario.narrative,
      storyline_nodes: orderedNodes.map((n) => ({ id: n.id, phase: n.phase, title: n.title, body: n.body })),
    },
    schema: FidelitySchema,
    effort: "medium",
    thinking: false,
  });

  // Same anti-hallucination cross-check as validateStorylineChain — never trust a returned
  // node id blindly.
  const nodesCovered = output.nodes_covered
    .filter((n) => nodeIds.has(n.node_id))
    .map((n) => ({ nodeId: n.node_id, covered: n.covered, note: n.note }));

  return {
    hasNarrative: true,
    hasStoryline: true,
    nodesCovered,
    causalOrderOk: output.causal_order_ok,
    orderIssue: output.order_issue,
    inventedDetails: output.invented_details,
  };
}

// ─────────────────────── Task 2: Regenerate implications ───────────────────────

// No new AI call — thin wrapper around the exact same action "Regenerate" on the Implications
// block itself calls (ai-implications.ts), exposed here as an Ask AI menu entry too.
export async function regenerateImplicationsTask(scenarioId: string): Promise<GenerateImplicationsResult> {
  return generateImplicationsForScenario(scenarioId);
}

// ─────────────────────── Task 3: Stress-test implications ───────────────────────

const StressTestSchema = z.object({
  results: z.array(
    z.object({
      implication_id: z.string(),
      scenario_specific: z.boolean(),
      rationale: z.string(),
    })
  ),
});

const STRESS_TEST_TASK_PROMPT = `Task: Stress-test ONE scenario's implications for genericness — for each
implication, would it plausibly hold even if one of the OTHER sibling scenarios (sharing the
same two axes) happened instead? If yes, it's not actually scenario-specific and should be
flagged, per the implications/generate rule that implications must be scenario-specific, not
implications that would apply to any scenario.

Input: { implications: [{id, text, category}],
         sibling_scenarios: [{name, tagline}] /* the other scenarios sharing this axes set */ }

Rules:
- scenario_specific: false if the implication's stated decision/resource shift would
  plausibly be needed under ANY of the sibling scenarios too (i.e. it doesn't actually
  depend on what makes THIS scenario distinct) — true only if it genuinely depends on a
  fact/mechanism specific to this scenario.
- rationale: one sentence — if false, name which sibling(s) it would equally apply to and
  why; if true, name the specific scenario-distinguishing fact it depends on.
- One results entry per implication given, same count.

Output schema:
{ results: [{ implication_id: string, scenario_specific: boolean, rationale: string }] }`;

export interface StressTestImplicationsResult {
  results: { implicationId: string; text: string; scenarioSpecific: boolean; rationale: string }[];
}

export async function stressTestImplications(scenarioId: string): Promise<StressTestImplicationsResult> {
  const supabase = createClient();
  const scenario = await loadScenario(supabase, scenarioId);
  const implications = await listImplications(scenarioId);

  if (implications.length === 0) {
    return { results: [] };
  }

  let siblingScenarios: { name: string; tagline: string | null }[] = [];
  if (scenario.axes_id) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("scenarios")
      .select("name, tagline")
      .eq("axes_id", scenario.axes_id)
      .neq("id", scenarioId);
    if (siblingsError) throw siblingsError;
    siblingScenarios = siblings;
  }

  const implicationById = new Map(implications.map((imp) => [imp.id, imp]));

  const output = await runStructured({
    step: "narrative_ask_ai.stress_test_implications",
    projectId: scenario.project_id,
    taskPrompt: STRESS_TEST_TASK_PROMPT,
    input: {
      implications: implications.map((imp) => ({ id: imp.id, text: imp.text, category: imp.category })),
      sibling_scenarios: siblingScenarios,
    },
    schema: StressTestSchema,
    effort: "medium",
    thinking: false,
  });

  // Includes each implication's own text (not just its id) so the Ask AI drawer can render
  // something readable rather than a raw uuid — implicationById is already loaded above.
  const results = output.results
    .filter((r) => implicationById.has(r.implication_id))
    .map((r) => ({
      implicationId: r.implication_id,
      text: implicationById.get(r.implication_id)!.text,
      scenarioSpecific: r.scenario_specific,
      rationale: r.rationale,
    }));

  return { results };
}

// ─────────────────────── Task 4: Suggest indicators from this narrative ───────────────────────

// No new AI call — thin wrapper around the same action "Track indicators" calls
// (ai-indicators.ts), exposed here as an Ask AI menu entry too. Not the same feature as
// Signpost (ai-grounding.ts) — see SCHWARTZ_METHODOLOGY_SKILL.md's "Signpost" section.
export async function suggestIndicatorsTask(scenarioId: string): Promise<GenerateIndicatorsResult> {
  return generateIndicatorsForScenario(scenarioId);
}
