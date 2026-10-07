"use server";

// Decision-scan's news-judgment call (design/2026-10-05/01-shared-decision-layer/PROMPTS.md,
// Prompt 3 steps 2-3). Mirrors ai-indicators-evaluation.ts's shape exactly, but judges EVENT
// likelihood, not indicator status, and additionally classifies news items that don't concern
// any tracked event into discovered_events candidates — folded into one call since both read
// the same day's pulled news. Never invents a new indicator/event/force: re-scoring only
// judges events it's given, discovery only proposes against forces it's given. Closed-book —
// the model reasons only over the news_items this call provides, never its own training
// knowledge (methodology guardrail #3 in design/2026-10-05/README.md).
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";

const DecisionScanEvaluationSchema = z.object({
  // Omitted entirely for an event no news item concerns, same "no entry = no change" shape as
  // ai-indicators-evaluation.ts's updates array.
  event_updates: z
    .array(
      z.object({
        event_id: z.string(),
        new_level: z.number().int().min(0).max(4), // 0 Ruled out .. 4 Occurred
        grounded_in: z.string(), // real news_items[].id this change is based on
        cite: z.string(), // one-sentence quote/paraphrase of what the item actually said
      })
    )
    .max(40),
  // Every news item that doesn't directly concern a tracked event — the daily discovery
  // inbox. An item CAN appear here even if it also triggered an event_update elsewhere (rare,
  // but not mutually exclusive) — discovery is about "is this a new standalone development",
  // re-scoring is about "does this change something we already track".
  discoveries: z
    .array(
      z.object({
        news_item_id: z.string(),
        title: z.string(),
        fits: z.boolean(),
        // Set only when fits = true — the force/pole this news item pushes toward, chosen
        // from this project's own forces list, never fabricated.
        proposed_force_id: z.string().nullable(),
        proposed_side: z.enum(["a", "b"]).nullable(),
        // Set only when fits = false — a one-line "new force" suggestion.
        proposal: z.string().nullable(),
      })
    )
    .max(20),
});

const DECISION_SCAN_EVALUATION_TASK_PROMPT = `Task: Given today's freshly pulled news items, this
project's tracked events (each with a current likelihood level and the force/pole it supports),
and this project's existing forces, do two things:

1. Re-score: for each tracked event, decide whether a specific news item changes its likelihood
   level. This is a recurring daily monitoring pass, not event creation — never invent a new
   event, only judge the ones given.
2. Discover: classify every news item that does NOT directly concern a tracked event as a
   discovery candidate — propose which existing force/pole (if any) it fits, or mark it as
   fitting nothing with a one-line "new force" proposal.

Input: { tracked_events: [{ id: string, title: string, current_level: number (0-4),
           force_title: string, pole: string, impact: number }],
         forces: [{ id: string, title: string, pole_a: string, pole_b: string }],
         news_items: [{ id: string, title: string, published_date: string | null,
           summary: string }] }

Rules:
- event_updates: only propose a change for an event a specific news_item DIRECTLY concerns —
  cite that item's real id (from news_items) as grounded_in, and quote/paraphrase what it
  actually said as cite. Never cite an id that isn't in news_items, never fabricate one. Judge
  new_level strictly: 4 (Occurred) only if the item reports the event has actually happened; 3
  (High) if clearly imminent or a necessary precondition just cleared; 2 (Medium) for
  meaningful but inconclusive movement; 1 (Low) if the item reports the event stalling,
  reversing, or losing support; 0 (Ruled out) only if the item reports it's now impossible.
  Leave an event out of event_updates entirely if no news item directly concerns it, or if
  you're uncertain — do not guess. At most one update per event_id.
- discoveries: every news item not already driving an event_update should appear here exactly
  once. fits = true only when the item clearly concerns one of the given forces — pick its real
  id as proposed_force_id and the pole it pushes toward as proposed_side ("a" for pole_a, "b"
  for pole_b). fits = false otherwise, with a one-sentence proposal naming what new force this
  might become. Never propose a force_id that isn't in the given forces list.
- No outside knowledge: judge only from what news_items actually say. An empty result for
  either array is a normal, expected daily outcome, not a failure.

Output schema:
{ event_updates: [{ event_id, new_level, grounded_in, cite }],
  discoveries: [{ news_item_id, title, fits, proposed_force_id, proposed_side, proposal }] }`;

export interface TrackedEventForEvaluation {
  id: string;
  title: string;
  currentLevel: number;
  forceTitle: string;
  pole: string;
  impact: number;
}

export interface ForceForEvaluation {
  id: string;
  title: string;
  poleA: string;
  poleB: string;
}

export interface NewsItemForEvaluation {
  id: string;
  title: string;
  publishedDate: string | null;
  summary: string;
}

export interface EventLikelihoodUpdate {
  eventId: string;
  newLevel: number;
  groundedIn: string;
  cite: string;
}

export interface DiscoveryCandidate {
  newsItemId: string;
  title: string;
  fits: boolean;
  proposedForceId: string | null;
  proposedSide: "a" | "b" | null;
  proposal: string | null;
}

export interface DecisionScanEvaluation {
  eventUpdates: EventLikelihoodUpdate[];
  discoveries: DiscoveryCandidate[];
}

export async function evaluateNewsForDecisionScan(
  projectId: string,
  trackedEvents: TrackedEventForEvaluation[],
  forces: ForceForEvaluation[],
  newsItems: NewsItemForEvaluation[],
  batchId: string
): Promise<DecisionScanEvaluation> {
  const output = await runStructured({
    step: "decisions.evaluate",
    projectId,
    taskPrompt: DECISION_SCAN_EVALUATION_TASK_PROMPT,
    input: {
      tracked_events: trackedEvents.map((e) => ({
        id: e.id,
        title: e.title,
        current_level: e.currentLevel,
        force_title: e.forceTitle,
        pole: e.pole,
        impact: e.impact,
      })),
      forces: forces.map((f) => ({ id: f.id, title: f.title, pole_a: f.poleA, pole_b: f.poleB })),
      news_items: newsItems.map((n) => ({ id: n.id, title: n.title, published_date: n.publishedDate, summary: n.summary })),
    },
    schema: DecisionScanEvaluationSchema,
    effort: "low",
    thinking: false,
    batchId,
  });

  // Defense in depth, same spirit as ai-indicators-evaluation.ts — never trust an id the model
  // claims is real without cross-checking against what was actually given.
  const eventIds = new Set(trackedEvents.map((e) => e.id));
  const forceIds = new Set(forces.map((f) => f.id));
  const newsItemIds = new Set(newsItems.map((n) => n.id));

  const seenEvents = new Set<string>();
  const eventUpdates: EventLikelihoodUpdate[] = [];
  for (const u of output.event_updates) {
    if (!eventIds.has(u.event_id)) continue;
    if (!newsItemIds.has(u.grounded_in)) continue;
    if (seenEvents.has(u.event_id)) continue;
    seenEvents.add(u.event_id);
    eventUpdates.push({ eventId: u.event_id, newLevel: u.new_level, groundedIn: u.grounded_in, cite: u.cite });
  }

  const seenNews = new Set<string>();
  const discoveries: DiscoveryCandidate[] = [];
  for (const d of output.discoveries) {
    if (!newsItemIds.has(d.news_item_id)) continue;
    if (seenNews.has(d.news_item_id)) continue;
    if (d.fits && (!d.proposed_force_id || !forceIds.has(d.proposed_force_id))) continue; // claimed fit but no real force — drop rather than trust it
    seenNews.add(d.news_item_id);
    discoveries.push({
      newsItemId: d.news_item_id,
      title: d.title,
      fits: d.fits,
      proposedForceId: d.fits ? d.proposed_force_id : null,
      proposedSide: d.fits ? d.proposed_side : null,
      proposal: d.fits ? null : d.proposal,
    });
  }

  return { eventUpdates, discoveries };
}
