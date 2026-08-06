"use server";

// Storyline's "Ask AI" — a fixed task menu (ask-ai.tsx's context="storyline" branch), never a
// freeform chat. All four tasks below reason ONLY over this project's own storyline_nodes/
// storyline_edges/scenario fields — no web search, no general external knowledge — same
// "grounded, no external knowledge" convention askSignalsChat (ai-signals.ts) already uses for
// the Signals page's own Ask AI mode.
//
// validateStorylinePlausibility is a separate, richer, on-demand sibling of
// ai-grounding.ts's plausibility half (which still seeds an initial score+rationale as part of
// POST /generate, unchanged) — this one adds a per-weak-link breakdown and is what the side
// panel's "Refresh" button and this menu's "Validate plausibility" both call.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { StorylineScenarioNotFoundError } from "@/lib/ai/errors";
import { z } from "zod";
import { findSignalForGap, type FindSignalForGapResult } from "./ai-storyline";
import { PHASES } from "@/lib/storyline-mapping";

async function loadScenario(supabase: ReturnType<typeof createClient>, scenarioId: string) {
  const { data: scenario, error } = await supabase
    .from("scenarios")
    .select("id, project_id, name, logic, narrative, summary")
    .eq("id", scenarioId)
    .single();
  if (error) throw new StorylineScenarioNotFoundError(scenarioId, error);
  return scenario;
}

async function loadChain(supabase: ReturnType<typeof createClient>, scenarioId: string) {
  const { data: nodes, error: nodesError } = await supabase
    .from("storyline_nodes")
    .select("id, phase, title, body, signal_id")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: true });
  if (nodesError) throw nodesError;
  const { data: edges, error: edgesError } = await supabase
    .from("storyline_edges")
    .select("id, from_node_id, to_node_id, relationship, confidence")
    .eq("scenario_id", scenarioId);
  if (edgesError) throw edgesError;
  return { nodes, edges };
}

// ─────────────────────── Task 1: Validate plausibility ───────────────────────

const ValidatePlausibilitySchema = z.object({
  score: z.number().int().min(0).max(100),
  rationale: z.string().min(20),
  // Real node ids copied verbatim from the input's chain_edges — validated below, never
  // trusted blindly (same anti-hallucination discipline as autoSuggestStoryline).
  weak_links: z.array(
    z.object({
      from_node_id: z.string(),
      to_node_id: z.string(),
      issue: z.string(),
    })
  ),
});

const VALIDATE_PLAUSIBILITY_PROMPT = `Task: Assess whether ONE scenario's storyline causal chain holds together as a
logical argument, and flag every specific weak link found.

Reason ONLY over chain_nodes/chain_edges/scenario_logic given below — this is a
coherence check on the argument itself, not a real-world-events plausibility
check (that's a different, unrelated concept elsewhere in this product).

Assess:
- Does each edge represent a believable, defensible cause-effect link between
  its two nodes, respecting its stated relationship (Leads to / Enables /
  Amplifies / Blocks)?
- Are there logical gaps — a node whose causal justification from what
  precedes it is weak or missing?
- Are there contradictions — nodes that undermine or work against each other?
- Does the "realized"-phase node plausibly follow from the rest of the chain,
  and does the overall chain actually arrive at scenario_logic (not just
  gesture at it)?

If chain_nodes has fewer than 2 nodes, say so plainly in the rationale and
give a low score reflecting "not yet assessable" — never fabricate a
coherence judgment for a chain that isn't there.

Input: { scenario: {name, end_state, logic},
         chain_nodes: [{id, phase, title, body, signal_id}],
         chain_edges: [{id, from, to, relationship, confidence}] }

Rules:
- score: 0 (the chain doesn't hold together) to 100 (every link is
  well-justified and the chain clearly arrives at scenario_logic).
- rationale: 2-4 sentences, citing the specific node(s)/edge(s) that most
  support or undermine the score.
- weak_links: one entry per specific edge you'd flag as weak, unjustified, or
  contradictory. from_node_id/to_node_id must be real ids copied verbatim
  from chain_edges' from/to — never invented. issue is one sentence on the
  specific problem. Empty array is a valid, good result (a fully coherent
  chain has no weak links) — do not force an entry to fill the field.

Output schema:
{ score: number (0-100), rationale: string,
  weak_links: [{ from_node_id, to_node_id, issue }] }`;

export interface ValidatePlausibilityResult {
  score: number;
  rationale: string;
  checkedAt: string;
  weakLinks: { fromNodeId: string; toNodeId: string; issue: string }[];
}

export async function validateStorylinePlausibility(scenarioId: string): Promise<ValidatePlausibilityResult> {
  const supabase = createClient();
  const scenario = await loadScenario(supabase, scenarioId);
  const { nodes, edges } = await loadChain(supabase, scenarioId);

  const edgeKeys = new Set(edges.map((e) => `${e.from_node_id}>${e.to_node_id}`));
  const endState = scenario.narrative ?? scenario.summary;

  const output = await runStructured({
    step: "storyline_ask_ai.validate_plausibility",
    projectId: scenario.project_id,
    taskPrompt: VALIDATE_PLAUSIBILITY_PROMPT,
    input: {
      scenario: { name: scenario.name, end_state: endState, logic: scenario.logic },
      chain_nodes: nodes.map((n) => ({ id: n.id, phase: n.phase, title: n.title, body: n.body, signal_id: n.signal_id })),
      chain_edges: edges.map((e) => ({ id: e.id, from: e.from_node_id, to: e.to_node_id, relationship: e.relationship, confidence: e.confidence })),
    },
    schema: ValidatePlausibilitySchema,
    effort: "medium",
    thinking: false,
  });

  const weakLinks = output.weak_links
    .filter((w) => edgeKeys.has(`${w.from_node_id}>${w.to_node_id}`))
    .map((w) => ({ fromNodeId: w.from_node_id, toNodeId: w.to_node_id, issue: w.issue }));

  // Same append-only convention as ai-grounding.ts's plausibility half — a new row per check,
  // "current" is just the latest. weak_links isn't persisted (no column for it on
  // plausibility_checks); it's a response-only diagnostic for the Ask AI drawer.
  const { data: row, error } = await supabase
    .from("plausibility_checks")
    .insert({ project_id: scenario.project_id, scenario_id: scenarioId, score: output.score, rationale: output.rationale, citations: [] })
    .select()
    .single();
  if (error) throw error;

  return { score: row.score, rationale: row.rationale, checkedAt: row.checked_at, weakLinks };
}

// ─────────────────────── Task 2: Validate this chain ───────────────────────

const ValidateChainSchema = z.object({
  findings: z.array(
    z.object({
      from_node_id: z.string(),
      to_node_id: z.string(),
      sound: z.boolean(),
      issue: z.string().optional(),
    })
  ),
});

const VALIDATE_CHAIN_PROMPT = `Task: For ONE specific path through a scenario's storyline (a subset of its full
chain, e.g. what the user has highlighted in the UI), check every edge in that
path and flag any that doesn't plausibly follow from its source node.

Reason ONLY over the given path_nodes/path_edges — no general knowledge.

Input: { path_nodes: [{id, phase, title, body}],
         path_edges: [{id, from, to, relationship}] }

Rules:
- One findings entry per edge in path_edges (same count) — from_node_id/
  to_node_id copied verbatim from that edge's from/to.
- sound: true if the edge's stated relationship is a defensible cause-effect
  link from its source node's content to its target node's content; false
  otherwise.
- issue: required when sound is false (one sentence on specifically what
  doesn't follow), omit when sound is true.

Output schema:
{ findings: [{ from_node_id, to_node_id, sound: boolean, issue?: string }] }`;

export interface ValidateChainResult {
  findings: { fromNodeId: string; toNodeId: string; sound: boolean; issue?: string }[];
}

export async function validateStorylineChain(scenarioId: string, nodeIds: string[]): Promise<ValidateChainResult> {
  const supabase = createClient();
  const scenario = await loadScenario(supabase, scenarioId);
  const { nodes, edges } = await loadChain(supabase, scenarioId);

  const nodeIdSet = new Set(nodeIds);
  const pathNodes = nodes.filter((n) => nodeIdSet.has(n.id));
  const pathEdges = edges.filter((e) => nodeIdSet.has(e.from_node_id) && nodeIdSet.has(e.to_node_id));

  if (pathNodes.length < 2 || pathEdges.length === 0) {
    return { findings: [] };
  }

  const output = await runStructured({
    step: "storyline_ask_ai.validate_chain",
    projectId: scenario.project_id,
    taskPrompt: VALIDATE_CHAIN_PROMPT,
    input: {
      path_nodes: pathNodes.map((n) => ({ id: n.id, phase: n.phase, title: n.title, body: n.body })),
      path_edges: pathEdges.map((e) => ({ id: e.id, from: e.from_node_id, to: e.to_node_id, relationship: e.relationship })),
    },
    schema: ValidateChainSchema,
    effort: "medium",
    thinking: false,
  });

  const pathEdgeKeys = new Set(pathEdges.map((e) => `${e.from_node_id}>${e.to_node_id}`));
  const findings = output.findings
    .filter((f) => pathEdgeKeys.has(`${f.from_node_id}>${f.to_node_id}`))
    .map((f) => ({ fromNodeId: f.from_node_id, toNodeId: f.to_node_id, sound: f.sound, issue: f.issue }));

  return { findings };
}

// ─────────────────────── Task 3: Find missing links ───────────────────────

export interface MissingLinksResult {
  thinChain: boolean;
  gaps: { phase: string; sufficientEvidence: boolean; gap?: string; candidates: FindSignalForGapResult["candidates"] }[];
}

// No new AI call — orchestrates the existing findSignalForGap (ai-storyline.ts) once per
// detected gap, extending the side panel's own single-gap heuristic to find every gap phase.
export async function findMissingLinksInStoryline(scenarioId: string): Promise<MissingLinksResult> {
  const supabase = createClient();
  await loadScenario(supabase, scenarioId);
  const { nodes } = await loadChain(supabase, scenarioId);

  const presentPhases = new Set(nodes.map((n) => n.phase));
  const gapPhases = PHASES.filter((p, i) => !presentPhases.has(p) && PHASES.slice(i + 1).some((later) => presentPhases.has(later)));

  const gaps: MissingLinksResult["gaps"] = [];
  for (const phase of gapPhases) {
    const result = await findSignalForGap({
      scenarioId,
      phase,
      gapDescription: `No signals are placed in the ${phase.replace("_", "-")} phase yet, between phases that do have signals.`,
    });
    gaps.push({ phase, sufficientEvidence: result.sufficientEvidence, gap: result.gap, candidates: result.candidates });
  }

  return { thinChain: nodes.length < 4, gaps };
}

// ─────────────────────── Task 4: Explain this chain ───────────────────────

const ExplainChainSchema = z.object({
  explanation: z.string().min(20),
});

const EXPLAIN_CHAIN_PROMPT = `Task: Write a plain-language walkthrough of ONE specific path through a
scenario's storyline (a subset of its full chain, e.g. what the user has
highlighted in the UI), suitable for sharing with a stakeholder who hasn't
seen the underlying data.

Reason ONLY over the given scenario/path_nodes — no embellishment beyond
what's in each node's own title/body, no general knowledge.

Input: { scenario: {name, end_state}, path_nodes: [{phase, title, body}] }

Rules:
- 2-4 short paragraphs, walking the path in the given order (already
  phase-ordered) — precursor conditions, through to how it leads toward
  end_state.
- Plain language, no jargon, no phase-name scaffolding ("In the precursors
  phase...") — write it as a narrative, not a labeled list.
- Every claim must trace to a node actually given — do not introduce facts,
  statistics, or events not present in path_nodes.

Output schema:
{ explanation: string }`;

export async function explainStorylineChain(scenarioId: string, nodeIds: string[]): Promise<{ explanation: string }> {
  const supabase = createClient();
  const scenario = await loadScenario(supabase, scenarioId);
  const { nodes } = await loadChain(supabase, scenarioId);

  const nodeIdSet = new Set(nodeIds);
  const pathNodes = nodes.filter((n) => nodeIdSet.has(n.id));
  const endState = scenario.narrative ?? scenario.summary;

  if (pathNodes.length === 0) {
    return { explanation: "No path is selected — select a node on the canvas to highlight a path first." };
  }

  const output = await runStructured({
    step: "storyline_ask_ai.explain_chain",
    projectId: scenario.project_id,
    taskPrompt: EXPLAIN_CHAIN_PROMPT,
    input: {
      scenario: { name: scenario.name, end_state: endState },
      path_nodes: pathNodes.map((n) => ({ phase: n.phase, title: n.title, body: n.body })),
    },
    schema: ExplainChainSchema,
    effort: "medium",
    thinking: false,
  });

  return { explanation: output.explanation };
}
