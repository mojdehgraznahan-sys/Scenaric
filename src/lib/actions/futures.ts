"use server";

// Futures + Event chains (design/futures_chains_handoff/) — plain CRUD, no AI (AI generation is
// ai-futures.ts). Same split as scenarios.ts/ai-scenarios.ts, storyline.ts/ai-storyline.ts
// elsewhere in this codebase.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { yearOptions } from "@/lib/scenarios/backcast";
import { attachLinks, type ChainEventResult } from "./ai-futures";

export interface FuturesScenario {
  id: string;
  name: string;
  tagline: string | null;
  color: string | null;
  quadrant: "TL" | "TR" | "BL" | "BR";
  xLabel: string;
  yLabel: string;
  xPole: string;
  yPole: string;
  postcard: { headline: string; story: string; day: string; us: string } | null;
  narrative: { story: string[]; life: [string, string][]; usUp: string[]; usDown: string[] } | null;
  desirability: number | null;
  stance: "want" | "live" | "avoid";
  earlySigns: string[];
}

export interface FuturesData {
  targetYear: number;
  yearOptions: number[];
  generated: boolean;
  chainScenarioId: string | null;
  focalQuestion: string;
  companyName: string;
  horizon: string;
  scenarios: FuturesScenario[];
}

export async function getFuturesData(projectId: string): Promise<FuturesData> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name, focal_question, refined_focal_question, horizon")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const { data: state } = await supabase
    .from("futures_state")
    .select("target_year, generated_at, chain_scenario_id")
    .eq("project_id", projectId)
    .maybeSingle();

  const startYear = new Date().getFullYear();
  const opts = yearOptions(project.horizon, startYear);
  const targetYear = state?.target_year && opts.includes(state.target_year) ? state.target_year : opts[0];

  const { data: scenarios, error: scenariosError } = await supabase
    .from("scenarios")
    .select("id, project_id, axes_id, quadrant, name, tagline, color")
    .eq("project_id", projectId)
    .eq("is_archived", false);
  if (scenariosError) throw scenariosError;

  const axesIds = Array.from(new Set(scenarios.map((s) => s.axes_id).filter((id): id is string => !!id)));
  const { data: axesRows } = axesIds.length > 0 ? await supabase.from("axes").select("*").in("id", axesIds) : { data: [] };
  const axisById = new Map((axesRows ?? []).map((a) => [a.id, a]));

  const signalIds = Array.from(new Set((axesRows ?? []).flatMap((a) => [a.x_signal_id, a.y_signal_id]).filter((id): id is string => !!id)));
  const { data: signalRows } = signalIds.length > 0 ? await supabase.from("signals").select("id, pole_a, pole_b").in("id", signalIds) : { data: [] };
  const signalById = new Map((signalRows ?? []).map((s) => [s.id, s]));

  const scenarioIds = scenarios.map((s) => s.id);
  const [{ data: postcards }, { data: narratives }, { data: ratings }, { data: earlySigns }] = await Promise.all([
    supabase.from("scenario_postcards").select("*").in("scenario_id", scenarioIds.length > 0 ? scenarioIds : [""]),
    supabase.from("scenario_narratives").select("*").in("scenario_id", scenarioIds.length > 0 ? scenarioIds : [""]),
    supabase.from("scenario_ratings").select("*").in("scenario_id", scenarioIds.length > 0 ? scenarioIds : [""]),
    supabase
      .from("scenario_early_signs")
      .select("scenario_id, sort, signals(title)")
      .in("scenario_id", scenarioIds.length > 0 ? scenarioIds : [""])
      .order("sort"),
  ]);
  const postcardByScenario = new Map((postcards ?? []).map((p) => [p.scenario_id, p]));
  const narrativeByScenario = new Map((narratives ?? []).map((n) => [n.scenario_id, n]));
  const ratingByScenario = new Map((ratings ?? []).map((r) => [r.scenario_id, r]));
  const earlySignsByScenario = new Map<string, string[]>();
  for (const row of earlySigns ?? []) {
    const title = (row as unknown as { signals: { title: string } | null }).signals?.title;
    if (!title) continue;
    const list = earlySignsByScenario.get(row.scenario_id) ?? [];
    list.push(title);
    earlySignsByScenario.set(row.scenario_id, list);
  }

  const result: FuturesScenario[] = scenarios.map((s) => {
    const axis = s.axes_id ? axisById.get(s.axes_id) : undefined;
    const xSignal = axis?.x_signal_id ? signalById.get(axis.x_signal_id) : undefined;
    const ySignal = axis?.y_signal_id ? signalById.get(axis.y_signal_id) : undefined;
    const xHi = s.quadrant === "TR" || s.quadrant === "BR";
    const yHi = s.quadrant === "TL" || s.quadrant === "TR";
    const postcard = postcardByScenario.get(s.id);
    const narrative = narrativeByScenario.get(s.id);
    const rating = ratingByScenario.get(s.id);
    return {
      id: s.id,
      name: s.name,
      tagline: s.tagline,
      color: s.color,
      quadrant: s.quadrant,
      xLabel: axis?.x_label ?? "",
      yLabel: axis?.y_label ?? "",
      xPole: xSignal ? (xHi ? xSignal.pole_b : xSignal.pole_a) ?? "" : "",
      yPole: ySignal ? (yHi ? ySignal.pole_b : ySignal.pole_a) ?? "" : "",
      postcard: postcard ? { headline: postcard.headline, story: postcard.story, day: postcard.day, us: postcard.us } : null,
      narrative: narrative ? { story: narrative.story as string[], life: narrative.life as [string, string][], usUp: narrative.us_up as string[], usDown: narrative.us_down as string[] } : null,
      desirability: rating?.desirability ?? null,
      stance: rating?.stance ?? "live",
      earlySigns: earlySignsByScenario.get(s.id) ?? [],
    };
  });

  return {
    targetYear,
    yearOptions: opts,
    generated: !!state?.generated_at,
    chainScenarioId: state?.chain_scenario_id ?? null,
    focalQuestion: project.refined_focal_question ?? project.focal_question,
    companyName: project.name,
    horizon: project.horizon,
    scenarios: result,
  };
}

export async function updateFuturesState(projectId: string, patch: { targetYear?: number; chainScenarioId?: string | null }): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("futures_state").upsert({
    project_id: projectId,
    ...(patch.targetYear !== undefined ? { target_year: patch.targetYear } : {}),
    ...(patch.chainScenarioId !== undefined ? { chain_scenario_id: patch.chainScenarioId } : {}),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/futures");
  revalidatePath("/chains");
}

export async function updatePostcard(
  scenarioId: string,
  patch: { headline: string; story: string; day: string; us: string }
): Promise<void> {
  const supabase = createClient();
  const { data: scenario, error: scenarioError } = await supabase.from("scenarios").select("project_id").eq("id", scenarioId).single();
  if (scenarioError) throw scenarioError;

  const { error } = await supabase.from("scenario_postcards").upsert({
    scenario_id: scenarioId,
    project_id: scenario.project_id,
    headline: patch.headline,
    story: patch.story,
    day: patch.day,
    us: patch.us,
    updated_by: "user",
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/futures");
}

// Reader only lets the user edit the story paragraphs (blank line splits them) — life/us_up/
// us_down stay as last generated, matching the handoff's edit UI exactly.
export async function updateNarrativeStory(scenarioId: string, story: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scenario_narratives")
    .update({ story, updated_by: "user", updated_at: new Date().toISOString() })
    .eq("scenario_id", scenarioId);
  if (error) throw error;
  revalidatePath("/futures");
}

export async function rateScenario(scenarioId: string, desirability: number): Promise<void> {
  const supabase = createClient();
  const { data: scenario, error: scenarioError } = await supabase.from("scenarios").select("project_id").eq("id", scenarioId).single();
  if (scenarioError) throw scenarioError;

  const { error } = await supabase.from("scenario_ratings").upsert({
    scenario_id: scenarioId,
    project_id: scenario.project_id,
    desirability,
    rated_at: new Date().toISOString(),
  });
  if (error) throw error;
  revalidatePath("/futures");
  revalidatePath("/chains");
}

export async function getChainEvents(scenarioId: string, targetYear: number): Promise<ChainEventResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("chain_events")
    .select("*")
    .eq("scenario_id", scenarioId)
    .eq("target_year", targetYear)
    .order("sort");
  if (error) throw error;
  return attachLinks(supabase, data);
}

// Single mutation entry point for every chain edit (drag/insert/remove/link/edit/rate) —
// always resends the whole chain for (scenario, target_year) in sequence order; save_chain
// (0053_storyline_chain_merge.sql) upserts by id so ids and links survive a save, and
// resolves each event's `links` (real ids, from this array) into 0-based array indices for
// the wire call — a brand-new, not-yet-saved event has no real id yet, so index-based
// reference is the only thing that works for it. New events carry a client-generated
// "new-…" id (never sent as `id` in the payload, so the server creates a real one). Each
// event carries its own createdBy through the round-trip — rating L/I on an AI-written event
// must not relabel its title/why as user-authored.
export async function saveChainEvents(
  scenarioId: string,
  startYear: number,
  targetYear: number,
  events: ChainEventResult[]
): Promise<ChainEventResult[]> {
  const supabase = createClient();
  const idToIndex = new Map(events.map((e, i) => [e.id, i]));

  const { data: rows, error } = await supabase.rpc("save_chain", {
    p_scenario: scenarioId,
    p_start_year: startYear,
    p_target_year: targetYear,
    p_events: events.map((e) => ({
      ...(e.id.startsWith("new-") ? {} : { id: e.id }),
      year: e.year,
      title: e.title,
      why: e.why,
      analog: e.analog,
      forces: e.forces,
      indicator: e.indicator,
      threshold: e.threshold,
      influence: e.influence,
      likelihood: e.likelihood,
      impact: e.impact,
      created_by: e.createdBy,
      links: e.links.map((id) => idToIndex.get(id)).filter((i): i is number => i != null),
    })),
  });
  if (error) throw error;
  revalidatePath("/storyline");
  return attachLinks(supabase, rows);
}
