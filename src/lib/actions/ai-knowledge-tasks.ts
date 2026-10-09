"use server";

// Knowledge Base's "Ask AI" — a fixed task menu (ask-ai.tsx's context="knowledge" branch), never
// freeform (freeform is the separate /knowledge/chat route). All four tasks are thin wrappers
// around the existing Step 2 (runLocalForceScan) / Step 8-adjacent (pullNewsFeed) research
// actions in ai-research-suggestions.ts / ai-news-feed.ts — scan/pull call them with no
// options, byte-identical to the old toolbar buttons; the two "cold start" competitor/
// regulation tasks pass a `focus` hint that steers (never restricts) the same underlying
// web_search-backed scan. Every task normalizes to one shared { summary, itemsFound } shape
// so the Ask AI panel renders all four the same way.
//
// The two Step-3 STEEP-trend variants that used to live here (supply chain/geopolitics,
// international markets) moved to ai-research-suggestions.ts and the Signals page's own task
// menu (Ask AI audit, design/2026-10-05 follow-up) — they stage driving-force candidates
// reviewed on the Signals page, which is a Signals-page job, not a Knowledge Base one.
import { runLocalForceScan } from "./ai-research-suggestions";
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
