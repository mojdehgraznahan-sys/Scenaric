"use server";

// Storyline CRUD — Step 6 manual editing (§9 of the Backend Build Plan). Plain reads/
// mutations only; the AI-driven auto-suggest/find-signal calls live in ./ai-storyline.ts,
// matching the signals.ts/ai-signals.ts and matrix.ts/ai-matrix.ts split already used
// elsewhere. RLS (supabase/migrations/0003_rls.sql) scopes every query to the caller's org
// via project_id — no manual org/user filtering needed here, same convention as signals.ts.
//
// One deliberate distinction from ai-storyline.ts's strict grounding: a manually-created node
// IS allowed to be freeform (inline title/body, no signal_id) — a human curator typing their
// own node is accountable for it the same way any other manual data entry is. The
// anti-hallucination strictness in ai-storyline.ts exists specifically to constrain the
// model, not the user.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { SteepCategory } from "./signals";
import { isPhaseOrderValid, type Phase } from "../storyline-mapping";

type StorylineNodeRow = Database["public"]["Tables"]["storyline_nodes"]["Row"];
type StorylineNodeUpdate = Database["public"]["Tables"]["storyline_nodes"]["Update"];
type StorylineEdgeRow = Database["public"]["Tables"]["storyline_edges"]["Row"];
type StorylineEdgeUpdate = Database["public"]["Tables"]["storyline_edges"]["Update"];
type SupabaseClient = ReturnType<typeof createClient>;

export interface StorylineData {
  nodes: StorylineNodeRow[];
  edges: StorylineEdgeRow[];
  // Fewer than 4 total nodes is a sign the scenario isn't adequately grounded yet, per
  // SCHWARTZ_METHODOLOGY_SKILL.md's "thin chains are a signal, not just a display issue" —
  // computed on every read, not a stored/stale flag.
  thinChain: boolean;
}

// GET .../scenarios/:id/storyline
export async function getStoryline(scenarioId: string): Promise<StorylineData> {
  const supabase = createClient();
  const { data: nodes, error: nodesError } = await supabase
    .from("storyline_nodes")
    .select("*")
    .eq("scenario_id", scenarioId)
    .order("created_at", { ascending: true });
  if (nodesError) throw nodesError;

  const { data: edges, error: edgesError } = await supabase.from("storyline_edges").select("*").eq("scenario_id", scenarioId);
  if (edgesError) throw edgesError;

  return { nodes, edges, thinChain: nodes.length < 4 };
}

// Shared by createStorylineNode/updateStorylineNode: when a real signal_id is supplied, the
// signal's own title/body/category wins — never a caller-supplied free-text stand-in for a
// node that claims to represent a specific real signal. Throws if the signal doesn't belong
// to the given project (defense against cross-project linking).
async function loadSignalForNode(supabase: SupabaseClient, projectId: string, signalId: string) {
  const { data: signal, error } = await supabase.from("signals").select("id, project_id, title, body, category").eq("id", signalId).single();
  if (error) throw error;
  if (signal.project_id !== projectId) {
    throw new Error("That signal does not belong to this scenario's project.");
  }
  return signal;
}

export interface CreateStorylineNodeInput {
  scenarioId: string;
  phase: Phase;
  signalId?: string | null;
  title?: string;
  body?: string | null;
  category?: SteepCategory | null;
  year?: number | null;
  strength?: string | null;
}

// POST .../scenarios/:id/storyline/nodes — the "+ Add signal to chain" flow. Accepts either
// an existing signalId (library picker) or inline title/body for a net-new node.
export async function createStorylineNode(input: CreateStorylineNodeInput): Promise<StorylineNodeRow> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase.from("scenarios").select("id, project_id").eq("id", input.scenarioId).single();
  if (scenarioError) throw scenarioError;

  let title: string;
  let body: string | null;
  let category: SteepCategory | null;
  let signalId: string | null;

  if (input.signalId) {
    const signal = await loadSignalForNode(supabase, scenario.project_id, input.signalId);
    signalId = signal.id;
    title = signal.title;
    body = signal.body;
    category = signal.category;
  } else {
    if (!input.title || !input.title.trim()) {
      throw new Error("title is required when no signalId is provided.");
    }
    signalId = null;
    title = input.title.trim();
    body = input.body ?? null;
    category = input.category ?? null;
  }

  const { data, error } = await supabase
    .from("storyline_nodes")
    .insert({
      project_id: scenario.project_id,
      scenario_id: input.scenarioId,
      phase: input.phase,
      category,
      title,
      body,
      year: input.year ?? null,
      strength: input.strength ?? null,
      signal_id: signalId,
    })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/storyline");
  return data;
}

export interface UpdateStorylineNodeInput {
  id: string;
  phase?: Phase;
  // Present (even as null) means "change the grounding": a real id re-derives title/body/
  // category from that signal; null clears the link and allows the caller's own title/body.
  signalId?: string | null;
  title?: string;
  body?: string | null;
  category?: SteepCategory | null;
  year?: number | null;
  strength?: string | null;
}

// PATCH .../storyline/nodes/:id
export async function updateStorylineNode(input: UpdateStorylineNodeInput): Promise<StorylineNodeRow> {
  const supabase = createClient();
  const fields: StorylineNodeUpdate = {};
  if (input.phase !== undefined) fields.phase = input.phase;
  if (input.year !== undefined) fields.year = input.year;
  if (input.strength !== undefined) fields.strength = input.strength;

  if (input.signalId !== undefined) {
    if (input.signalId) {
      const { data: node, error: nodeError } = await supabase.from("storyline_nodes").select("project_id").eq("id", input.id).single();
      if (nodeError) throw nodeError;
      const signal = await loadSignalForNode(supabase, node.project_id, input.signalId);
      fields.signal_id = signal.id;
      fields.title = signal.title;
      fields.body = signal.body;
      fields.category = signal.category;
    } else {
      fields.signal_id = null;
      if (input.title !== undefined) fields.title = input.title;
      if (input.body !== undefined) fields.body = input.body;
      if (input.category !== undefined) fields.category = input.category;
    }
  } else {
    if (input.title !== undefined) fields.title = input.title;
    if (input.body !== undefined) fields.body = input.body;
    if (input.category !== undefined) fields.category = input.category;
  }

  const { data, error } = await supabase.from("storyline_nodes").update(fields).eq("id", input.id).select().single();
  if (error) throw error;
  revalidatePath("/storyline");
  return data;
}

// DELETE .../storyline/nodes/:id — storyline_edges.from_node_id/to_node_id are `on delete
// cascade`, so dependent edges clean up automatically.
export async function deleteStorylineNode(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("storyline_nodes").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/storyline");
}

export interface CreateStorylineEdgeInput {
  scenarioId: string;
  fromNodeId: string;
  toNodeId: string;
  relationship: StorylineEdgeRow["relationship"];
  confidence: StorylineEdgeRow["confidence"];
}

async function assertForwardEdge(supabase: SupabaseClient, scenarioId: string, fromNodeId: string, toNodeId: string) {
  const { data: nodes, error } = await supabase.from("storyline_nodes").select("id, scenario_id, phase").in("id", [fromNodeId, toNodeId]);
  if (error) throw error;
  const fromNode = nodes.find((n) => n.id === fromNodeId);
  const toNode = nodes.find((n) => n.id === toNodeId);
  if (!fromNode || !toNode) throw new Error("from/to node not found.");
  if (fromNode.scenario_id !== scenarioId || toNode.scenario_id !== scenarioId) {
    throw new Error("Both nodes must belong to the given scenario.");
  }
  // Endpoint-level invariant, not just an auto-suggest post-filter: a single manual edit
  // that violates one-directional causality is rejected outright, not silently dropped.
  if (!isPhaseOrderValid(fromNode.phase as Phase, toNode.phase as Phase)) {
    throw new Error(
      `Cannot connect a ${toNode.phase} node backward from a ${fromNode.phase} node — storyline causality is one-directional.`
    );
  }
}

// POST .../scenarios/:id/storyline/edges
export async function createStorylineEdge(input: CreateStorylineEdgeInput): Promise<StorylineEdgeRow> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase.from("scenarios").select("id, project_id").eq("id", input.scenarioId).single();
  if (scenarioError) throw scenarioError;

  await assertForwardEdge(supabase, input.scenarioId, input.fromNodeId, input.toNodeId);

  const { data, error } = await supabase
    .from("storyline_edges")
    .insert({
      project_id: scenario.project_id,
      scenario_id: input.scenarioId,
      from_node_id: input.fromNodeId,
      to_node_id: input.toNodeId,
      relationship: input.relationship,
      confidence: input.confidence,
    })
    .select()
    .single();
  if (error) throw error;
  revalidatePath("/storyline");
  return data;
}

export interface UpdateStorylineEdgeInput {
  id: string;
  fromNodeId?: string;
  toNodeId?: string;
  relationship?: StorylineEdgeRow["relationship"];
  confidence?: StorylineEdgeRow["confidence"];
}

// PATCH .../storyline/edges/:id
export async function updateStorylineEdge(input: UpdateStorylineEdgeInput): Promise<StorylineEdgeRow> {
  const supabase = createClient();
  const fields: StorylineEdgeUpdate = {};
  if (input.relationship !== undefined) fields.relationship = input.relationship;
  if (input.confidence !== undefined) fields.confidence = input.confidence;

  if (input.fromNodeId !== undefined || input.toNodeId !== undefined) {
    const { data: edge, error: edgeError } = await supabase
      .from("storyline_edges")
      .select("from_node_id, to_node_id, scenario_id")
      .eq("id", input.id)
      .single();
    if (edgeError) throw edgeError;
    const fromId = input.fromNodeId ?? edge.from_node_id;
    const toId = input.toNodeId ?? edge.to_node_id;
    await assertForwardEdge(supabase, edge.scenario_id, fromId, toId);
    fields.from_node_id = fromId;
    fields.to_node_id = toId;
  }

  const { data, error } = await supabase.from("storyline_edges").update(fields).eq("id", input.id).select().single();
  if (error) throw error;
  revalidatePath("/storyline");
  return data;
}

// DELETE .../storyline/edges/:id
export async function deleteStorylineEdge(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("storyline_edges").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/storyline");
}
