"use server";

// Suggest events to monitor — the direct successor to ai-indicators.ts's
// generateIndicatorsForScenario, porting its one genuinely valuable rule (discriminate from
// sibling scenarios) but SELECTING from the project's existing events instead of inventing a
// new Indicator entity. Same "never invent, only rank" discipline as ai-storyline.ts's
// findEventForGap — nothing is written here; the caller (Narrative's picker, or Monitoring's
// Ask-AI "suggest" task) confirms via event-monitoring.ts's addEventToMonitoring.
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { StorylineScenarioNotFoundError } from "@/lib/ai/errors";
import { z } from "zod";
import { listImplications } from "./implications";

const SuggestEventsSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  candidates: z
    .array(
      z.object({
        // A real event id from candidate_events — never invented. Validated server-side
        // against the real candidate id set before returning, same defense-in-depth pattern
        // as ai-storyline.ts's signal_id/event_id cross-check.
        event_id: z.string(),
        // Sibling scenario names the model confirms this candidate would NOT equally signal —
        // shown to the user alongside the rationale, same transparency ai-indicators.ts's
        // discriminates_from gave.
        discriminates_from: z.array(z.string()),
        rationale: z.string(),
      })
    )
    .max(5),
});

const SUGGEST_EVENTS_TASK_PROMPT = `Task: Pick which of this project's existing, untracked
events are worth monitoring for ONE scenario — concrete, externally observable occurrences that
would tell an analyst this scenario is the one unfolding, distinguishable from the OTHER
scenarios sharing this project's axes. You are SELECTING from candidate_events below — never
invent an event or describe one that isn't in the list.

Input: { scenario: {name: string, logic: string | null},
         implications: [{text: string, category: string | null}] /* Step 7's "what this
         scenario means for the decision" — use only to judge decision-relevance, never a
         reason to select an event not otherwise a good discriminating fit */,
         sibling_scenarios: [{name: string, tagline: string | null}] /* the other scenarios
         sharing this axes set, for discriminating power */,
         candidate_events: [{id: string, title: string, body: string | null, category: string,
         status: "observed"|"possible", likelihood: "Low"|"Medium"|"High"|null}] }

Rules:
- Only select from candidate_events. Reject (do not output) any candidate that would equally
  well signal one of sibling_scenarios — events worth monitoring must discriminate. List the
  sibling scenario names you confirmed it does NOT equally apply to in discriminates_from.
- rationale is one sentence: why watching this event specifically would tell you this scenario
  is the one unfolding.
- Rank best-fit first. Return at most 5 candidates.
- If nothing in candidate_events plausibly discriminates for this scenario, return
  sufficient_evidence:false and an empty candidates array — do not force a weak match just to
  return something.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  candidates: [{ event_id: string, discriminates_from: string[], rationale: string }] }`;

export interface SuggestEventCandidate {
  eventId: string;
  title: string;
  discriminatesFrom: string[];
  rationale: string;
}

export interface SuggestEventsToMonitorResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  candidates: SuggestEventCandidate[];
}

export async function suggestEventsToMonitor(scenarioId: string): Promise<SuggestEventsToMonitorResult> {
  const supabase = createClient();

  const { data: scenario, error: scenarioError } = await supabase
    .from("scenarios")
    .select("id, project_id, axes_id, name, logic")
    .eq("id", scenarioId)
    .single();
  if (scenarioError) throw new StorylineScenarioNotFoundError(scenarioId, scenarioError);

  // Sibling scenarios share this project's currently-active axes row — same convention
  // ai-indicators.ts/ai-grounding.ts's own signpost-discrimination half already uses.
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

  // Step 7 enrichment only — makes selection more decision-relevant. Never a grounding source
  // itself; event_id must still always be a real candidate_events id.
  const implications = await listImplications(scenarioId);

  const { data: alreadyMonitored, error: monitoredError } = await supabase.from("event_scenario_links").select("event_id").eq("scenario_id", scenarioId);
  if (monitoredError) throw monitoredError;
  const monitoredIds = new Set(alreadyMonitored.map((l) => l.event_id));

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, description, category, status, likelihood")
    .eq("project_id", scenario.project_id);
  if (eventsError) throw eventsError;

  const candidateEvents = events.filter((e) => !monitoredIds.has(e.id));
  if (candidateEvents.length === 0) {
    return { sufficientEvidence: false, gap: "Every project event is already monitored for this scenario.", candidates: [] };
  }
  const candidateById = new Map(candidateEvents.map((e) => [e.id, e]));

  const output = await runStructured({
    step: "monitoring.suggest_events",
    projectId: scenario.project_id,
    taskPrompt: SUGGEST_EVENTS_TASK_PROMPT,
    input: {
      scenario: { name: scenario.name, logic: scenario.logic },
      implications: implications.map((i) => ({ text: i.text, category: i.category })),
      sibling_scenarios: siblingScenarios,
      candidate_events: candidateEvents.map((e) => ({ id: e.id, title: e.title, body: e.description, category: e.category, status: e.status, likelihood: e.likelihood })),
    },
    schema: SuggestEventsSchema,
    effort: "low",
    thinking: false,
  });

  if (!output.sufficient_evidence || output.candidates.length === 0) {
    return { sufficientEvidence: false, gap: output.gap ?? "The model found insufficient evidence for discriminating events.", candidates: [] };
  }

  const candidates: SuggestEventCandidate[] = output.candidates
    .filter((c) => candidateById.has(c.event_id))
    .map((c) => ({ eventId: c.event_id, title: candidateById.get(c.event_id)!.title, discriminatesFrom: c.discriminates_from, rationale: c.rationale }));

  return { sufficientEvidence: candidates.length > 0, candidates };
}
