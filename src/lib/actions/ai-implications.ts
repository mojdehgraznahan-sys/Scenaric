"use server";

// Implications — Step 7 (§10 of the Backend Build Plan). Deterministic/classification-style
// call per §0 Principle 5 ("Classification/scoring calls run at low temperature with fixed
// rubrics") — this codebase's AI client has no literal temperature knob (see ai/client.ts),
// so "low temperature" here means the same effort:"low", thinking:false setting already used
// for the other deterministic classification calls (ai-matrix.ts's bucket classification,
// ai-signals.ts's impact/uncertainty scoring) — distinct from ai-narrative.ts's expansion
// call, which stays at the Build Plan's own "moderate temperature" generative setting since
// forcing flowing prose down to the classification setting would contradict that same
// principle, not honor it.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { StorylineScenarioNotFoundError } from "@/lib/ai/errors";

const CATEGORIES = ["capital", "hiring", "tech", "partners", "other"] as const;

const ImplicationsSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  implications: z
    .array(
      z.object({
        text: z.string(),
        category: z.enum(CATEGORIES),
        // The §10 spec's grounded_in_text field — a short quote/paraphrase of the exact
        // narrative sentence this implication is derived from. Required, not optional: an
        // implication with no citation must never reach the DB (grounded_in_text is `not
        // null` at the schema level too, 0020_implications_grounded_in_text.sql).
        grounded_in_text: z.string(),
      })
    )
    .min(3)
    .max(5),
});

const IMPLICATIONS_TASK_PROMPT = `Task: Derive strategic implications of ONE scenario for the focal
question — concrete "if this future happens, we would need to..."
statements, not restated scenario facts.

Input: { focal_question: string, scenario: {name: string, narrative: string},
         categories: ["capital","hiring","tech","partners","other"] /* capital = capital
         allocation, hiring = hiring/org, tech = technology/product, partners =
         partnerships, other = anything else */ }

Rules:
- Each implication must name a decision or resource shift the organization in
  focal_question would plausibly need to make — derived from a specific fact in
  scenario.narrative, cited in grounded_in_text (a short quote or tight paraphrase of the
  exact sentence in scenario.narrative that triggered this implication). Never invent an
  implication you cannot ground this way — if you cannot cite a real sentence from the
  narrative, drop it rather than include it.
- No generic implications that would apply to any scenario ("invest in talent") — must be
  scenario-specific, tied to what THIS scenario's narrative actually says happens.
- 3-5 implications, each exactly 1 sentence, each tagged with exactly one category.
- If scenario.narrative doesn't contain enough concrete, specific detail to derive at least
  3 genuinely scenario-specific implications, return sufficient_evidence:false and a gap
  explaining why, instead of padding with generic filler to hit the count.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  implications: [{ text: string, category: "capital"|"hiring"|"tech"|"partners"|"other",
                    grounded_in_text: string }] }`;

export interface GenerateImplicationsResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  count: number;
}

// POST .../scenarios/:id/implications/generate
export async function generateImplicationsForScenario(scenarioId: string): Promise<GenerateImplicationsResult> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id, name, narrative")
    .eq("id", scenarioId)
    .single();
  if (scenarioError) throw new StorylineScenarioNotFoundError(scenarioId, scenarioError);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", scenario.project_id)
    .single();
  if (projectError) throw new StorylineScenarioNotFoundError(scenarioId, projectError);

  // The §10 prompt's Input is { scenario: {name, narrative}, ... } — narrative is a
  // required input, not optional context. Reject before spending a model call on a
  // scenario that has nothing to ground implications in yet, same pattern as
  // ai-narrative.ts's thinChain short-circuit.
  if (!scenario.narrative) {
    return { sufficientEvidence: false, gap: "This scenario doesn't have a narrative yet — write or generate one before generating implications.", count: 0 };
  }

  const output = await runStructured({
    step: "implications.generate",
    projectId: scenario.project_id,
    taskPrompt: IMPLICATIONS_TASK_PROMPT,
    input: {
      focal_question: project.refined_focal_question ?? project.focal_question,
      scenario: { name: scenario.name, narrative: scenario.narrative },
      categories: CATEGORIES,
    },
    schema: ImplicationsSchema,
    effort: "low",
    thinking: false,
  });

  if (!output.sufficient_evidence || output.implications.length === 0) {
    return { sufficientEvidence: false, gap: output.gap ?? "The model found insufficient evidence for scenario-specific implications.", count: 0 };
  }

  // Defense in depth beyond the prompt's own instruction — never persist a candidate with
  // an empty/whitespace-only citation, regardless of what the model claims sufficient_evidence
  // is (the not-null DB column would reject an empty string's absence but not a blank one).
  const grounded = output.implications.filter((imp) => imp.grounded_in_text.trim().length > 0);
  if (grounded.length === 0) {
    return { sufficientEvidence: false, gap: "The model's output didn't cite any real narrative text.", count: 0 };
  }

  // Regenerating replaces the prior set outright rather than accumulating duplicates across
  // repeated "Regenerate" clicks — implications are a derived view of the current narrative,
  // not an append-only log.
  const { error: deleteError } = await supabase.from("implications").delete().eq("scenario_id", scenarioId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("implications").insert(
    grounded.map((imp) => ({
      project_id: scenario.project_id,
      scenario_id: scenarioId,
      text: imp.text,
      category: imp.category,
      grounded_in_text: imp.grounded_in_text,
    }))
  );
  if (insertError) throw insertError;

  revalidatePath("/narrative");
  return { sufficientEvidence: true, count: grounded.length };
}
