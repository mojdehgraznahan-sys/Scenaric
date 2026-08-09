"use server";

// Strategic Options access — Build Plan §12 / SCHWARTZ_METHODOLOGY_SKILL.md's "+" row (tile 9
// of 9, the product's own extension — never one of Schwartz's 8 named steps). Options are
// AI-generated (src/lib/actions/ai-strategy.ts); plain reads + the "Mark as primary" mutation
// live here, same split as implications.ts/ai-implications.ts and indicators.ts/ai-indicators.ts.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NotFoundError } from "@/lib/ai/errors";
import type { Database } from "@/lib/supabase/types";

export type StrategicOptionRow = Database["public"]["Tables"]["strategic_options"]["Row"];
export type StrategyScenarioScoreRow = Database["public"]["Tables"]["strategy_scenario_scores"]["Row"];

export interface StrategicOptionWithScores extends StrategicOptionRow {
  scores: StrategyScenarioScoreRow[];
}

// GET .../projects/:id/strategy — every option for the project (AI- and manually-created
// alike), each with its 4 (or fewer, for a manually-created option not yet wind-tunnelled)
// per-scenario scores attached.
export async function listStrategicOptions(projectId: string): Promise<StrategicOptionWithScores[]> {
  const supabase = createClient();

  const { data: options, error: optionsError } = await supabase
    .from("strategic_options")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (optionsError) throw optionsError;
  if (options.length === 0) return [];

  const { data: scores, error: scoresError } = await supabase
    .from("strategy_scenario_scores")
    .select("*")
    .in(
      "strategy_id",
      options.map((o) => o.id)
    );
  if (scoresError) throw scoresError;

  const scoresByStrategyId = new Map<string, StrategyScenarioScoreRow[]>();
  for (const score of scores) {
    const list = scoresByStrategyId.get(score.strategy_id) ?? [];
    list.push(score);
    scoresByStrategyId.set(score.strategy_id, list);
  }

  return options.map((option) => ({ ...option, scores: scoresByStrategyId.get(option.id) ?? [] }));
}

// PATCH .../projects/:id/strategy/:optionId { is_primary } — "Mark as primary." Only one option
// may be primary per project; unsetting any prior primary and setting this one happens in a
// single transaction via the set_primary_strategic_option() DB function
// (0022_strategic_options.sql) rather than two sequential updates from here, since supabase-js
// has no multi-statement transaction API of its own.
export async function setPrimaryStrategicOption(projectId: string, optionId: string, isPrimary: boolean): Promise<StrategicOptionRow> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("set_primary_strategic_option", {
    p_project_id: projectId,
    p_option_id: optionId,
    p_is_primary: isPrimary,
  });
  // The function's only failure mode by design is "option not found in this project" (its own
  // `raise exception`) — RLS would otherwise just return zero rows silently, so any error here
  // is a genuine 404, not a 500.
  if (error) throw new NotFoundError(`Strategic option ${optionId} could not be found in project ${projectId}.`);

  revalidatePath("/strategy");
  return data;
}

// Backing action for ask-ai.tsx's "+ Add as option" confirm button (strategy chat mode,
// ai-strategy-chat.ts's suggested_option) — the one place a freeform Ask AI answer's
// external/inferred content can actually be written into the project, and only ever after this
// explicit user click, never automatically from the chat call itself. risk/cost are left null
// (unscored — this option hasn't been wind-tunnelled against the 4 scenarios yet); the
// suggestion's own rationale is folded into notes so the grounding it cited isn't lost, mirroring
// how ai-indicators.ts folds discriminates_from into indicators.note rather than adding a column
// for it.
export async function createManualStrategicOption(input: { projectId: string; name: string; notes?: string }): Promise<StrategicOptionRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strategic_options")
    .insert({ project_id: input.projectId, name: input.name, notes: input.notes ?? null, created_via: "manual" })
    .select()
    .single();
  if (error) throw error;

  revalidatePath("/strategy");
  return data;
}
