"use server";

// Futures + Event chains (design/futures_chains_handoff/) — the AI generation behind the two
// new scenario pages. The handoff originally specced these as Supabase Edge Functions
// (generate-postcard/generate-narrative/generate-chain/generate-futures); this app has no Edge
// Functions at all — every AI call is a server action through runStructured (src/lib/ai/client.ts),
// so these follow that exact convention instead. The prompt text in bc2AiPostcard/bc2AiNarrative/
// bc2AiChain (design/futures_chains_handoff/components/bc2-futures.jsx, bc2-narrative.jsx,
// bc2-chains.jsx) is the spec for instructions and JSON shape — kept, with real Knowledge Base
// grounding added on top. PERSONA_SCENARIO_STORYTELLER (Schwartz Step 6) fits all three: a
// postcard/narrative is the story, a chain is "a credible causal path from today to the
// endpoint" in a different form — same persona, same step.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { PERSONA_SCENARIO_STORYTELLER } from "@/lib/ai/personas";
import { createClient } from "@/lib/supabase/server";
import { chainSize, spread, yearOptions, MAX_PER_YEAR } from "@/lib/scenarios/backcast";
import type { Database } from "@/lib/supabase/types";

type ScenarioRow = Database["public"]["Tables"]["scenarios"]["Row"];

interface ScenarioContext {
  scenario: ScenarioRow;
  project: { name: string; focalQuestion: string; horizon: string };
  xLabel: string;
  yLabel: string;
  xPole: string;
  yPole: string;
}

// Every generate-* call needs this scenario's real axis-pole wording. No pole-label column
// exists on scenarios/axes — poles live on signals.pole_a/pole_b (0038_signal_poles_and_event_side.sql)
// and are normally resolved client-side by matrix/axis-data.ts's axisMeta() before a build-time
// action call; there's no such upstream modal step here, so it's resolved server-side, same
// mapping axisMeta() uses (pos = pole_b, neg = pole_a), derived from the quadrant enum itself:
// TL={x:lo,y:hi}, TR={x:hi,y:hi}, BL={x:lo,y:lo}, BR={x:hi,y:lo} — the same assignment
// buildScenarios (ai-scenarios.ts) used to write the quadrant in the first place.
async function loadScenarioContext(scenarioId: string): Promise<ScenarioContext> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase.from("scenarios").select("*").eq("id", scenarioId).single();
  if (scenarioError) throw scenarioError;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name, focal_question, refined_focal_question, horizon")
    .eq("id", scenario.project_id)
    .single();
  if (projectError) throw projectError;

  let xLabel = "";
  let yLabel = "";
  let xSignalId: string | null = null;
  let ySignalId: string | null = null;
  if (scenario.axes_id) {
    const { data: axis, error: axisError } = await supabase
      .from("axes")
      .select("x_label, y_label, x_signal_id, y_signal_id")
      .eq("id", scenario.axes_id)
      .maybeSingle();
    if (axisError) throw axisError;
    if (axis) {
      xLabel = axis.x_label ?? "";
      yLabel = axis.y_label ?? "";
      xSignalId = axis.x_signal_id;
      ySignalId = axis.y_signal_id;
    }
  }

  const signalIds = [xSignalId, ySignalId].filter((id): id is string => !!id);
  let axisSignals: { id: string; pole_a: string | null; pole_b: string | null }[] = [];
  if (signalIds.length > 0) {
    const { data, error } = await supabase.from("signals").select("id, pole_a, pole_b").in("id", signalIds);
    if (error) throw error;
    axisSignals = data;
  }
  const signalById = new Map(axisSignals.map((s) => [s.id, s]));

  const xHi = scenario.quadrant === "TR" || scenario.quadrant === "BR";
  const yHi = scenario.quadrant === "TL" || scenario.quadrant === "TR";
  const xSignal = xSignalId ? signalById.get(xSignalId) : undefined;
  const ySignal = ySignalId ? signalById.get(ySignalId) : undefined;
  const xPole = xSignal ? (xHi ? xSignal.pole_b : xSignal.pole_a) ?? "" : "";
  const yPole = ySignal ? (yHi ? ySignal.pole_b : ySignal.pole_a) ?? "" : "";

  return {
    scenario,
    project: { name: project.name, focalQuestion: project.refined_focal_question ?? project.focal_question, horizon: project.horizon },
    xLabel,
    yLabel,
    xPole,
    yPole,
  };
}

// ─────────────────────── Postcard + narrative ───────────────────────

const PostcardSchema = z.object({
  headline: z.string(),
  story: z.string(),
  day: z.string(),
  us: z.string(),
});

const POSTCARD_TASK_PROMPT = `${PERSONA_SCENARIO_STORYTELLER}

Task: Write a short "postcard from the future" for this scenario — the first thing a reader
sees before opening its full narrative.

Input: { focal_question: string, company: string, target_year: number,
  scenario: { name: string, tagline: string, x_label: string, x_pole: string,
              y_label: string, y_pole: string } }

Rules:
- Write from inside target_year, present tense, plain concrete language, no hype — never
  invent a statistic or named entity beyond what's implied by the scenario given.
- Use the literal token {Y} wherever the year would appear in prose — never write the actual
  year number yourself.
- headline: max 7 words.
- story: 3-4 sentences, starting with "It is {Y}."
- day: one sentence — a concrete moment in someone's working day that makes this scenario
  tangible.
- us: one sentence — where company stands in this future.

Output schema: { headline: string, story: string, day: string, us: string }`;

const NarrativeSchema = z.object({
  story: z.array(z.string()).length(3),
  life: z.array(z.tuple([z.string(), z.string()])).length(3),
  us_up: z.array(z.string()).length(2),
  us_down: z.array(z.string()).length(2),
});

const NARRATIVE_TASK_PROMPT = `${PERSONA_SCENARIO_STORYTELLER}

Task: Write the full narrative behind this scenario's postcard — the world now, how it
happened, and what decides who wins.

Input: { focal_question: string, company: string, target_year: number,
  scenario: { name: string, tagline: string, x_label: string, x_pole: string,
              y_label: string, y_pole: string }, postcard_headline: string }

Rules:
- Write from inside target_year: past tense for how we got here, present tense for now. Plain
  concrete language, no hype — never invent a statistic or named entity beyond what's implied
  by the scenario given.
- Use the literal token {Y} wherever the year would appear in prose — never resolve it
  yourself.
- story: exactly 3 paragraphs, 3-4 sentences each — the world now, how it happened, what
  decides winners.
- life: exactly 3 entries, in this order: ["Customers", one sentence], ["Competitors", one
  sentence], ["Regulators", one sentence].
- us_up: exactly 2 short opportunities for company in this future.
- us_down: exactly 2 short threats for company in this future.

Output schema: { story: string[3], life: [string,string][3], us_up: string[2], us_down: string[2] }`;

export interface PostcardResult {
  headline: string;
  story: string;
  day: string;
  us: string;
}

export interface NarrativeResult {
  story: string[];
  life: [string, string][];
  usUp: string[];
  usDown: string[];
}

async function callNarrativeAi(ctx: ScenarioContext, targetYear: number, postcardHeadline: string): Promise<NarrativeResult> {
  const output = await runStructured({
    step: "futures.generate_narrative",
    projectId: ctx.scenario.project_id,
    taskPrompt: NARRATIVE_TASK_PROMPT,
    input: {
      focal_question: ctx.project.focalQuestion,
      company: ctx.project.name,
      target_year: targetYear,
      scenario: { name: ctx.scenario.name, tagline: ctx.scenario.tagline, x_label: ctx.xLabel, x_pole: ctx.xPole, y_label: ctx.yLabel, y_pole: ctx.yPole },
      postcard_headline: postcardHeadline,
    },
    schema: NarrativeSchema,
    effort: "high",
    thinking: true,
  });
  return { story: output.story, life: output.life, usUp: output.us_up, usDown: output.us_down };
}

// ─────────────────────── Early signs ───────────────────────

const EarlySignsSchema = z.object({ signal_ids: z.array(z.string()).max(3) });

const EARLY_SIGNS_TASK_PROMPT = `${PERSONA_SCENARIO_STORYTELLER}

Task: Pick up to 3 of this project's OWN existing signals that most concretely foreshadow this
scenario happening — the "early signs, today" a reader would watch for before the full future
unfolds. Never invent a signal; choose only from candidate_signals.

Input: { scenario: { name: string, tagline: string, x_pole: string, y_pole: string },
  candidate_signals: [{ id: string, title: string, pole_a: string, pole_b: string,
                         category: string }] }

Rules:
- Pick signals whose own pole wording or body most plausibly leans toward this scenario's two
  poles (x_pole, y_pole) — not just topically related ones.
- Return fewer than 3 ids if fewer than 3 genuinely fit; never pad with a weak match.
- Every id must come from candidate_signals — never invent one.

Output schema: { signal_ids: string[] } (0-3 items)`;

// Never trusts the model's ids blindly — same discipline as ai-signals.ts's suggestSignals:
// drop any id that isn't actually in the candidate set handed to it.
async function pickEarlySigns(ctx: ScenarioContext): Promise<void> {
  const supabase = createClient();

  const { data: candidates, error } = await supabase
    .from("signals")
    .select("id, title, pole_a, pole_b, category")
    .eq("project_id", ctx.scenario.project_id);
  if (error) throw error;
  if (candidates.length === 0) return;

  const output = await runStructured({
    step: "futures.pick_early_signs",
    projectId: ctx.scenario.project_id,
    taskPrompt: EARLY_SIGNS_TASK_PROMPT,
    input: {
      scenario: { name: ctx.scenario.name, tagline: ctx.scenario.tagline, x_pole: ctx.xPole, y_pole: ctx.yPole },
      candidate_signals: candidates.map((c) => ({ id: c.id, title: c.title, pole_a: c.pole_a, pole_b: c.pole_b, category: c.category })),
    },
    schema: EarlySignsSchema,
    effort: "low",
    thinking: false,
  });

  const validIds = new Set(candidates.map((c) => c.id));
  const picked = output.signal_ids.filter((id) => validIds.has(id)).slice(0, 3);

  const { error: deleteError } = await supabase.from("scenario_early_signs").delete().eq("scenario_id", ctx.scenario.id);
  if (deleteError) throw deleteError;
  if (picked.length > 0) {
    const { error: insertError } = await supabase
      .from("scenario_early_signs")
      .insert(picked.map((signalId, i) => ({ scenario_id: ctx.scenario.id, signal_id: signalId, project_id: ctx.scenario.project_id, sort: i })));
    if (insertError) throw insertError;
  }
}

// Draft a postcard, then its narrative in the same call (regenerating a postcard regenerates
// its narrative too, same rule as the handoff), then refresh its early signs.
export async function generatePostcard(scenarioId: string, targetYear: number): Promise<{ postcard: PostcardResult; narrative: NarrativeResult }> {
  const supabase = createClient();
  const ctx = await loadScenarioContext(scenarioId);

  const postcard = await runStructured({
    step: "futures.generate_postcard",
    projectId: ctx.scenario.project_id,
    taskPrompt: POSTCARD_TASK_PROMPT,
    input: {
      focal_question: ctx.project.focalQuestion,
      company: ctx.project.name,
      target_year: targetYear,
      scenario: { name: ctx.scenario.name, tagline: ctx.scenario.tagline, x_label: ctx.xLabel, x_pole: ctx.xPole, y_label: ctx.yLabel, y_pole: ctx.yPole },
    },
    schema: PostcardSchema,
    effort: "medium",
    thinking: true,
  });

  const nowIso = new Date().toISOString();
  const { error: postcardError } = await supabase.from("scenario_postcards").upsert({
    scenario_id: scenarioId,
    project_id: ctx.scenario.project_id,
    headline: postcard.headline,
    story: postcard.story,
    day: postcard.day,
    us: postcard.us,
    updated_by: "ai",
    updated_at: nowIso,
  });
  if (postcardError) throw postcardError;

  const narrative = await callNarrativeAi(ctx, targetYear, postcard.headline);
  const { error: narrativeError } = await supabase.from("scenario_narratives").upsert({
    scenario_id: scenarioId,
    project_id: ctx.scenario.project_id,
    story: narrative.story,
    life: narrative.life,
    us_up: narrative.usUp,
    us_down: narrative.usDown,
    postcard_headline: postcard.headline,
    updated_by: "ai",
    updated_at: nowIso,
  });
  if (narrativeError) throw narrativeError;

  await pickEarlySigns(ctx);

  revalidatePath("/futures");
  return { postcard, narrative };
}

// Reader's standalone "Regenerate" — narrative only, postcard untouched (handoff rule).
export async function generateNarrative(scenarioId: string, targetYear: number): Promise<NarrativeResult> {
  const supabase = createClient();
  const ctx = await loadScenarioContext(scenarioId);

  const { data: postcard, error: postcardError } = await supabase
    .from("scenario_postcards")
    .select("headline")
    .eq("scenario_id", scenarioId)
    .maybeSingle();
  if (postcardError) throw postcardError;
  const headline = postcard?.headline ?? ctx.scenario.name;

  const narrative = await callNarrativeAi(ctx, targetYear, headline);
  const { error } = await supabase.from("scenario_narratives").upsert({
    scenario_id: scenarioId,
    project_id: ctx.scenario.project_id,
    story: narrative.story,
    life: narrative.life,
    us_up: narrative.usUp,
    us_down: narrative.usDown,
    postcard_headline: headline,
    updated_by: "ai",
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;

  revalidatePath("/futures");
  return narrative;
}

// ─────────────────────── Event chain ───────────────────────

const ChainEventSchema = z.object({
  year: z.number(),
  title: z.string(),
  why: z.string(),
  analog: z.string().min(1),
  forces: z.array(z.string()).max(2),
  indicator: z.string(),
  threshold: z.string(),
  influence: z.enum(["high", "some", "none"]),
});
const ChainSchema = z.object({ events: z.array(ChainEventSchema) });

const CHAIN_TASK_PROMPT = `${PERSONA_SCENARIO_STORYTELLER}

Task: Backcast — walk from this scenario's end state back to today through a chain of
causally-linked events. Each event must make the next one possible; the last one produces the
end state. Before writing, look for precedents in other industries and regions (telecoms,
autos, pharma, payments, cloud, mining, energy, and the like) where a similar shift already
happened, and use them to make each step plausible and concrete.

Input: { focal_question: string, start_year: number, target_year: number, event_count: number,
  scenario: { name: string, end_state_story: string } }

Rules:
- Produce exactly event_count events.
- Years must be between start_year+1 and target_year inclusive, earliest first, no more than
  ${MAX_PER_YEAR} events in any single year.
- Each event's why explains why it had to happen before the next one in the chain — not a
  restatement of the title.
- analog: one sentence naming a REAL precedent from another industry or region — never vague
  ("this has happened before") and never invented; if you can't name a specific real one,
  choose a different event instead.
- forces: 1-2 short driving-force labels per event.
- influence: can a mid-size company realistically move this event? "high"|"some"|"none".
- Never invent a named entity, statistic, or date not implied by scenario.end_state_story.

Output schema: { events: [{ year: number, title: string, why: string, analog: string,
  forces: string[1-2], indicator: string, threshold: string, influence: "high"|"some"|"none" }] }
  (exactly event_count items)`;

export interface ChainEventResult {
  id: string;
  year: number;
  sort: number;
  title: string;
  why: string;
  analog: string;
  forces: string[];
  indicator: string;
  threshold: string;
  influence: "high" | "some" | "none";
  likelihood: number | null;
  impact: number | null;
  createdBy: "ai" | "user";
  links: string[];
}

// Shared by generateChain and futures.ts's getChainEvents/saveChainEvents — chain_event_links
// isn't part of chain_events' own row shape (save_chain returns setof chain_events only), so
// every read path attaches each event's outgoing links from a separate query.
type RawChainEventRow = Database["public"]["Tables"]["chain_events"]["Row"];

export async function attachLinks(supabase: ReturnType<typeof createClient>, rows: RawChainEventRow[]): Promise<ChainEventResult[]> {
  const ids = rows.map((r) => r.id);
  let linkRows: { from_event_id: string; to_event_id: string }[] = [];
  if (ids.length > 0) {
    const { data, error } = await supabase.from("chain_event_links").select("from_event_id, to_event_id").in("from_event_id", ids);
    if (error) throw error;
    linkRows = data;
  }
  const linksByFrom = new Map<string, string[]>();
  for (const l of linkRows) {
    linksByFrom.set(l.from_event_id, [...(linksByFrom.get(l.from_event_id) ?? []), l.to_event_id]);
  }
  return rows
    .slice()
    .sort((a, b) => a.year - b.year || a.sort - b.sort)
    .map((r) => ({
      id: r.id,
      year: r.year,
      sort: r.sort,
      title: r.title,
      why: r.why ?? "",
      analog: r.analog ?? "",
      forces: r.forces,
      indicator: r.indicator ?? "",
      threshold: r.threshold ?? "",
      influence: r.influence,
      likelihood: r.likelihood,
      impact: r.impact,
      createdBy: r.created_by,
      links: linksByFrom.get(r.id) ?? [],
    }));
}

export async function generateChain(scenarioId: string, targetYear: number): Promise<ChainEventResult[]> {
  const supabase = createClient();
  const ctx = await loadScenarioContext(scenarioId);
  const startYear = new Date().getFullYear();
  const eventCount = chainSize(targetYear - startYear);

  const { data: postcard } = await supabase.from("scenario_postcards").select("story").eq("scenario_id", scenarioId).maybeSingle();

  const output = await runStructured({
    step: "futures.generate_chain",
    projectId: ctx.scenario.project_id,
    taskPrompt: CHAIN_TASK_PROMPT,
    input: {
      focal_question: ctx.project.focalQuestion,
      start_year: startYear,
      target_year: targetYear,
      event_count: eventCount,
      scenario: { name: ctx.scenario.name, end_state_story: postcard?.story ?? ctx.scenario.summary ?? "" },
    },
    schema: ChainSchema,
    effort: "high",
    thinking: true,
  });

  let events = output.events
    .slice(0, eventCount)
    .map((e) => ({ ...e, year: Math.max(startYear + 1, Math.min(targetYear, Math.round(e.year))) }))
    .sort((a, b) => a.year - b.year);

  const counts = new Map<number, number>();
  events.forEach((e) => counts.set(e.year, (counts.get(e.year) ?? 0) + 1));
  if (Array.from(counts.values()).some((c) => c > MAX_PER_YEAR)) {
    events = spread(events, startYear, targetYear);
  }

  // No `id` or `links` on a freshly-generated chain — every event is new, and links are a
  // user-editing feature, not something the model proposes.
  const { data: rows, error } = await supabase.rpc("save_chain", {
    p_scenario: scenarioId,
    p_start_year: startYear,
    p_target_year: targetYear,
    p_events: events.map((e) => ({
      year: e.year,
      title: e.title,
      why: e.why,
      analog: e.analog,
      forces: e.forces,
      indicator: e.indicator,
      threshold: e.threshold,
      influence: e.influence,
      created_by: "ai",
      links: [],
    })),
  });
  if (error) throw error;

  revalidatePath("/storyline");
  return attachLinks(supabase, rows);
}

// ─────────────────────── Orchestrator ───────────────────────

export async function generateFutures(projectId: string): Promise<{ targetYear: number }> {
  const supabase = createClient();

  const { data: project, error: projectError } = await supabase.from("projects").select("horizon").eq("id", projectId).single();
  if (projectError) throw projectError;

  const { data: state } = await supabase.from("futures_state").select("target_year").eq("project_id", projectId).maybeSingle();
  const startYear = new Date().getFullYear();
  const targetYear = state?.target_year ?? yearOptions(project.horizon, startYear)[0];

  const { data: scenarios, error: scenariosError } = await supabase
    .from("scenarios")
    .select("id")
    .eq("project_id", projectId)
    .eq("is_archived", false);
  if (scenariosError) throw scenariosError;

  await Promise.all(scenarios.map((s) => generatePostcard(s.id, targetYear)));

  const { error: upsertError } = await supabase
    .from("futures_state")
    .upsert({ project_id: projectId, target_year: targetYear, generated_at: new Date().toISOString() });
  if (upsertError) throw upsertError;

  revalidatePath("/futures");
  return { targetYear };
}
