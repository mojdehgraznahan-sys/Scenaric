"use server";

// Strategy's "Suggest more" initiatives (design/strategy_handoff's Prompt 5 suggest-initiatives)
// — grounded in the target's own supporting events (lever/level/change), blockers, existing
// initiatives (to dedupe), and recent Knowledge Base insights (evidence pool). Review lifecycle
// matches action_cards/discovered_events: inserted immediately as a pending (status null) row,
// reviewed in place via setInitiativeStatus — see initiatives.ts's own header comment and this
// session's discussion of why that pattern fits here, not Draft Route's or Storyline's.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { fetchTrackedEvents, toTrackedEvent, type HistoryEntry } from "@/lib/decision-tracking";
import { levers, windowPoints, LIKELIHOOD_LEVELS, type StorylinePhase, type TrackedEvent } from "@/lib/decision-model";

const InitiativeOutputSchema = z.object({
  initiatives: z
    .array(
      z.object({
        kind: z.enum(["shape", "influence", "research", "hedge"]),
        title: z.string(),
        why: z.string(),
        question: z.string().nullable(),
        informs: z.string().nullable(),
        force_label: z.string().nullable(),
        pole_label: z.string().nullable(),
        owner: z.string().nullable(),
        cost: z.string().nullable(),
        time_label: z.string().nullable(),
        early_sign: z.string(),
        stop_if: z.string(),
        wind: z.record(z.string(), z.enum(["helps", "neutral", "hurts"])),
        evidence: z.array(z.object({ source: z.string(), cite: z.string() })).min(1),
        targets: z
          .array(z.object({ event_id: z.string().nullable(), title: z.string().nullable(), control: z.enum(["shape", "influence", "watch"]) }))
          .min(1),
      })
    )
    .max(3),
});

const SUGGEST_INITIATIVES_TASK_PROMPT = `Task: Propose 1-3 NEW strategic initiatives toward the given target scenario — projects or
research the org could launch. Each one either makes a supporting event more likely (shape/
influence), investigates a watch-only event before committing (research), or protects against a
blocker (hedge).

Input: { target_scenario_name: string, scenario_ids: string[],
  shape_events / influence_events / watch_events / blocker_events:
    [{ id, title, phase, current_level, change: {date, source, cite} | null }],
  existing_initiatives: [{ title, force_label }],   // do NOT propose a close duplicate of any of these
  evidence_pool: [{ source, cite }] }                // the ONLY material you may cite as evidence

Rules:
- kind must match the lever of your initiative's PRIMARY target (targets[0]): a shape_events
  target -> kind "shape"; an influence_events target -> kind "influence"; a watch_events target
  -> kind "research" or "hedge" (your choice); a blocker_events target -> kind "hedge".
- wind must have exactly one entry per id in scenario_ids, each "helps"/"neutral"/"hurts" —
  never omit a scenario.
- evidence must have at least one entry, and every cite must be a VERBATIM substring of one
  evidence_pool entry's own cite (copy it exactly, don't paraphrase) — never invent a quote.
- kind "research" requires both question and informs (non-empty). Every kind requires
  early_sign and stop_if that are concrete and checkable (a number, a date, or a named event),
  not vague aspirations.
- targets[0].event_id (or targets[0].title, if there is no real event yet — e.g. a KB-sourced
  claim with no tracked event) must come from the candidate lists above or be freeform text;
  never invent an event id.
- If every meaningful initiative for this target already exists in existing_initiatives, return
  an empty initiatives array rather than inventing a weak one.

Output schema: { initiatives: [{ kind, title, why, question, informs, force_label, pole_label,
  owner, cost, time_label, early_sign, stop_if, wind, evidence, targets: [{event_id, title, control}] }] }`;

interface CandidateContext {
  id: string;
  title: string;
  phase: StorylinePhase;
  current_level: string;
  change: { date: string; source: string; cite: string } | null;
}

function latestHistoryEntry(history: HistoryEntry[]): HistoryEntry | undefined {
  return [...history].sort((a, b) => b.observedAt.localeCompare(a.observedAt))[0];
}

export async function suggestInitiatives(projectId: string, scenarioId: string): Promise<{ added: number }> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase.from("scenarios").select("id, name").eq("id", scenarioId).eq("project_id", projectId).single();
  if (scenarioError) throw scenarioError;

  const { data: allScenarios, error: scenariosError } = await supabase.from("scenarios").select("id").eq("project_id", projectId).eq("is_archived", false);
  if (scenariosError) throw scenariosError;
  const scenarioIds = allScenarios.map((s) => s.id);

  const trackedRows = await fetchTrackedEvents(supabase, projectId);
  const points = windowPoints();
  const tracked: TrackedEvent[] = trackedRows.map((row) => toTrackedEvent(row, points));
  const lev = levers(scenarioId, tracked);
  const titleById = new Map(trackedRows.map((row) => [row.eventId, row.title]));
  const historyById = new Map(trackedRows.map((row) => [row.eventId, row.history]));

  const toCandidateContext = (t: TrackedEvent): CandidateContext => {
    const history = historyById.get(t.eventId) ?? [];
    const latest = latestHistoryEntry(history);
    return {
      id: t.eventId,
      title: titleById.get(t.eventId) ?? "an untitled event",
      phase: t.phase,
      current_level: LIKELIHOOD_LEVELS[t.hist[t.hist.length - 1]],
      change: latest?.cite ? { date: latest.observedAt.slice(0, 10), source: latest.sourceTitle ?? "Unknown source", cite: latest.cite } : null,
    };
  };

  const { data: existing, error: existingError } = await supabase.from("initiatives").select("title, force_label").eq("project_id", projectId);
  if (existingError) throw existingError;

  // Evidence pool: each supporting/blocking event's own latest cite, plus recent KB insights —
  // the only material the model is allowed to quote from (verbatim-substring checked below).
  const { data: insightRows, error: insightsError } = await supabase
    .from("insights")
    .select("text, quote, source_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (insightsError) throw insightsError;
  const sourceIds = Array.from(new Set(insightRows.map((i) => i.source_id).filter((id): id is string => !!id)));
  const { data: sourceRows, error: sourcesError } = sourceIds.length
    ? await supabase.from("sources").select("id, name").in("id", sourceIds)
    : { data: [] as { id: string; name: string }[], error: null };
  if (sourcesError) throw sourcesError;
  const sourceNameById = new Map(sourceRows.map((s) => [s.id, s.name]));

  const evidencePool = [
    ...tracked
      .map((t) => latestHistoryEntry(historyById.get(t.eventId) ?? []))
      .filter((latest): latest is HistoryEntry => !!latest?.cite)
      .map((latest) => ({ source: latest.sourceTitle ?? "Unknown source", cite: latest.cite! })),
    ...insightRows
      .filter((i) => i.quote || i.text)
      .map((i) => ({ source: i.source_id ? sourceNameById.get(i.source_id) ?? "Knowledge Base" : "Knowledge Base", cite: (i.quote || i.text)! })),
  ];

  const input = {
    target_scenario_name: scenario.name,
    scenario_ids: scenarioIds,
    shape_events: lev.shape.map(toCandidateContext),
    influence_events: lev.influence.map(toCandidateContext),
    watch_events: lev.watch.map(toCandidateContext),
    blocker_events: lev.block.map(toCandidateContext),
    existing_initiatives: existing.map((e) => ({ title: e.title, force_label: e.force_label })),
    evidence_pool: evidencePool,
  };

  const leverByEventId = new Map<string, "shape" | "influence" | "watch">([
    ...lev.shape.map((t): [string, "shape"] => [t.eventId, "shape"]),
    ...lev.influence.map((t): [string, "influence"] => [t.eventId, "influence"]),
    ...lev.watch.map((t): [string, "watch"] => [t.eventId, "watch"]),
  ]);
  const knownEventIds = new Set([...lev.shape, ...lev.influence, ...lev.watch, ...lev.block].map((t) => t.eventId));
  const evidenceCites = evidencePool.map((e) => e.cite.toLowerCase());

  const validate = (candidate: z.infer<typeof InitiativeOutputSchema>["initiatives"][number]): boolean => {
    if (Object.keys(candidate.wind).length !== scenarioIds.length || !scenarioIds.every((id) => id in candidate.wind)) return false;
    if (candidate.evidence.length === 0) return false;
    if (!candidate.evidence.every((e) => evidenceCites.some((pool) => pool.includes(e.cite.toLowerCase())))) return false;
    if (candidate.kind === "research" && (!candidate.question?.trim() || !candidate.informs?.trim())) return false;
    if (!candidate.early_sign.trim() || !candidate.stop_if.trim()) return false;
    const primary = candidate.targets[0];
    if (primary.event_id) {
      if (!knownEventIds.has(primary.event_id)) return false;
      const primaryLever = leverByEventId.get(primary.event_id);
      if (primaryLever === "shape" && candidate.kind !== "shape") return false;
      if (primaryLever === "influence" && candidate.kind !== "influence") return false;
      if (primaryLever === "watch" && candidate.kind !== "research" && candidate.kind !== "hedge") return false;
    }
    return true;
  };

  const generate = async (retryNote?: string) =>
    runStructured({
      step: "strategy.suggest_initiatives",
      projectId,
      taskPrompt: retryNote ? `${SUGGEST_INITIATIVES_TASK_PROMPT}\n\n${retryNote}` : SUGGEST_INITIATIVES_TASK_PROMPT,
      input,
      schema: InitiativeOutputSchema,
      effort: "medium",
      thinking: false,
    });

  let output = await generate();
  let valid = output.initiatives.filter(validate);
  if (valid.length === 0 && output.initiatives.length > 0) {
    // "Reject and retry once" (handoff's own hard-requirement instruction) — only worth a
    // second call when the model actually tried and failed validation, not when it correctly
    // found nothing new to propose.
    output = await generate("Your previous attempt violated one of the hard requirements above (wind coverage, evidence grounding, kind-vs-lever match, or research question/informs) — follow them exactly this time.");
    valid = output.initiatives.filter(validate);
  }

  if (valid.length === 0) return { added: 0 };

  for (const candidate of valid) {
    const { data: inserted, error: insertError } = await supabase
      .from("initiatives")
      .insert({
        project_id: projectId,
        kind: candidate.kind,
        title: candidate.title,
        why: candidate.why,
        question: candidate.question,
        informs: candidate.informs,
        force_label: candidate.force_label,
        pole_label: candidate.pole_label,
        owner: candidate.owner,
        cost: candidate.cost,
        time_label: candidate.time_label,
        early_sign: candidate.early_sign,
        stop_if: candidate.stop_if,
        wind: candidate.wind,
        evidence: candidate.evidence,
        created_by: "ai",
        status: null,
      })
      .select("id")
      .single();
    if (insertError) throw insertError;

    await supabase.from("initiative_targets").insert(
      candidate.targets.map((t) => ({
        project_id: projectId,
        initiative_id: inserted.id,
        event_id: t.event_id,
        title: t.title,
        // Server-known lever overrides the model's own guess for any real event — the
        // candidate pools above are the authoritative source, not something worth trusting
        // the model to reproduce correctly for a value it already had to read from them.
        control: (t.event_id && leverByEventId.get(t.event_id)) || t.control,
      }))
    );
  }

  return { added: valid.length };
}
