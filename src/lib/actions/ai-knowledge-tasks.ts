"use server";

// Knowledge Base's "Ask AI" — a fixed task menu (ask-ai.tsx's context="knowledge" branch), never
// freeform (freeform is the separate /knowledge/chat route). All six tasks are thin wrappers
// around the existing Step 2 (runLocalForceScan) / Step 3 (runMacroTrendSweep) / Step 8-adjacent
// (pullNewsFeed) research actions in ai-research-suggestions.ts / ai-news-feed.ts — the two
// relocated tasks (scan/pull) call them with no options, byte-identical to the old toolbar
// buttons; the four new "cold start" tasks pass a `focus` hint that steers (never restricts)
// the same underlying web_search-backed scan. Every task normalizes to one shared
// { summary, itemsFound } shape so the Ask AI panel renders all six the same way.
import { runLocalForceScan, runMacroTrendSweep } from "./ai-research-suggestions";
import { pullNewsFeed } from "./ai-news-feed";

export interface KnowledgeTaskResult {
  summary: string;
  itemsFound: number;
}

function summarizeScan(result: { sufficientEvidence: boolean; gap: string | null; suggestionsCreated: number }): KnowledgeTaskResult {
  if (!result.sufficientEvidence) return { summary: result.gap || "Nothing new found.", itemsFound: 0 };
  return { summary: `Found ${result.suggestionsCreated} new item(s) to review below.`, itemsFound: result.suggestionsCreated };
}

// Relocated, unchanged — was the Knowledge Base toolbar's "Scan for local actors (web)" button.
export async function scanLocalActors(projectId: string): Promise<KnowledgeTaskResult> {
  return summarizeScan(await runLocalForceScan(projectId));
}

// Relocated, unchanged — was the Knowledge Base toolbar's "Pull recent news" button.
export async function pullRecentNews(projectId: string): Promise<KnowledgeTaskResult> {
  const result = await pullNewsFeed(projectId);
  if (!result.sufficientEvidence) return { summary: result.gap || "No relevant recent news found.", itemsFound: 0 };
  return { summary: `Pulled ${result.sourcesCreated} news item(s), extracted ${result.insightsCreated} insight(s).`, itemsFound: result.sourcesCreated };
}

const COMPETITOR_FOCUS =
  "Prioritize actor_type: competitor. For each one found, describe what they have RECENTLY done " +
  "to improve their business — new products, pricing moves, market expansion, partnerships — not " +
  "a generic company profile.";

export async function researchCompetitors(projectId: string): Promise<KnowledgeTaskResult> {
  return summarizeScan(await runLocalForceScan(projectId, { focus: COMPETITOR_FOCUS }));
}

const REGULATION_FOCUS =
  "Prioritize actor_type: regulator. Describe the specific regulations, rules, or compliance " +
  "requirements relevant to the focal question — not just who the regulator is.";

export async function researchRegulations(projectId: string): Promise<KnowledgeTaskResult> {
  return summarizeScan(await runLocalForceScan(projectId, { focus: REGULATION_FOCUS }));
}

const SUPPLY_CHAIN_GEOPOLITICS_FOCUS =
  "Prioritize supply-chain dynamics (sourcing, logistics, tariffs, trade routes) and geopolitical " +
  "(Political category) developments relevant to the focal question.";

export async function researchSupplyChainGeopolitics(projectId: string): Promise<KnowledgeTaskResult> {
  return summarizeScan(await runMacroTrendSweep(projectId, { focus: SUPPLY_CHAIN_GEOPOLITICS_FOCUS }));
}

const INTERNATIONAL_MARKETS_FOCUS =
  "Prioritize US, North American, and other internationally-relevant market conditions (Economic " +
  "category) — market size, growth, competitive dynamics, trade policy — bringing in other " +
  "regions only where genuinely relevant to the focal question.";

export async function researchInternationalMarkets(projectId: string): Promise<KnowledgeTaskResult> {
  return summarizeScan(await runMacroTrendSweep(projectId, { focus: INTERNATIONAL_MARKETS_FOCUS }));
}
