"use server";

// Canvas's "Ask AI" — a fixed task menu (ask-ai.tsx's context="canvas" branch), never freeform.
// All 3 prompts are project-wide (no per-scenario selection context), reusing already-built
// logic wherever it exists rather than duplicating it.
import { z } from "zod";
import { runStructured } from "@/lib/ai/client";
import { createClient } from "@/lib/supabase/server";
import { getScenarios } from "./scenarios";
import { explainPredeterminedElements, type BucketSummaryResult } from "./ai-matrix-tasks";

// ─────────────────────── "What predetermined elements show up in every scenario?" ───────────
// Same question, same source of truth (matrix_dots.bucket='predetermined') as Matrix's own
// "Explain the predetermined elements" task — direct reuse, not a new prompt.

export async function explainPredeterminedAcrossScenarios(projectId: string): Promise<BucketSummaryResult> {
  return explainPredeterminedElements(projectId);
}

// ─────────────────────── "Which scenario has the weakest storyline?" ───────────────────────
// No AI call — "thin chain" is already a real, existing concept (getStoryline/
// findMissingLinksInStoryline both define it as nodes.length < 4; SCHWARTZ_METHODOLOGY_SKILL.md:
// "Thin chains are a signal, not just a display issue... treat that as a sign the scenario logic
// isn't adequately grounded yet"). "Weakest" is a deterministic min() over real per-scenario node
// counts, not a judgment call — code picks the target, no AI needed for pure selection.

export interface WeakestStorylineResult {
  summary: string;
}

export async function findWeakestStoryline(projectId: string): Promise<WeakestStorylineResult> {
  const supabase = createClient();
  const scenarios = (await getScenarios(projectId)).filter((s) => !s.archived);

  if (scenarios.length === 0) {
    return { summary: "No active scenarios yet — build scenarios on Canvas first." };
  }

  const { data: nodes, error } = await supabase
    .from("storyline_nodes")
    .select("scenario_id")
    .in(
      "scenario_id",
      scenarios.map((s) => s.id)
    );
  if (error) throw error;

  const countByScenarioId = new Map<string, number>();
  for (const s of scenarios) countByScenarioId.set(s.id, 0);
  for (const n of nodes) countByScenarioId.set(n.scenario_id, (countByScenarioId.get(n.scenario_id) ?? 0) + 1);

  const counts = scenarios.map((s) => ({ scenario: s, count: countByScenarioId.get(s.id) ?? 0 }));
  const minCount = Math.min(...counts.map((c) => c.count));
  const maxCount = Math.max(...counts.map((c) => c.count));
  const allCountsStr = counts.map((c) => `${c.scenario.name} (${c.scenario.quadrant}): ${c.count}`).join(", ");

  if (minCount === maxCount) {
    return {
      summary: `All ${scenarios.length} scenario${scenarios.length === 1 ? "" : "s"} currently have similarly developed storylines (${minCount} node${minCount === 1 ? "" : "s"} each) — no clear weakest one yet. [${allCountsStr}]`,
    };
  }

  const weakest = counts.filter((c) => c.count === minCount);
  const others = counts.filter((c) => c.count !== minCount).map((c) => c.count);

  if (weakest.length > 1) {
    const names = weakest.map((w) => `${w.scenario.name} (${w.scenario.quadrant})`).join(" and ");
    return {
      summary: `${names} are tied for the thinnest storylines — only ${minCount} node${minCount === 1 ? "" : "s"} each vs ${others.join("/")} in the others. Visit Storyline to strengthen their causal chains.`,
    };
  }

  const w = weakest[0];
  return {
    summary: `${w.scenario.name} (${w.scenario.quadrant}) has the thinnest storyline — only ${minCount} node${minCount === 1 ? "" : "s"} vs ${others.join("/")} in the others. Visit Storyline to strengthen its causal chain.`,
  };
}

// ─────────────────────── "Summarize all 4 scenarios" ───────────────────────
// Real synthesis across each scenario's own stored copy into one paragraph — grounded strictly
// in name/tagline/summary/narrative, never inventing content beyond what's already there.

const SummarizeAllSchema = z.object({ summary: z.string() });

const SUMMARIZE_ALL_TASK_PROMPT = `Task: Write one paragraph (4-6 sentences) comparing these
scenarios for a quick briefing — what distinguishes each from the others, grounded strictly in
their given name/quadrant/tagline/summary/narrative.

Input: { scenarios: [{ name: string, quadrant: "TL"|"TR"|"BL"|"BR", tagline: string|null,
  summary: string|null, narrative: string|null }] }

Rules:
- Reference each scenario's actual tagline/summary/narrative content — never invent plot details,
  numbers, or outcomes not present in the given fields.
- If a scenario's summary/narrative is still empty or thin, say so plainly rather than padding it
  with invented detail.
- If fewer than 4 scenarios are given, write the comparison across however many exist and note
  plainly that not all 4 quadrants are built out yet — do not pretend a 4th exists.

Output schema: { summary: string }`;

export interface SummarizeAllScenariosResult {
  summary: string;
}

export async function summarizeAllScenarios(projectId: string): Promise<SummarizeAllScenariosResult> {
  const scenarios = (await getScenarios(projectId)).filter((s) => !s.archived);

  if (scenarios.length === 0) {
    return { summary: "No active scenarios yet — build scenarios on Canvas first." };
  }

  const output = await runStructured({
    step: "canvas_ask_ai.summarize_all",
    projectId,
    taskPrompt: SUMMARIZE_ALL_TASK_PROMPT,
    input: {
      scenarios: scenarios.map((s) => ({
        name: s.name,
        quadrant: s.quadrant,
        tagline: s.tagline,
        summary: s.summary,
        narrative: s.narrative,
      })),
    },
    schema: SummarizeAllSchema,
    effort: "medium",
  });

  return { summary: output.summary };
}
