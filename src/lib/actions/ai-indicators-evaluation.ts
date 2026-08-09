"use server";

// Indicator monitoring's one new AI call — Step 8 (Indicators) follow-on (Build Plan §11).
// Distinct from ai-indicators.ts's own generate call: that one CREATES indicators (once, at
// build time, grounded in a storyline node); this one only JUDGES already-existing indicators
// against a day's freshly pulled news, never invents a new indicator. Also distinct from
// Signpost (ai-grounding.ts) — that's a separate, on-demand, live-web-search product
// extension; this call never web-searches itself, it only reasons over news items
// indicators-monitoring.ts already pulled via pullNewsFeed.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";

const IndicatorEvaluationSchema = z.object({
  // No top-level sufficient_evidence/gap — an empty `updates` array is a normal, expected
  // "nothing moved today" result, not an evidence gap (same convention already used by
  // ai-strategy-recommendation.ts's rationale-only schema).
  updates: z
    .array(
      z.object({
        indicator_id: z.string(),
        new_status: z.enum(["On track", "Watch", "Alert"]),
        // The real id of the specific news item (from today's pull) that justifies this
        // update — cross-checked server-side against the real id set before anything is
        // applied, never trusted blindly.
        grounded_in: z.string(),
        rationale: z.string(),
      })
    )
    .max(40),
});

const INDICATOR_EVALUATION_TASK_PROMPT = `Task: Given today's freshly pulled news items and this
project's existing Step 8 indicators (each with its own trigger_condition defining what On
track/Watch/Alert mean for it), decide whether any item moves any indicator's status. This is a
recurring daily monitoring pass, not indicator generation — never invent a new indicator, only
judge the ones given.

Input: { indicators: [{ id: string, name: string, scenario_name: string,
           current_status: "On track"|"Watch"|"Alert", trigger_condition: string | null }],
         news_items: [{ id: string, title: string, published_date: string | null,
           summary: string }] }

Rules:
- Only propose an update for an indicator that a specific news_item DIRECTLY concerns — cite
  that item's real id (from news_items) as grounded_in. Never cite an id that isn't in
  news_items, never fabricate one.
- Judge new_status strictly against that indicator's own trigger_condition:
  - Alert only if the news_item reports the trigger_condition's Alert-level threshold or event
    has actually occurred, or is clearly imminent (within roughly one quarter).
  - Watch if the news_item is directionally relevant to the trigger_condition — meaningful
    movement toward it — but the Alert-level threshold hasn't been met, OR if a prior
    Alert-level development has clearly reversed but residual momentum/risk remains.
  - On track if the news_item directly reports that a prior concerning development has clearly
    resolved or reversed with no remaining momentum toward the trigger_condition.
- An indicator with no trigger_condition (null) can still be judged directionally against its
  name, but be more conservative — when genuinely unsure, do not include it.
- Leave unchanged (omit entirely from updates) if no news_item directly concerns an indicator,
  or if you are uncertain about direction or magnitude. Do not guess.
- Do not output more than one update per indicator_id.
- If no news_item concerns any indicator, return an empty updates array — a normal, expected
  daily outcome, not a failure.

Output schema:
{ updates: [{ indicator_id: string, new_status: "On track"|"Watch"|"Alert", grounded_in: string,
              rationale: string }] }`;

export interface IndicatorForEvaluation {
  id: string;
  name: string;
  scenarioName: string;
  currentStatus: "On track" | "Watch" | "Alert";
  triggerCondition: string | null;
}

export interface NewsItemForEvaluation {
  id: string;
  title: string;
  publishedDate: string | null;
  summary: string;
}

export interface IndicatorStatusUpdate {
  indicatorId: string;
  newStatus: "On track" | "Watch" | "Alert";
  groundedIn: string;
  rationale: string;
}

export async function evaluateIndicatorsAgainstNews(
  projectId: string,
  indicators: IndicatorForEvaluation[],
  newsItems: NewsItemForEvaluation[],
  batchId: string
): Promise<IndicatorStatusUpdate[]> {
  const output = await runStructured({
    step: "indicators.evaluate",
    projectId,
    taskPrompt: INDICATOR_EVALUATION_TASK_PROMPT,
    input: {
      indicators: indicators.map((i) => ({
        id: i.id,
        name: i.name,
        scenario_name: i.scenarioName,
        current_status: i.currentStatus,
        trigger_condition: i.triggerCondition,
      })),
      news_items: newsItems.map((n) => ({ id: n.id, title: n.title, published_date: n.publishedDate, summary: n.summary })),
    },
    schema: IndicatorEvaluationSchema,
    effort: "low",
    thinking: false,
    batchId,
  });

  // Defense in depth beyond the prompt's own instruction — never trust an id the model claims
  // is real; cross-check against what was actually given. At most one update per indicator,
  // first one wins if the model somehow duplicates (schema doesn't forbid it, this does).
  const indicatorIds = new Set(indicators.map((i) => i.id));
  const newsItemIds = new Set(newsItems.map((n) => n.id));
  const seen = new Set<string>();
  const validated: IndicatorStatusUpdate[] = [];
  for (const update of output.updates) {
    if (!indicatorIds.has(update.indicator_id)) continue;
    if (!newsItemIds.has(update.grounded_in)) continue;
    if (seen.has(update.indicator_id)) continue;
    seen.add(update.indicator_id);
    validated.push({ indicatorId: update.indicator_id, newStatus: update.new_status, groundedIn: update.grounded_in, rationale: update.rationale });
  }
  return validated;
}
