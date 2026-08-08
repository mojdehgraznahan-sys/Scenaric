"use server";

// Indicators — Step 8 (§11 of the Backend Build Plan). Static, generated once per scenario
// as part of the normal build order — NOT the same as Signpost (ai-grounding.ts's
// live-web-search-grounded, on-demand-from-Storyline product extension). Same table/action
// split convention as implications.ts/ai-implications.ts. Deterministic/classification-style
// call (§0 Principle 5) — effort:"low", thinking:false, matching ai-implications.ts's own
// resolution of "temperature 0" for this codebase's AI client (no literal temperature knob;
// see ai-implications.ts's header comment for the full reasoning).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { StorylineScenarioNotFoundError } from "@/lib/ai/errors";
import { getStoryline } from "./storyline";
import { PHASE_ORDER, type Phase } from "../storyline-mapping";

const IndicatorsSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  indicators: z
    .array(
      z.object({
        name: z.string(),
        // A real storyline_node id from the input's storyline_nodes list — never invented.
        // Validated server-side against the real node id set before insert, same defense-in-
        // depth pattern as ai-storyline.ts's signal_id cross-check.
        grounded_in: z.string(),
        // Sibling scenario names the model confirms this indicator would NOT equally signal —
        // recorded into indicators.note for transparency, not a separate column (see
        // 0021_indicators_grounded_in.sql's comment on why grounded_in alone got a real
        // column and this didn't).
        discriminates_from: z.array(z.string()),
      })
    )
    .max(6),
});

const INDICATORS_TASK_PROMPT = `Task: Generate leading indicators (Step 8) for ONE scenario —
concrete, externally observable events that would tell an analyst this scenario is the one
unfolding, distinguishable from the OTHER scenarios sharing this project's axes.

Input: { scenario: {name: string, storyline_nodes: [{id: string, phase: string, title: string}]},
         sibling_scenarios: [{name: string, tagline: string | null}] /* the other scenarios
         sharing this axes set, for discriminating power */ }

Rules:
- Each indicator must be phrased as a checkable, dated, or thresholded event ("X ruling
  published", "Y index crosses Z%") — never a vague directional claim ("regulation increases").
- Each indicator must map to exactly one storyline_node's mechanism: grounded_in must be that
  node's real id from storyline_nodes, never an invented id.
- Reject (do not output) any candidate indicator that would equally well signal one of
  sibling_scenarios — indicators must discriminate. List the sibling scenario names you
  confirmed it does NOT equally apply to in discriminates_from.
- 4-6 indicators. If the storyline doesn't have enough distinct mechanisms to derive
  genuinely discriminating indicators, return sufficient_evidence:false and a gap instead of
  padding with generic ones.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  indicators: [{ name: string, grounded_in: string, discriminates_from: string[] }] }`;

export interface GenerateIndicatorsResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  count: number;
}

// POST .../projects/:id/indicators/generate, scoped to one scenario.
export async function generateIndicatorsForScenario(scenarioId: string): Promise<GenerateIndicatorsResult> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id, axes_id, name")
    .eq("id", scenarioId)
    .single();
  if (scenarioError) throw new StorylineScenarioNotFoundError(scenarioId, scenarioError);

  // Sibling scenarios share this project's currently-active axes row — same convention
  // ai-grounding.ts's signpost-discrimination half already uses.
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

  const { nodes, thinChain } = await getStoryline(scenarioId);
  if (thinChain) {
    const gap =
      nodes.length === 0
        ? "This scenario has no storyline chain yet. Build one in Storyline first, then generate indicators from it."
        : `This scenario's storyline only has ${nodes.length} node${nodes.length === 1 ? "" : "s"} (need at least 4). Add more of the chain in Storyline before generating indicators.`;
    return { sufficientEvidence: false, gap, count: 0 };
  }

  const orderedNodes = [...nodes].sort((a, b) => PHASE_ORDER[a.phase as Phase] - PHASE_ORDER[b.phase as Phase]);
  const nodeIds = new Set(orderedNodes.map((n) => n.id));

  const output = await runStructured({
    step: "indicators.generate",
    projectId: scenario.project_id,
    taskPrompt: INDICATORS_TASK_PROMPT,
    input: {
      scenario: { name: scenario.name, storyline_nodes: orderedNodes.map((n) => ({ id: n.id, phase: n.phase, title: n.title })) },
      sibling_scenarios: siblingScenarios,
    },
    schema: IndicatorsSchema,
    effort: "low",
    thinking: false,
  });

  if (!output.sufficient_evidence || output.indicators.length === 0) {
    return { sufficientEvidence: false, gap: output.gap ?? "The model found insufficient evidence for discriminating indicators.", count: 0 };
  }

  const grounded = output.indicators.filter((ind) => nodeIds.has(ind.grounded_in));
  if (grounded.length === 0) {
    return { sufficientEvidence: false, gap: "The model's output didn't reference any real storyline nodes.", count: 0 };
  }

  // Regenerating replaces this scenario's prior set outright, same convention as
  // ai-implications.ts's generateImplicationsForScenario.
  const { error: deleteError } = await supabase.from("indicators").delete().eq("scenario_id", scenarioId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("indicators").insert(
    grounded.map((ind) => ({
      project_id: scenario.project_id,
      scenario_id: scenarioId,
      name: ind.name,
      status: "Watch" as const,
      grounded_in: ind.grounded_in,
      note: ind.discriminates_from.length > 0 ? `Discriminates from: ${ind.discriminates_from.join(", ")}` : null,
    }))
  );
  if (insertError) throw insertError;

  revalidatePath("/monitoring");
  revalidatePath("/narrative");
  return { sufficientEvidence: true, count: grounded.length };
}
