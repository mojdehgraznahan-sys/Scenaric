"use server";

// Matrix v2 (design/handoff/2026-10-01/CLAUDE_CODE_MATRIX_V2_PROMPTS.md, Prompt 5) — real
// Supabase-backed data + api for the verbatim-ported MatrixV2 component. Placement is computed
// server-side by place_force (0040_matrix_v2_placement_and_axis_functions.sql); this file is a
// thin CRUD layer over that function plus axes/axis_headlines, matching the signals.ts/
// ai-signals.ts split already used elsewhere in this codebase (no AI calls here).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { AXES_LOCKED } from "@/lib/matrix-mapping";

export type ImpactAnswer = "no" | "somewhat" | "completely";
export type Plausible = "both" | "a" | "b";

export interface MatrixPlacementRow {
  signalId: string;
  x: number;
  y: number;
  impactAnswer: ImpactAnswer | null;
  plausible: Plausible | null;
  confirmed: boolean;
}

export interface MatrixV2Data {
  placements: MatrixPlacementRow[];
  // [x_signal_id, y_signal_id] from the project's active `axes` row, nulls filtered out — so
  // a single picked axis comes back as a 1-element array, matching MatrixV2's `axes` prop shape.
  axisIds: string[];
  // "<signalId>:<side>" -> eventId
  headlines: Record<string, string>;
}

// GET-equivalent: everything useMatrixV2 (store.tsx) needs in one round-trip.
export async function getMatrixV2Data(projectId: string): Promise<MatrixV2Data> {
  const supabase = createClient();

  const [placementsRes, axesRes, headlinesRes] = await Promise.all([
    supabase.from("matrix_placements_v").select("signal_id, x, y, impact_answer, plausible, confirmed").eq("project_id", projectId),
    supabase.from("axes").select("x_signal_id, y_signal_id").eq("project_id", projectId).eq("is_active", true).maybeSingle(),
    supabase.from("axis_headlines").select("signal_id, side, event_id").eq("project_id", projectId),
  ]);
  if (placementsRes.error) throw placementsRes.error;
  if (axesRes.error) throw axesRes.error;
  if (headlinesRes.error) throw headlinesRes.error;

  return {
    placements: placementsRes.data.map((p) => ({
      signalId: p.signal_id,
      x: p.x,
      y: p.y,
      impactAnswer: p.impact_answer,
      plausible: p.plausible,
      confirmed: p.confirmed,
    })),
    axisIds: axesRes.data ? [axesRes.data.x_signal_id, axesRes.data.y_signal_id].filter((id): id is string => !!id) : [],
    headlines: Object.fromEntries(headlinesRes.data.map((h) => [`${h.signal_id}:${h.side}`, h.event_id])),
  };
}

// api.setPlacement — rpc place_force, which recomputes x/y server-side and enforces every
// invariant (signal in project, has poles, event ids actually linked) per 0040's own checks.
export async function placeForce(projectId: string, signalId: string, impactAnswer: ImpactAnswer, plausible: Plausible, eventIds: string[]): Promise<MatrixPlacementRow> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("place_force", {
    p_project: projectId,
    p_signal: signalId,
    p_impact: impactAnswer,
    p_plausible: plausible,
    p_event_ids: eventIds,
  });
  if (error) throw error;
  revalidatePath("/matrix");
  return { signalId: data.signal_id, x: data.x, y: data.y, impactAnswer: data.impact_answer, plausible: data.plausible, confirmed: data.confirmed };
}

// api.setAxes — rpc set_axes, which validates both ids are critical-quadrant forces and stages
// them into the EXISTING `axes` table (see 0040's comment for why there's no scenario_axes
// table). Never touches independence_state — checkAxisIndependence/buildScenarios (ai-matrix.ts/
// ai-scenarios.ts) still own that, unchanged by Matrix v2.
export async function setScenarioAxes(projectId: string, ids: string[]): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("set_axes", { p_project: projectId, p_ids: ids });
  if (error) {
    if (error.message.includes(AXES_LOCKED)) throw new Error(AXES_LOCKED);
    throw error;
  }
  revalidatePath("/matrix");
  return [data.x_signal_id, data.y_signal_id].filter((id): id is string => !!id);
}

// api.setHeadline — plain upsert; 0039's enforce_axis_headline_event trigger (not this function)
// is what actually guards the event/side/wildcard/project invariants.
export async function setAxisHeadline(projectId: string, signalId: string, side: "a" | "b", eventId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("axis_headlines").upsert({ project_id: projectId, signal_id: signalId, side, event_id: eventId }, { onConflict: "project_id,signal_id,side" });
  if (error) throw error;
  revalidatePath("/matrix");
}
