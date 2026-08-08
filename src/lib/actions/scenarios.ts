"use server";

// Scenarios CRUD — Canvas backend build, Step 5 (§8). Plain reads/mutations only; the
// AI-driven build/reaxis-preview calls live in ./ai-scenarios.ts, matching the
// signals.ts/ai-signals.ts and matrix.ts/ai-matrix.ts split already used elsewhere.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type ScenarioRow = Database["public"]["Tables"]["scenarios"]["Row"];
type AxesRow = Database["public"]["Tables"]["axes"]["Row"];

export interface ScenarioWithAxes {
  id: string;
  quadrant: ScenarioRow["quadrant"];
  name: string;
  tagline: string | null;
  summary: string | null;
  narrative: string | null;
  logic: string | null;
  color: string | null;
  plausible: boolean | null;
  implausibilityNote: string | null;
  archived: boolean;
  reaxedAt: string | null;
  narrativeEditedByUser: boolean;
  // axes_id is nullable (on delete set null) and a scenario's axes row never changes after
  // creation (a re-axis deactivates the old axes row and creates a new one, rather than
  // mutating it) — so this is a stable creation-time snapshot, not a live/derived value.
  axisA: { signalId: string | null; label: string | null } | null;
  axisB: { signalId: string | null; label: string | null } | null;
}

// GET .../scenarios — every scenario for the project, active + archived (Canvas already
// filters client-side, same convention it uses today). Empty array if none — never an
// error — so Canvas's existing empty-quadrant placeholder is the natural result, not a
// special case the caller has to handle.
export async function getScenarios(projectId: string): Promise<ScenarioWithAxes[]> {
  const supabase = createClient();
  const { data: scenarios, error } = await supabase
    .from("scenarios")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (scenarios.length === 0) return [];

  const axesIds = Array.from(new Set(scenarios.map((s) => s.axes_id).filter((id): id is string => id != null)));
  const axesById = new Map<string, AxesRow>();
  if (axesIds.length > 0) {
    const { data: axesRows, error: axesError } = await supabase.from("axes").select("*").in("id", axesIds);
    if (axesError) throw axesError;
    for (const a of axesRows) axesById.set(a.id, a);
  }

  return scenarios.map((s) => {
    // Matches buildScenarios' own convention (ai-scenarios.ts): axis A is the y (top/bottom)
    // axis, axis B is the x (left/right) axis.
    const axes = s.axes_id ? axesById.get(s.axes_id) : undefined;
    return {
      id: s.id,
      quadrant: s.quadrant,
      name: s.name,
      tagline: s.tagline,
      summary: s.summary,
      narrative: s.narrative,
      logic: s.logic,
      color: s.color,
      plausible: s.plausible,
      implausibilityNote: s.implausibility_note,
      archived: s.is_archived,
      reaxedAt: s.reaxed_at,
      narrativeEditedByUser: s.narrative_edited_by_user,
      axisA: axes ? { signalId: axes.y_signal_id, label: axes.y_label } : null,
      axisB: axes ? { signalId: axes.x_signal_id, label: axes.x_label } : null,
    };
  });
}

// PATCH .../scenarios/:id — archive/restore toggle only, no AI. Trusts RLS for project
// scoping (supabase/migrations/0003_rls.sql), same convention as signals.ts's updateSignal.
export async function setScenarioArchived(scenarioId: string, archived: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("scenarios").update({ is_archived: archived }).eq("id", scenarioId);
  if (error) throw error;
  revalidatePath("/canvas");
}

// PATCH .../scenarios/:id — Narrative page's manual Edit mode (Build Plan §9, Step 6). Plain
// field update, no AI. Always stamps narrative_edited_by_user:true — this is a human typing
// into the textarea, the exact case that flag exists to record — so a later "Expand with AI"
// run on this scenario knows to confirm before overwriting (expandNarrativeWithAI, in
// ai-narrative.ts, clears the flag again once the user has accepted an AI regeneration).
export async function updateScenarioNarrative(scenarioId: string, fields: { narrative?: string; summary?: string }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scenarios")
    .update({ ...fields, narrative_edited_by_user: true })
    .eq("id", scenarioId);
  if (error) throw error;
  revalidatePath("/narrative");
}
