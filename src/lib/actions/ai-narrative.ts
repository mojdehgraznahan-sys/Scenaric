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
import { getStoryline } from "./storyline";
import { PHASE_ORDER, type Phase } from "../storyline-mapping";

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

const NARRATIVE_EXPAND_TASK_PROMPT = `Task: Turn an approved storyline chain (nodes+edges) into the scenario's
readable narrative paragraph, in past-tense retrospective voice ("by
{horizon}, X had happened...") per Schwartz's convention of writing
scenarios as history remembered from the future.

Input: { scenario: {name, tagline, summary}, horizon: string,
         storyline_nodes: [...ordered by phase], storyline_edges: [...] }

Rules:
- The narrative must mention every node's core fact in causal order —
  do not invent connective events not present in the chain.
- Do not introduce any named company, person, statistic, or policy not
  present in a node's title/body.
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
export async function expandNarrativeWithAI(scenarioId: string): Promise<ExpandNarrativeResult> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id, name, tagline, summary")
    .eq("id", scenarioId)
    .single();
  if (scenarioError) throw new StorylineScenarioNotFoundError(scenarioId, scenarioError);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("horizon")
    .eq("id", scenario.project_id)
    .single();
  if (projectError) throw new StorylineScenarioNotFoundError(scenarioId, projectError);

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

  const output = await runStructured({
    step: "narrative.expand",
    projectId: scenario.project_id,
    taskPrompt: NARRATIVE_EXPAND_TASK_PROMPT,
    input: {
      scenario: { name: scenario.name, tagline: scenario.tagline, summary: scenario.summary },
      horizon: project.horizon,
      storyline_nodes: orderedNodes.map((n) => ({ phase: n.phase, title: n.title, body: n.body, year: n.year })),
      storyline_edges: edges.map((e) => ({ from: e.from_node_id, to: e.to_node_id, relationship: e.relationship })),
    },
    schema: NarrativeExpandSchema,
    effort: "medium",
    thinking: true,
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
