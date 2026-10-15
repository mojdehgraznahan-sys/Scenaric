"use server";

// Narrative prose expansion — Step 6, Narratives (§9 of the Backend Build Plan; also see
// SCHWARTZ_METHODOLOGY_SKILL.md's "Storyline — a non-canonical visualization of step 6" —
// Storyline and Narrative are the same step, this call turns the former's approved causal
// chain into the latter's readable prose, they must never diverge).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { StorylineScenarioNotFoundError } from "@/lib/ai/errors";
import { PERSONA_SCENARIO_STORYTELLER } from "@/lib/ai/personas";
import { getStoryline } from "./storyline";
import { PHASE_ORDER, type Phase } from "../storyline-mapping";
import { getOnboardingAnswers } from "./projects";
import { bothEndings } from "@/lib/onboarding/prompt-context";

const NarrativeExpandSchema = z.object({
  sufficient_evidence: z.boolean(),
  narrative: z.string().nullable(),
  // Not in the Build Plan §9 section's own minimal output schema, but required by the global
  // scaffold's own rule 3 (§3: "return sufficient_evidence: false and a gap description
  // instead of guessing") — added for consistency with every other sufficient_evidence:false
  // path in the app (storyline auto-suggest, grounding) rather than leaving this one call
  // silent about why.
  gap: z.string().nullable(),
});

const NARRATIVE_EXPAND_TASK_PROMPT = `${PERSONA_SCENARIO_STORYTELLER}

Task: Turn an approved storyline chain (nodes+edges) into the scenario's
readable narrative paragraph, in past-tense retrospective voice ("by
{horizon}, X had happened...") per Schwartz's convention of writing
scenarios as history remembered from the future. Write it so it reads as
history that matters to focal_question below, not a generic recap.

Input: { focal_question: string, scenario: {name, tagline, summary}, horizon: string,
         axis_a: {label, pole_a, pole_b, headline_a, headline_b},
         axis_b: {label, pole_a, pole_b, headline_a, headline_b}
         /* context only, not something to re-narrate from scratch — headline_a/
         headline_b (each {title, status, date} or null) is the concrete event
         the user already picked on the Matrix to anchor that pole; when
         present for the pole this scenario landed on, the narrative should
         read as a natural continuation of that headline rather than
         inventing its own opening fact */,
         storyline_nodes: [...ordered by phase], storyline_edges: [...],
         onboarding: { good: string|null, bad: string|null, turns: string|null } | null
         /* the user's own stated best/worst endings and turning points from onboarding —
         context only, for voice/emphasis; never a source of new facts */ }

Rules:
- When onboarding is given and this scenario plausibly resembles the user's own stated good or
  bad ending, let the retrospective voice echo it — but only using facts already present in
  storyline_nodes; onboarding text is never something to quote or restate as a new fact.
- The narrative must mention every node's core fact in causal order —
  do not invent connective events not present in the chain.
- Do not introduce any named company, person, statistic, or policy not
  present in a node's title/body, except a given headline_a/headline_b
  you are anchoring the opening on.
- 150-300 words. No bullet points — flowing prose.
- If storyline_nodes is empty or has fewer than 4 nodes, return
  sufficient_evidence:false and a gap explaining why, instead of writing
  a thin narrative from scratch.

Output schema:
{ sufficient_evidence: boolean, narrative: string | null, gap: string | null }`;

export interface ExpandNarrativeResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  narrative?: string | null;
}

// POST .../scenarios/:id/narrative/expand
export async function expandNarrativeWithAI(scenarioId: string, opts?: { allowCache?: boolean }): Promise<ExpandNarrativeResult> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id, axes_id, name, tagline, summary")
    .eq("id", scenarioId)
    .single();
  if (scenarioError) throw new StorylineScenarioNotFoundError(scenarioId, scenarioError);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("horizon, focal_question, refined_focal_question")
    .eq("id", scenario.project_id)
    .single();
  if (projectError) throw new StorylineScenarioNotFoundError(scenarioId, projectError);
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  // Same axis-context gathering as ai-storyline.ts's runAutoSuggestStoryline (real persisted
  // poles + the Matrix's chosen front-page headline event per pole) — duplicated rather than
  // shared, matching this codebase's existing per-file small-query convention.
  let axisA: { label: string | null; pole_a: string | null; pole_b: string | null; headline_a: unknown; headline_b: unknown } = { label: null, pole_a: null, pole_b: null, headline_a: null, headline_b: null };
  let axisB: typeof axisA = { label: null, pole_a: null, pole_b: null, headline_a: null, headline_b: null };
  if (scenario.axes_id) {
    const { data: axes, error: axesError } = await supabase
      .from("axes")
      .select("x_signal_id, y_signal_id, x_label, y_label")
      .eq("id", scenario.axes_id)
      .single();
    if (axesError) throw axesError;
    const axisSignalIds = [axes.y_signal_id, axes.x_signal_id].filter((id): id is string => id != null);
    const signalById = new Map<string, { pole_a: string | null; pole_b: string | null }>();
    if (axisSignalIds.length > 0) {
      const { data: axisSignals, error: axisSignalsError } = await supabase.from("signals").select("id, pole_a, pole_b").in("id", axisSignalIds);
      if (axisSignalsError) throw axisSignalsError;
      for (const s of axisSignals) signalById.set(s.id, s);
    }
    const headlineBySignalId = new Map<string, Map<"a" | "b", { title: string; status: string; date: string | null }>>();
    if (axisSignalIds.length > 0) {
      const { data: headlineRows, error: headlinesError } = await supabase
        .from("axis_headlines")
        .select("signal_id, side, event_id")
        .eq("project_id", scenario.project_id)
        .in("signal_id", axisSignalIds);
      if (headlinesError) throw headlinesError;
      const headlineEventIds = headlineRows.map((h) => h.event_id);
      if (headlineEventIds.length > 0) {
        const { data: headlineEvents, error: headlineEventsError } = await supabase
          .from("events")
          .select("id, title, status, occurred_on, window_label")
          .in("id", headlineEventIds);
        if (headlineEventsError) throw headlineEventsError;
        const headlineEventById = new Map(headlineEvents.map((e) => [e.id, e]));
        for (const row of headlineRows) {
          const ev = headlineEventById.get(row.event_id);
          if (!ev) continue;
          const bySide = headlineBySignalId.get(row.signal_id) ?? new Map();
          bySide.set(row.side, { title: ev.title, status: ev.status, date: ev.occurred_on ?? ev.window_label });
          headlineBySignalId.set(row.signal_id, bySide);
        }
      }
    }
    const axisInput = (signalId: string | null, label: string | null) => {
      const sig = signalId ? signalById.get(signalId) : undefined;
      const headlines = signalId ? headlineBySignalId.get(signalId) : undefined;
      return { label, pole_a: sig?.pole_a ?? null, pole_b: sig?.pole_b ?? null, headline_a: headlines?.get("a") ?? null, headline_b: headlines?.get("b") ?? null };
    };
    axisA = axisInput(axes.y_signal_id, axes.y_label);
    axisB = axisInput(axes.x_signal_id, axes.x_label);
  }

  // Reused as-is — same loader the Storyline page's own GET route uses, not re-queried here.
  const { nodes, edges, thinChain } = await getStoryline(scenarioId);

  // Reject before spending a model call on a chain that's already known to be too thin —
  // same pattern as ai-storyline.ts's candidateIds.size < 2 short-circuit.
  if (thinChain) {
    const gap =
      nodes.length === 0
        ? "This scenario has no storyline chain yet. Build one in Storyline first, then expand the narrative from it."
        : `This scenario's storyline only has ${nodes.length} node${nodes.length === 1 ? "" : "s"} (need at least 4). Add more of the chain in Storyline before expanding the narrative.`;
    return { sufficientEvidence: false, gap };
  }

  const orderedNodes = [...nodes].sort((a, b) => PHASE_ORDER[a.phase as Phase] - PHASE_ORDER[b.phase as Phase]);
  const onboarding = await getOnboardingAnswers(scenario.project_id);

  const output = await runStructured({
    step: "narrative.expand",
    projectId: scenario.project_id,
    taskPrompt: NARRATIVE_EXPAND_TASK_PROMPT,
    input: {
      focal_question: focalQuestion,
      scenario: { name: scenario.name, tagline: scenario.tagline, summary: scenario.summary },
      horizon: project.horizon,
      axis_a: axisA,
      axis_b: axisB,
      storyline_nodes: orderedNodes.map((n) => ({ phase: n.phase, title: n.title, body: n.body, year: n.year })),
      storyline_edges: edges.map((e) => ({ from: e.from_node_id, to: e.to_node_id, relationship: e.relationship })),
      onboarding: bothEndings(onboarding),
    },
    schema: NarrativeExpandSchema,
    effort: "medium",
    thinking: true,
    // Caching is only safe for the automatic "first time this scenario has no narrative"
    // call — opts.allowCache is true ONLY from that call site (page-narrative.tsx's mount
    // effect). The explicit "Expand with AI"/"Overwrite and regenerate" buttons call this same
    // function with no opts, so they always bypass the cache and get a genuinely fresh result,
    // even when the storyline chain hasn't changed since the last call.
    cache: opts?.allowCache ?? false,
  });

  if (!output.sufficient_evidence || !output.narrative) {
    return { sufficientEvidence: false, gap: output.gap ?? "The model found insufficient evidence for a coherent narrative." };
  }

  // Fresh AI content supersedes any prior hand edit — a subsequent "Expand with AI" run
  // should not warn about overwriting a manual edit that the user just chose to replace.
  const { error: updateError } = await supabase
    .from("scenarios")
    .update({ narrative: output.narrative, narrative_edited_by_user: false })
    .eq("id", scenarioId);
  if (updateError) throw updateError;
  revalidatePath("/narrative");

  return { sufficientEvidence: true, narrative: output.narrative };
}
