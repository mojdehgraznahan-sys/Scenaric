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

const ROUTE_DRAFT_TASK_PROMPT = `Task: Draft a route of moves toward the given target scenario —
a mix of no-regret moves (pay off regardless of which future arrives), shaping moves (make the
events that lead to the target more likely), and hedges (held in reserve, triggered if another
future gains ground instead).

Input: { target_scenario_name: string,
         influence_events: [{ id: string, title: string }],  // events you can push
         watch_events: [{ id: string, title: string }],       // events you can only prepare for
         blocker_events: [{ id: string, title: string }],     // events that pull toward other futures
         signposts: [{ id: string, name: string }],
         options: [{ id: string, name: string }] }            // existing strategic options

Rules:
- Every move's link_id must be a real id from exactly one of influence_events/watch_events/
  blocker_events (if link_kind = "event"), signposts (if link_kind = "signpost"), or options
  (if link_kind = "option"). Never invent an id.
- Shaping moves should link to influence_events (things worth pushing) and set pushes = true.
  No-regret moves typically link to an existing option. Hedges typically link to a signpost
  (triggered when it fires) or a blocker_event (something to prepare against).
- 4-10 moves total, spread across lanes and horizons (now/2027/2028/2029_30) — don't cluster
  everything in one lane or one horizon.
- title is a short, specific action (e.g. "Pre-qualify a Vietnam hosting partner"), not a
  restatement of the linked event/option/signpost name.

Output schema: { moves: [{ lane, horizon, title, link_kind, link_id, pushes }] }`;

export interface RouteDraftCandidate {
  id: string;
  title: string;
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
    event: new Set([...candidates.influenceEvents, ...candidates.watchEvents, ...candidates.blockerEvents].map((c) => c.id)),
    signpost: new Set(candidates.signposts.map((c) => c.id)),
    option: new Set(candidates.options.map((c) => c.id)),
  };

  // Defense in depth, same convention as every other AI-call validator in this codebase —
  // drop a move outright rather than trust a fabricated id through to insertion.
  return output.moves
    .filter((m) => validIdsByKind[m.link_kind].has(m.link_id))
    .map((m) => ({ lane: m.lane, horizon: m.horizon, title: m.title, linkKind: m.link_kind, linkId: m.link_id, pushes: m.pushes }));
}
