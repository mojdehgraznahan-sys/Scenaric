"use server";

// Drafts a route to a chosen target scenario (design/2026-10-05/03-strategy/PROMPTS.md,
// Prompt 2's "Draft route" button) — no-regret/shaping/hedge moves grounded in the target's
// own levers and signposts, never a fabricated reference. Returns the draft only; nothing is
// inserted until the user reviews it in a modal and confirms (createRouteMoves, decisions.ts)
// — same "AI proposes, human confirms" shape as every other fuzzy-generation flow in this
// codebase, just held in client state instead of a staging table since a route draft is
// reviewed once, immediately, by the same person who requested it.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { PERSONA_STRATEGIC_ADVISOR } from "@/lib/ai/personas";
import type { StorylinePhase } from "@/lib/decision-model";

const RouteDraftSchema = z.object({
  moves: z
    .array(
      z.object({
        lane: z.enum(["noregret", "shaping", "hedge"]),
        horizon: z.enum(["now", "2027", "2028", "2029_30"]),
        title: z.string(),
        link_kind: z.enum(["event", "signpost", "option"]),
        link_id: z.string(),
        pushes: z.boolean(),
      })
    )
    .min(1)
    .max(12),
});

const ROUTE_DRAFT_TASK_PROMPT = `${PERSONA_STRATEGIC_ADVISOR}

Task: Draft a route of moves toward the given target scenario —
a mix of no-regret moves (pay off regardless of which future arrives), shaping moves (make the
events that lead to the target more likely), and hedges (held in reserve, triggered if another
future gains ground instead).

Input: { target_scenario_name: string,
         shape_events: [{ id: string, title: string, phase: string|null }],      // events you make happen yourself
         influence_events: [{ id: string, title: string, phase: string|null }],  // events a partnership/coalition can push
         watch_events: [{ id: string, title: string, phase: string|null }],       // events you can only prepare for
         blocker_events: [{ id: string, title: string, phase: string|null }],     // events that pull toward other futures
         signposts: [{ id: string, name: string }],
         options: [{ id: string, name: string }] }            // existing strategic options

Each event carries its Storyline phase (precursors/catalysts/first_order/second_order/realized
— how far its own causal chain has already progressed, independent of this route). Default
horizon by phase: precursors or catalysts -> "now", first_order -> "2027", second_order ->
"2028", realized -> "2029_30". Use that default for any move linked to an event UNLESS the
move's own nature clearly calls for a different horizon (e.g. a hedge you deliberately hold
until a later signpost) — a move should not casually contradict its own linked event's already-
known timeline.

Rules:
- Every move's link_id must be a real id from exactly one of shape_events/influence_events/
  watch_events/blocker_events (if link_kind = "event"), signposts (if link_kind = "signpost"),
  or options (if link_kind = "option"). Never invent an id.
- Shaping moves should link to shape_events (you make these happen directly — prefer these when
  available) or influence_events (a partnership/coalition makes them more likely), and set
  pushes = true. No-regret moves typically link to an existing option. Hedges typically link to
  a signpost (triggered when it fires) or a blocker_event (something to prepare against).
- 4-10 moves total, spread across lanes and horizons (now/2027/2028/2029_30) — don't cluster
  everything in one lane or one horizon.
- title is a short, specific action (e.g. "Pre-qualify a Vietnam hosting partner"), not a
  restatement of the linked event/option/signpost name.

Output schema: { moves: [{ lane, horizon, title, link_kind, link_id, pushes }] }`;

export interface RouteDraftCandidate {
  id: string;
  title: string;
  // Only meaningful for events — signposts/options have no storyline placement. See the task
  // prompt's phase->horizon anchor: without this, the model picks a horizon with no knowledge
  // of the same event's already-known Storyline/Monitor Events timeline, and the two can
  // flatly contradict each other.
  phase?: StorylinePhase;
}

export interface RouteDraftMove {
  lane: "noregret" | "shaping" | "hedge";
  horizon: "now" | "2027" | "2028" | "2029_30";
  title: string;
  linkKind: "event" | "signpost" | "option";
  linkId: string;
  pushes: boolean;
}

export async function draftRouteForTarget(
  projectId: string,
  targetScenarioName: string,
  candidates: {
    shapeEvents: RouteDraftCandidate[];
    influenceEvents: RouteDraftCandidate[];
    watchEvents: RouteDraftCandidate[];
    blockerEvents: RouteDraftCandidate[];
    signposts: RouteDraftCandidate[];
    options: RouteDraftCandidate[];
  }
): Promise<RouteDraftMove[]> {
  const output = await runStructured({
    step: "strategy.draft_route",
    projectId,
    taskPrompt: ROUTE_DRAFT_TASK_PROMPT,
    input: {
      target_scenario_name: targetScenarioName,
      shape_events: candidates.shapeEvents,
      influence_events: candidates.influenceEvents,
      watch_events: candidates.watchEvents,
      blocker_events: candidates.blockerEvents,
      signposts: candidates.signposts,
      options: candidates.options,
    },
    schema: RouteDraftSchema,
    effort: "medium",
    thinking: false,
  });

  const validIdsByKind: Record<RouteDraftMove["linkKind"], Set<string>> = {
    event: new Set([...candidates.shapeEvents, ...candidates.influenceEvents, ...candidates.watchEvents, ...candidates.blockerEvents].map((c) => c.id)),
    signpost: new Set(candidates.signposts.map((c) => c.id)),
    option: new Set(candidates.options.map((c) => c.id)),
  };

  // Defense in depth, same convention as every other AI-call validator in this codebase —
  // drop a move outright rather than trust a fabricated id through to insertion.
  return output.moves
    .filter((m) => validIdsByKind[m.link_kind].has(m.link_id))
    .map((m) => ({ lane: m.lane, horizon: m.horizon, title: m.title, linkKind: m.link_kind, linkId: m.link_id, pushes: m.pushes }));
}
