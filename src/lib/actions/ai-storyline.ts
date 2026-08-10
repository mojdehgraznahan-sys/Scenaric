"use server";

// Storyline backend — Step 6, Narratives & storyline (§9 of the Backend Build Plan; also see
// SCHWARTZ_METHODOLOGY_SKILL.md's "Storyline" section). The model SELECTS which of the
// project's real signals belong in ONE scenario's causal path, ASSIGNS each to one of the 5
// fixed phases, and CHAINS them with directional edges — it never invents a signal.
//
// This deliberately diverges from the Build Plan PDF's literal node schema
// ({grounded_in: string[], inference: boolean}, up to 40% ungrounded) in favor of the
// stricter rule the skill file states explicitly: "No node may be invented prose with no
// underlying project data." Every node in phases precursors/catalysts/first_order/
// second_order requires a real signal_id (matching the matrix_dots.signal_id / the DB
// schema's own `signal_id references signals(id)` column) — the only node allowed a null
// signal_id is the "realized" phase's capstone node, which restates the scenario's own
// already-grounded name/logic/summary rather than any single driving-force signal.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { StorylineScenarioNotFoundError, ValidationError } from "@/lib/ai/errors";
import { getProjectAiSettings } from "./project-ai-settings";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";
import { PHASES, isPhaseOrderValid, type Phase } from "../storyline-mapping";
import type { SteepCategory } from "./signals";

type StorylineNodeRow = Database["public"]["Tables"]["storyline_nodes"]["Row"];
type StorylineEdgeRow = Database["public"]["Tables"]["storyline_edges"]["Row"];
type ScenarioStorylineInsert = Database["public"]["Tables"]["scenario_storylines"]["Insert"];
type SupabaseClient = ReturnType<typeof createClient>;

// Upserts the single generation-status row for a scenario (unique on scenario_id, per
// 0017_storyline_status_and_axis_label.sql) — called at every state transition of
// autoSuggestStoryline below so a caller/route can poll "is this still generating, did it
// fail, why." Only the fields passed in are changed; project_id/scenario_id/updated_at are
// always re-asserted so this doubles as the initial insert on a scenario's first run.
export async function markStorylineStatus(
  supabase: SupabaseClient,
  projectId: string,
  scenarioId: string,
  fields: Partial<Pick<ScenarioStorylineInsert, "status" | "error_message" | "generated_at">>
) {
  const { error } = await supabase.from("scenario_storylines").upsert(
    {
      project_id: projectId,
      scenario_id: scenarioId,
      updated_at: new Date().toISOString(),
      ...fields,
    },
    { onConflict: "scenario_id" }
  );
  if (error) throw error;
}

const StorylineNodeSchema = z.object({
  // Model-assigned local scratch id (not a DB id) — used only to wire edges below before
  // real UUIDs exist.
  id: z.string(),
  phase: z.enum(PHASES),
  title: z.string(),
  body: z.string(),
  year: z.number().int().nullable(),
  strength: z.enum(["Strong", "Moderate", "Weak"]),
  // Required for every node except the single "realized"-phase capstone node — validated
  // server-side below, not just requested by the prompt.
  signal_id: z.string().nullable(),
});

const StorylineChainSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().optional(),
  nodes: z.array(StorylineNodeSchema),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      relationship: z.enum(["Leads to", "Enables", "Amplifies", "Blocks"]),
      confidence: z.enum(["Strong", "Moderate", "Weak"]),
    })
  ),
});

const STORYLINE_TASK_PROMPT = `Task: Build the causal chain for ONE scenario across Schwartz's 5 phases:
Precursors (conditions already true today) → Catalysts (near-term
triggering events) → First-order effects → Second-order effects →
Scenario realized (the end state at the horizon).

You are SELECTING from the project's real signals below — never invent a
signal, fact, or entity that isn't already present in library_signals or
predetermined_signals. Your job is to (1) choose which of these signals
plausibly belong in THIS scenario's specific causal path — not every
signal in the library needs to appear, only the ones that build this
scenario's argument, and a scenario sharing axes with 3 siblings should
select a DIFFERENT subset/framing than they would, even from the same
pool — (2) assign each selected signal to the correct phase, and (3)
connect them with directional edges showing how earlier signals causally
lead to later ones and ultimately to the scenario being realized.

Input: { scenario: {name, logic, tagline, summary, quadrant},
         axis_a: {signal_id, label}, axis_b: {signal_id, label} /* context only —
         these 2 signals already define the quadrant itself and are NOT present in
         library_signals/predetermined_signals below; your job is explaining how
         you plausibly get there using the rest of the library, not re-narrating
         the axes */,
         library_signals: [{id, title, body, category}],
         predetermined_signals: [{id, title, body, category}],
         horizon: string }

Rules:
- Every node in phases precursors/catalysts/first_order/second_order MUST
  set signal_id to one of the ids given in library_signals or
  predetermined_signals, copied VERBATIM — never a fabricated id, never
  null. That node's title/body must be a faithful restatement of that
  signal's own title/body — you may add causal framing language
  connecting it to neighboring nodes in the chain, but must not add
  facts, statistics, or claims the signal itself doesn't already state.
- Exactly one node in the "realized" phase may have signal_id: null —
  this is the scenario's own realized end-state, and its title/body must
  be a faithful restatement of the scenario's own name/logic/summary
  (given in the input), not new invented content. Any other node in the
  "realized" phase must still set a real signal_id, same as every other
  phase, if a signal genuinely represents part of the realized state.
- No forward-skipping shortcuts that assert the end state as a
  precursor — respect causal ordering; a node in phase N can only
  causally justify nodes in phase N or later (never earlier — that is
  the "backward in time" error state the product flags and rejects).
- Edge relationship in {"Leads to","Enables","Amplifies","Blocks"}.
  confidence in {"Strong","Moderate","Weak"}.
- strength (per node) in {"Strong","Moderate","Weak"} — how central and
  well-evidenced this node is to the chain, not a vibe.
- 7-10 nodes total, at least 1 per phase.
- If fewer than 2 real candidate signals are available, or the available
  signals genuinely don't support a coherent, differentiated chain for
  THIS scenario, return sufficient_evidence:false and a one-sentence gap
  instead of forcing a thin or generic chain.

Output schema:
{ sufficient_evidence: boolean, gap?: string,
  nodes: [{ id, phase, title, body, year: number|null,
            strength: "Strong"|"Moderate"|"Weak", signal_id: string|null }],
  edges: [{ from, to, relationship, confidence }] }`;

export interface AutoSuggestStorylineResult {
  sufficientEvidence: boolean;
  gap?: string;
  nodes: StorylineNodeRow[];
  edges: StorylineEdgeRow[];
}

const EMPTY_FAILURE = (gap?: string): AutoSuggestStorylineResult => ({ sufficientEvidence: false, gap, nodes: [], edges: [] });

export async function autoSuggestStoryline(scenarioId: string): Promise<AutoSuggestStorylineResult> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id, axes_id, name, logic, tagline, summary, quadrant")
    .eq("id", scenarioId)
    .single();
  if (scenarioError) throw new StorylineScenarioNotFoundError(scenarioId, scenarioError);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("horizon")
    .eq("id", scenario.project_id)
    .single();
  if (projectError) throw new StorylineScenarioNotFoundError(scenarioId, projectError);

  const projectId = scenario.project_id;

  // AI Analyst tab's "Use Schwartz framework strictly" toggle (project_ai_settings.
  // strict_schwartz_mode, default true) — when on, requires the scenario's own logic (step 5)
  // to already be set before this product extension can auto-suggest a chain at all. When
  // off, only this readiness check is skipped — the storyline's own causal-ordering rules
  // (one-directional phases, real signal_id grounding) are untouched either way.
  const aiSettings = await getProjectAiSettings(projectId, supabase);
  if (aiSettings.strict_schwartz_mode && !scenario.logic) {
    throw new ValidationError(
      "Strict Schwartz Mode is on — this scenario needs its logic (step 5) written before auto-suggesting a storyline, or turn off strict mode in Settings → AI Analyst to generate early."
    );
  }

  await markStorylineStatus(supabase, projectId, scenarioId, { status: "generating", error_message: null });

  try {
    return await runAutoSuggestStoryline(supabase, scenarioId, projectId, scenario, project);
  } catch (err) {
    await markStorylineStatus(supabase, projectId, scenarioId, {
      status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

async function runAutoSuggestStoryline(
  supabase: SupabaseClient,
  scenarioId: string,
  projectId: string,
  scenario: {
    project_id: string;
    axes_id: string | null;
    name: string;
    logic: string | null;
    tagline: string | null;
    summary: string | null;
    quadrant: string;
  },
  project: { horizon: string }
): Promise<AutoSuggestStorylineResult> {
  // Poles (pole_pos/pole_neg) are only ever computed client-side (axis-data.ts's axisMeta())
  // and never persisted server-side — passing only {signal_id, label} here is honest about
  // what's actually real project data, rather than fabricating poles the model would then
  // treat as fact.
  let axisA: { signal_id: string | null; label: string | null } = { signal_id: null, label: null };
  let axisB: { signal_id: string | null; label: string | null } = { signal_id: null, label: null };
  if (scenario.axes_id) {
    const { data: axes, error: axesError } = await supabase
      .from("axes")
      .select("x_signal_id, y_signal_id, x_label, y_label")
      .eq("id", scenario.axes_id)
      .single();
    if (axesError) throw axesError;
    // Matches buildScenarios' own convention (ai-scenarios.ts): axis A is the y (top/bottom)
    // axis, axis B is the x (left/right) axis.
    axisA = { signal_id: axes.y_signal_id, label: axes.y_label };
    axisB = { signal_id: axes.x_signal_id, label: axes.x_label };
  }

  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body, category")
    .eq("project_id", scenario.project_id);
  if (signalsError) throw signalsError;

  const { data: dots, error: dotsError } = await supabase
    .from("matrix_dots")
    .select("signal_id, bucket")
    .eq("project_id", scenario.project_id);
  if (dotsError) throw dotsError;
  const bucketBySignalId = new Map(dots.map((d) => [d.signal_id, d.bucket]));
  const signalById = new Map(signals.map((s) => [s.id, s]));

  // Wildcards are context-only, never part of the mainline causal argument (§8) — excluded
  // from both pools, matching the Build Plan's storyline prompt input, which has no
  // wildcard_signals slot at all (unlike predetermined_signals). The axis signals are
  // ALSO excluded here (SCHWARTZ_METHODOLOGY_SKILL.md's Storyline section): the axes define
  // the quadrant itself — Storyline's job is explaining how you plausibly get there using
  // the *rest* of the library, not re-narrating the axes.
  const axisSignalIds = new Set([axisA.signal_id, axisB.signal_id].filter((id): id is string => id != null));
  const nonWildcard = signals.filter((s) => bucketBySignalId.get(s.id) !== "wildcard" && !axisSignalIds.has(s.id));
  const librarySignals = nonWildcard.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category }));
  const predeterminedSignals = nonWildcard
    .filter((s) => bucketBySignalId.get(s.id) === "predetermined")
    .map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category }));
  const candidateIds = new Set(librarySignals.map((s) => s.id));

  // Reject before spending a model call on an already-invalid request — same pattern as
  // assertAxisCandidates in matrix.ts.
  if (candidateIds.size < 2) {
    const gap = "Fewer than 2 signals are available in this project to build a causal chain.";
    await markStorylineStatus(supabase, projectId, scenarioId, { status: "failed", error_message: gap });
    return EMPTY_FAILURE(gap);
  }

  const output = await runStructured({
    step: "storyline.auto_suggest",
    projectId: scenario.project_id,
    taskPrompt: STORYLINE_TASK_PROMPT,
    input: {
      scenario: { name: scenario.name, logic: scenario.logic, tagline: scenario.tagline, summary: scenario.summary, quadrant: scenario.quadrant },
      axis_a: axisA,
      axis_b: axisB,
      library_signals: librarySignals,
      predetermined_signals: predeterminedSignals,
      horizon: project.horizon,
    },
    schema: StorylineChainSchema,
    effort: "medium",
    thinking: false,
  });

  if (!output.sufficient_evidence || output.nodes.length === 0) {
    const gap = output.gap ?? "The model found insufficient evidence for a coherent chain.";
    await markStorylineStatus(supabase, projectId, scenarioId, { status: "failed", error_message: gap });
    return EMPTY_FAILURE(output.gap);
  }

  // Validate before persisting — defense in depth beyond the prompt's own instructions.
  // A non-null signal_id must be one of the real ids we actually offered (never a
  // hallucinated id / free-text stand-in); dedupe local ids defensively in case the model
  // reuses one.
  const seenLocalIds = new Set<string>();
  const validNodes = output.nodes.filter((n) => {
    if (seenLocalIds.has(n.id)) return false;
    if (n.signal_id != null && !candidateIds.has(n.signal_id)) return false;
    seenLocalIds.add(n.id);
    return true;
  });

  if (validNodes.length === 0) {
    const gap = "The model's output didn't reference any real project signals.";
    await markStorylineStatus(supabase, projectId, scenarioId, { status: "failed", error_message: gap });
    return EMPTY_FAILURE(gap);
  }

  // Replace any prior auto-suggested chain for this scenario. storyline_edges.from_node_id/
  // to_node_id are `on delete cascade`, so deleting the nodes removes dependent edges too.
  const { error: deleteError } = await supabase.from("storyline_nodes").delete().eq("scenario_id", scenarioId);
  if (deleteError) throw deleteError;

  const { data: insertedNodes, error: insertNodesError } = await supabase
    .from("storyline_nodes")
    .insert(
      validNodes.map((n) => ({
        project_id: scenario.project_id,
        scenario_id: scenarioId,
        phase: n.phase,
        // Server-derived from the real signal row, never trusted from model output — one
        // less thing the model could mis-transcribe. Null only for the signal-less
        // "realized" capstone node.
        category: n.signal_id ? (signalById.get(n.signal_id)?.category ?? null) : null,
        title: n.title,
        body: n.body,
        year: n.year,
        strength: n.strength,
        signal_id: n.signal_id,
      }))
    )
    .select();
  if (insertNodesError) throw insertNodesError;

  const idMap = new Map<string, string>();
  const phaseByLocalId = new Map<string, Phase>();
  validNodes.forEach((n, i) => {
    idMap.set(n.id, insertedNodes[i].id);
    phaseByLocalId.set(n.id, n.phase);
  });

  // One-directional causality: an edge may only point from a node's phase to the same or a
  // later phase — drop (never insert) anything backward, or referencing a node that didn't
  // survive validation above.
  const validEdges = output.edges.filter((e) => {
    const fromPhase = phaseByLocalId.get(e.from);
    const toPhase = phaseByLocalId.get(e.to);
    if (!fromPhase || !toPhase) return false;
    return isPhaseOrderValid(fromPhase, toPhase);
  });

  let insertedEdges: StorylineEdgeRow[] = [];
  if (validEdges.length > 0) {
    const { data, error: insertEdgesError } = await supabase
      .from("storyline_edges")
      .insert(
        validEdges.map((e) => ({
          project_id: scenario.project_id,
          scenario_id: scenarioId,
          from_node_id: idMap.get(e.from)!,
          to_node_id: idMap.get(e.to)!,
          relationship: e.relationship,
          confidence: e.confidence,
        }))
      )
      .select();
    if (insertEdgesError) throw insertEdgesError;
    insertedEdges = data;
  }

  await markStorylineStatus(supabase, projectId, scenarioId, {
    status: "completed",
    generated_at: new Date().toISOString(),
    error_message: null,
  });

  return { sufficientEvidence: true, nodes: insertedNodes, edges: insertedEdges };
}

// POST .../scenarios/:id/storyline/find-signal — the side panel's "Find signals" gap-filler.
// A targeted version of the same job as auto-suggest: SEARCH the project's existing signals
// and SELECT the ones that plausibly cause or connect to the surrounding chain at one
// specific gap, ranked with a causal rationale each. Never invents a signal to plug the gap
// — pure search, inserts nothing; the caller picks a candidate and adds it via
// createStorylineNode/createStorylineEdge (storyline.ts).
const FindSignalSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().optional(),
  candidates: z
    .array(
      z.object({
        signal_id: z.string(),
        rationale: z.string(),
      })
    )
    .max(5),
});

const FIND_SIGNAL_TASK_PROMPT = `Task: The user is filling a gap in one scenario's storyline causal
chain at a specific phase. Search the project's real signals below and
SELECT the ones that plausibly cause or connect to the surrounding chain
at that point — you are not inventing a new signal, only ranking which
of the existing ones best fit this gap.

Input: { scenario: {name, logic}, phase: string, gap_description: string,
         surrounding_nodes: [{phase, title, signal_id}] /* the scenario's
         existing chain, for causal context — what comes immediately
         before/after this gap */,
         candidate_signals: [{id, title, body, category}] /* signals not
         already used in this scenario's chain, and never this project's own
         2 scenario-axis signals — those define the quadrant itself, not the
         path to it */ }

Rules:
- Only select from candidate_signals — never invent a signal or describe
  one that isn't in the list.
- A candidate is a good fit only if it plausibly causes, enables, or is
  caused/enabled by nodes adjacent to this phase in surrounding_nodes —
  respect one-directional causality (a Precursors-phase gap shouldn't be
  filled by something that only makes sense as an effect of a later node).
- rationale is one sentence: why this signal causally connects to what's
  immediately before/after this gap, citing the specific mechanism.
- Rank best-fit first. Return at most 5 candidates.
- If nothing in candidate_signals plausibly fits, return
  sufficient_evidence:false and an empty candidates array — do not force
  a weak match just to return something.

Output schema:
{ sufficient_evidence: boolean, gap?: string,
  candidates: [{ signal_id: string, rationale: string }] }`;

export interface FindSignalCandidate {
  signalId: string;
  title: string;
  category: SteepCategory;
  rationale: string;
}

export interface FindSignalForGapResult {
  sufficientEvidence: boolean;
  gap?: string;
  candidates: FindSignalCandidate[];
}

export async function findSignalForGap(input: { scenarioId: string; phase: Phase; gapDescription: string }): Promise<FindSignalForGapResult> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id, axes_id, name, logic")
    .eq("id", input.scenarioId)
    .single();
  if (scenarioError) throw scenarioError;

  const axisSignalIds = new Set<string>();
  if (scenario.axes_id) {
    const { data: axes, error: axesError } = await supabase.from("axes").select("x_signal_id, y_signal_id").eq("id", scenario.axes_id).single();
    if (axesError) throw axesError;
    if (axes.x_signal_id) axisSignalIds.add(axes.x_signal_id);
    if (axes.y_signal_id) axisSignalIds.add(axes.y_signal_id);
  }

  const { data: existingNodes, error: nodesError } = await supabase
    .from("storyline_nodes")
    .select("phase, title, signal_id")
    .eq("scenario_id", input.scenarioId);
  if (nodesError) throw nodesError;
  const usedSignalIds = new Set(existingNodes.map((n) => n.signal_id).filter((id): id is string => id != null));

  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body, category")
    .eq("project_id", scenario.project_id);
  if (signalsError) throw signalsError;

  const { data: dots, error: dotsError } = await supabase
    .from("matrix_dots")
    .select("signal_id, bucket")
    .eq("project_id", scenario.project_id);
  if (dotsError) throw dotsError;
  const bucketBySignalId = new Map(dots.map((d) => [d.signal_id, d.bucket]));
  const signalById = new Map(signals.map((s) => [s.id, s]));

  // A gap-filler shouldn't re-suggest a signal already placed in this scenario's chain;
  // wildcards stay excluded for the same "context-only" reason as auto-suggest; axis signals
  // are excluded because they define the quadrant itself, not the path to it
  // (SCHWARTZ_METHODOLOGY_SKILL.md's Storyline section).
  const candidateSignals = signals.filter(
    (s) => !usedSignalIds.has(s.id) && !axisSignalIds.has(s.id) && bucketBySignalId.get(s.id) !== "wildcard"
  );
  if (candidateSignals.length === 0) {
    return { sufficientEvidence: false, gap: "No unused project signals are available to fill this gap.", candidates: [] };
  }
  const candidateIds = new Set(candidateSignals.map((s) => s.id));

  const output = await runStructured({
    step: "storyline.find_signal",
    projectId: scenario.project_id,
    taskPrompt: FIND_SIGNAL_TASK_PROMPT,
    input: {
      scenario: { name: scenario.name, logic: scenario.logic },
      phase: input.phase,
      gap_description: input.gapDescription,
      surrounding_nodes: existingNodes,
      candidate_signals: candidateSignals.map((s) => ({ id: s.id, title: s.title, body: s.body, category: s.category })),
    },
    schema: FindSignalSchema,
    effort: "medium",
    thinking: false,
  });

  if (!output.sufficient_evidence) {
    return { sufficientEvidence: false, gap: output.gap, candidates: [] };
  }

  // Validate before returning — defense in depth beyond the prompt's own instructions, same
  // as auto-suggest: never surface a hallucinated id.
  const candidates: FindSignalCandidate[] = output.candidates
    .filter((c) => candidateIds.has(c.signal_id))
    .map((c) => {
      const s = signalById.get(c.signal_id)!;
      return { signalId: c.signal_id, title: s.title, category: s.category, rationale: c.rationale };
    });

  return { sufficientEvidence: candidates.length > 0, candidates };
}
