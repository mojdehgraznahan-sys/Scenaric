"use server";

// Matrix backend — Step 5, Scenario logics (§8). "Build Scenario Matrix" confirm: locks in
// the 2 axes and generates all 4 quadrants in one shot, mirroring ai-signals.ts's
// suggestSignals shape (one function does the AI call AND the persistence). Axis
// naming/poles stay the existing client-side axisMeta() logic (axis-data.ts) — not
// reinvented here, out of scope for this build.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import { SCENARIO_NAME_POOL } from "@/components/matrix/axis-data";
import { assertAxisCandidates } from "./matrix";
import type { Database } from "@/lib/supabase/types";

type Quadrant = "TL" | "TR" | "BL" | "BR";
const QUAD_ORDER: Quadrant[] = ["TL", "TR", "BL", "BR"];
const QUAD_COLOR: Record<Quadrant, string> = { TL: "#3B82F6", TR: "#10B981", BL: "#EF4444", BR: "#F97316" };

const ScenarioLogicsSchema = z.object({
  scenarios: z
    .array(
      z.object({
        quadrant: z.enum(["TL", "TR", "BL", "BR"]),
        name: z.string(),
        tagline: z.string(),
        summary: z.string(),
        logic: z.string(),
        plausible: z.boolean(),
        implausibility_note: z.string().optional(),
      })
    )
    .length(4),
});

const SCENARIO_LOGICS_TASK_PROMPT = `Task: Generate the 4 scenario logics for a 2x2 built from axis_a
(vertical) and axis_b (horizontal). A "logic" is the causal argument for
why that combination of pole outcomes is an internally consistent world
— not just a mashup of two adjectives.

Input: { focal_question, horizon, axis_a: {label, pole_pos, pole_neg},
         axis_b: {label, pole_pos, pole_neg}, predetermined_signals: [...],
         wildcard_signals: [...] /* optional shock disruptors you MAY reference in a
         scenario's narrative texture but must never fold into the axis logic itself —
         they are discrete, low-probability events, not part of the continuous 2x2 structure */,
         name_pool: string[] /* curated evocative names, model must pick
         from or closely riff on this pool — never invent unrelated
         proper nouns */ }

Rules:
- Produce exactly 4 scenarios, one per quadrant (TL/TR/BL/BR), each
  combining one pole of axis_a with one pole of axis_b. TL = axis_a
  pole_pos + axis_b pole_neg; TR = axis_a pole_pos + axis_b pole_pos;
  BL = axis_a pole_neg + axis_b pole_neg; BR = axis_a pole_neg + axis_b pole_pos.
- \`logic\` must explain the causal mechanism connecting the two poles
  into one coherent world in 1-2 sentences — if a quadrant combination
  is internally contradictory (e.g. both poles require the same
  precondition to differ), set \`plausible:false\` and explain why in
  \`implausibility_note\` instead of forcing a narrative.
- Weave in predetermined_signals where relevant — these hold true in
  ALL 4 quadrants and must not contradict any scenario's logic.
- \`tagline\` <= 6 words, \`summary\` <= 2 sentences, no invented statistics.

Output schema:
{ scenarios: [{ quadrant: "TL"|"TR"|"BL"|"BR", name, tagline, summary,
                logic, plausible: boolean, implausibility_note?: string }] }`;

export interface AxisInput {
  signalId: string;
  label: string;
  polePos: string;
  poleNeg: string;
}

export type AxisRow = Database["public"]["Tables"]["axes"]["Row"];
export type ScenarioRow = Database["public"]["Tables"]["scenarios"]["Row"];

export interface BuildScenariosResult {
  axes: AxisRow;
  scenarios: ScenarioRow[];
}

export type ScenarioLogic = z.infer<typeof ScenarioLogicsSchema>["scenarios"][number];

// Shared by buildScenarios (persists) and reaxisPreview (doesn't persist) — both need the
// identical §8 grounding: predetermined/wildcard signals pulled from matrix_dots, scoped to
// the project, fed into the same scenario-logic prompt. `step` differs per caller so the
// ai_runs audit log can tell a committed build apart from a preview-only call.
async function generateScenarioLogics(
  step: string,
  projectId: string,
  axisA: AxisInput,
  axisB: AxisInput
): Promise<ScenarioLogic[]> {
  // Is this even a valid axis pair at all — the more fundamental precondition, checked
  // before whether they're independent of each other.
  await assertAxisCandidates(projectId, [axisA.signalId, axisB.signalId]);

  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, horizon")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  // Predetermined + Wildcard buckets — predetermined holds true in every scenario (fixed
  // context, not a variable); wildcard signals are surfaced as optional shock disruptors the
  // model may reference in narrative texture but must never fold into the axis logic (§8).
  // Bucket is read from the persisted matrix_dots column (AI-classified, ai-matrix.ts's
  // classifyMatrixBuckets) — no client/deterministic recomputation, per §7.
  const { data: signals, error: signalsError } = await supabase
    .from("signals")
    .select("id, title, body, category")
    .eq("project_id", projectId);
  if (signalsError) throw signalsError;

  const { data: dots, error: dotsError } = await supabase
    .from("matrix_dots")
    .select("signal_id, bucket")
    .eq("project_id", projectId);
  if (dotsError) throw dotsError;
  const bucketBySignalId = new Map(dots.map((d) => [d.signal_id, d.bucket]));

  const signalsInBucket = (bucket: string) =>
    signals.filter((s) => bucketBySignalId.get(s.id) === bucket).map((s) => ({ title: s.title, body: s.body, category: s.category }));

  const predeterminedSignals = signalsInBucket("predetermined");
  const wildcardSignals = signalsInBucket("wildcard");

  const output = await runStructured({
    step,
    projectId,
    taskPrompt: SCENARIO_LOGICS_TASK_PROMPT,
    input: {
      focal_question: focalQuestion,
      horizon: project.horizon,
      axis_a: { label: axisA.label, pole_pos: axisA.polePos, pole_neg: axisA.poleNeg },
      axis_b: { label: axisB.label, pole_pos: axisB.polePos, pole_neg: axisB.poleNeg },
      predetermined_signals: predeterminedSignals,
      wildcard_signals: wildcardSignals,
      name_pool: SCENARIO_NAME_POOL,
    },
    schema: ScenarioLogicsSchema,
    effort: "high",
    thinking: true,
  });

  return output.scenarios;
}

// POST .../scenarios/reaxis-preview — Re-axis modal step 2, before committing migration (§8).
// Generates the 4 scenario logics for a candidate new axis pair with the same predetermined/
// wildcard grounding as buildScenarios, but persists nothing (no axes/scenarios rows) — purely
// a preview for the user to review before choosing to apply the migration.
export async function reaxisPreview(input: { projectId: string; axisA: AxisInput; axisB: AxisInput }): Promise<{ scenarios: ScenarioLogic[] }> {
  const scenarios = await generateScenarioLogics("scenarios.reaxis_preview", input.projectId, input.axisA, input.axisB);
  return { scenarios };
}

export async function buildScenarios(input: {
  projectId: string;
  axisA: AxisInput;
  axisB: AxisInput;
  independenceState: "independent" | "correlated" | "uncertain";
  independenceRationale?: string[];
  requestedNames?: Partial<Record<Quadrant, string>>;
}): Promise<BuildScenariosResult> {
  if (input.independenceState !== "independent") {
    throw new Error(`Cannot build scenarios on ${input.independenceState} axes — the independence check must pass first.`);
  }

  const scenarios = await generateScenarioLogics("scenarios.build", input.projectId, input.axisA, input.axisB);

  const supabase = createClient();

  // Enforce the "max 2 active rows per project" invariant from the schema's own comment
  // (0001_schema.sql) — cheap guard against a retry; the real re-axis migration UI stays
  // out of scope for this build.
  const { error: deactivateError } = await supabase
    .from("axes")
    .update({ is_active: false })
    .eq("project_id", input.projectId)
    .eq("is_active", true);
  if (deactivateError) throw deactivateError;

  const { data: axesRow, error: axesError } = await supabase
    .from("axes")
    .insert({
      project_id: input.projectId,
      // Matches the existing modal's convention: axis A determines top/bottom (y), axis B
      // determines left/right (x) — see build-scenarios-modal.tsx's quadrant combos.
      x_signal_id: input.axisB.signalId,
      y_signal_id: input.axisA.signalId,
      x_label: input.axisB.label,
      y_label: input.axisA.label,
      independence_state: input.independenceState,
      independence_rationale: input.independenceRationale?.join(" ") ?? null,
      is_active: true,
    })
    .select()
    .single();
  if (axesError) throw axesError;

  const byQuadrant = new Map(scenarios.map((s) => [s.quadrant, s]));
  const scenarioInserts = QUAD_ORDER.map((quadrant) => {
    const s = byQuadrant.get(quadrant)!;
    const requestedName = input.requestedNames?.[quadrant];
    return {
      project_id: input.projectId,
      axes_id: axesRow.id,
      quadrant,
      name: requestedName && requestedName.trim() ? requestedName.trim() : s.name,
      tagline: s.tagline,
      summary: s.summary,
      color: QUAD_COLOR[quadrant],
      logic: s.logic,
      plausible: s.plausible,
      implausibility_note: s.implausibility_note ?? null,
    };
  });

  const { data: scenarioRows, error: scenariosError } = await supabase.from("scenarios").insert(scenarioInserts).select();
  if (scenariosError) throw scenariosError;

  revalidatePath("/matrix");
  return { axes: axesRow, scenarios: scenarioRows };
}
