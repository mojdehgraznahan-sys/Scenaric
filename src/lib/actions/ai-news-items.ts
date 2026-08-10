"use server";

// Dashboard News Feed — product extension (SCHWARTZ_METHODOLOGY_SKILL.md's Signpost section
// is the closest precedent: live-web-search grounding, product-level, not one of Schwartz's
// 8 named steps). Two halves:
//   1. The daily pull (pullNewsForDashboard / runNewsFeedForProject / runNewsFeedForAllProjects)
//      reuses ai-news-feed.ts's searchNewsItems() web-search step, then scores impact via a
//      fixed rubric and stages results into news_items — deliberately NOT into sources/insights
//      the way pullNewsFeed does, so the Knowledge Base isn't silently flooded with insights
//      for news nobody has acted on.
//   2. "+ Add to Signals" (addNewsItemToSignals) promotes ONE news item on demand: creates a
//      sources row for it, runs it through the exact same STEEP-classification pipeline
//      (extractInsightsForProject) and impact/uncertainty scoring (scoreOneSignal) every other
//      signal goes through — never inserted as a bare, unscored signal.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Parser from "rss-parser";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runStructured } from "@/lib/ai/client";
import { NotFoundError } from "@/lib/ai/errors";
import { assertSafeExternalUrl } from "@/lib/url-safety";
import { searchNewsItems } from "./ai-news-feed";
import { extractInsightsForProject } from "./ai-insights";
import { createSignal } from "./signals";
import { scoreOneSignal } from "./ai-signals";
import { getProjectAiSettingsMap } from "./project-ai-settings";
import { getConnectedRssFeedUrl } from "./project-integrations";
import type { Database } from "@/lib/supabase/types";

type SteepCategory = "Social" | "Technology" | "Economic" | "Ecological" | "Political";

export type NewsItemRow = Database["public"]["Tables"]["news_items"]["Row"];
type SignalRow = Database["public"]["Tables"]["signals"]["Row"];

const NewsImpactSchema = z.object({
  items: z
    .array(
      z.object({
        index: z.number(),
        steep_category: z.enum(["Social", "Technology", "Economic", "Ecological", "Political"]),
        impact: z.enum(["HIGH", "MED", "LOW"]),
        // Must be a verbatim substring of the item's own title/summary — never invented.
        cited_phrase: z.string(),
        rationale: z.string(),
      })
    )
    .max(16),
});

// Classification + scoring unified into one pass — RSS-sourced items (fetchRssFeedItems
// below) have no inherent STEEP category the way ai-news-feed.ts's web-search step already
// assigns its own items, so rather than build a second classification path, every candidate
// (search-found or RSS-found) is classified here uniformly, regardless of origin.
const NEWS_IMPACT_TASK_PROMPT = `Task: For each news item, classify its STEEP category and score
its impact on this project's focal decision, using fixed rubrics — deterministic
classification, not creative judgment.

Input: { focal_question: string, items: [{ index: number, title: string, summary: string }] }

STEEP category rubric (pick exactly one):
- Social: demographic, cultural, behavioral, or lifestyle shifts.
- Technology: technical capability, infrastructure, or innovation shifts.
- Economic: market, pricing, capital, or macroeconomic shifts.
- Ecological: environmental, climate, or resource shifts.
- Political: regulatory, policy, or geopolitical shifts.

Impact rubric (apply literally, do not freelance a different scale):
- HIGH: would materially change the focal decision itself, or directly concerns a signal/
  trend this project is already tracking as high-stakes.
- MED: relevant to the focal question or its STEEP category, but incremental — moves the
  picture without changing the decision.
- LOW: tangential or background — related to the industry/horizon but not squarely on the
  focal question.

Rules:
- \`cited_phrase\` MUST be a verbatim substring copied from that item's own title or summary —
  the specific phrase that drove the impact score. Never invent or paraphrase it.
- Score every item given, in the same order, referencing its \`index\`.
- \`rationale\` is one sentence citing the mechanism, not a vibe.

Output schema:
{ items: [{ index: number, steep_category: "Social"|"Technology"|"Economic"|"Ecological"|"Political",
            impact: "HIGH"|"MED"|"LOW", cited_phrase: string, rationale: string }] }`;

interface ScorableItem {
  title: string;
  summary: string;
}

interface ScoredItem {
  steepCategory: SteepCategory;
  impact: "HIGH" | "MED" | "LOW";
  citedPhrase: string;
  rationale: string;
}

// Returns only the items the model actually scored, keyed by their original index — never
// fabricates a STEEP category for one it skipped (same anti-hallucination discipline as
// evaluateIndicatorsAgainstNews's own defense-in-depth cross-check); the caller drops any
// unscored candidate rather than inserting it with an invented classification.
async function scoreNewsImpact(projectId: string, focalQuestion: string, items: ScorableItem[], batchId?: string): Promise<Map<number, ScoredItem>> {
  const output = await runStructured({
    step: "news_items.score_impact",
    projectId,
    taskPrompt: NEWS_IMPACT_TASK_PROMPT,
    input: {
      focal_question: focalQuestion,
      items: items.map((item, index) => ({ index, title: item.title, summary: item.summary })),
    },
    schema: NewsImpactSchema,
    // Deterministic/rubric-driven scoring — this codebase has no literal temperature knob;
    // effort:"low" + thinking:false is its equivalent (same convention already used by
    // evaluateIndicatorsAgainstNews for its own rubric-driven status calls).
    effort: "low",
    thinking: false,
    batchId,
  });

  const result = new Map<number, ScoredItem>();
  for (const scored of output.items) {
    if (scored.index < 0 || scored.index >= items.length) continue; // never trust an out-of-range index
    result.set(scored.index, { steepCategory: scored.steep_category, impact: scored.impact, citedPhrase: scored.cited_phrase, rationale: scored.rationale });
  }
  return result;
}

interface CandidateNewsItem {
  title: string;
  url: string;
  publishedDate: string | null;
  summary: string;
  source: string;
}

// Integrations tab's RSS Feeds connection — an additional source feeding the same news_items
// pipeline alongside the default web-search feed, not a parallel one. Capped at 8 items like
// the web-search step already is; never fabricates a summary/date the feed itself doesn't
// provide.
async function fetchRssFeedItems(feedUrl: string): Promise<CandidateNewsItem[]> {
  try {
    await assertSafeExternalUrl(feedUrl);
    const feed = await new Parser().parseURL(feedUrl);
    return (feed.items ?? [])
      .slice(0, 8)
      .filter((item) => !!item.link)
      .map((item) => ({
        title: item.title ?? item.link!,
        url: item.link!,
        publishedDate: item.isoDate ?? item.pubDate ?? null,
        summary: (item.contentSnippet ?? item.content ?? item.title ?? "").slice(0, 1000),
        source: feed.title ?? new URL(feedUrl).hostname,
      }));
  } catch (err) {
    console.error("[ai-news-items] RSS feed fetch failed", err);
    return [];
  }
}

export interface PullNewsForDashboardOptions {
  /** Defaults to createClient() (cookie/session). Pass createAdminClient() for a session-less
   *  caller (the daily cron) — same convention as ai-news-feed.ts's pullNewsFeed. */
  supabaseClient?: SupabaseClient<Database>;
  batchId?: string;
}

export interface PullNewsForDashboardResult {
  itemsFound: number;
  itemsInserted: number;
}

export async function pullNewsForDashboard(projectId: string, options: PullNewsForDashboardOptions = {}): Promise<PullNewsForDashboardResult> {
  const supabase = options.supabaseClient ?? createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;
  const focalQuestion = project.refined_focal_question ?? project.focal_question;

  const { data: existingSignals, error: signalsError } = await supabase.from("signals").select("title").eq("project_id", projectId);
  if (signalsError) throw signalsError;

  const { data: existingNews, error: newsError } = await supabase.from("news_items").select("url").eq("project_id", projectId);
  if (newsError) throw newsError;
  const existingUrls = new Set(existingNews.map((n) => n.url));

  const [searchResult, rssFeedUrl] = await Promise.all([
    searchNewsItems(supabase, projectId, {
      existingTitles: existingSignals.map((s) => s.title),
      existingUrls: Array.from(existingUrls),
      focusTopics: [],
      batchId: options.batchId,
    }),
    getConnectedRssFeedUrl(projectId, supabase),
  ]);

  const searchItems: CandidateNewsItem[] = searchResult.sufficientEvidence
    ? searchResult.items.map((item) => ({ title: item.title, url: item.url, publishedDate: item.publishedDate, summary: item.summary, source: item.source }))
    : [];
  const rssItems = rssFeedUrl ? await fetchRssFeedItems(rssFeedUrl) : [];
  const allCandidates = [...searchItems, ...rssItems];

  if (allCandidates.length === 0) {
    return { itemsFound: 0, itemsInserted: 0 };
  }

  // Hard, application-level dedupe by URL on top of the model's own soft avoidance — the
  // migration's unique(project_id, url) constraint is the final backstop via upsert below.
  // Also dedupes search vs. RSS surfacing the same URL within this same pull.
  const seenUrls = new Set(existingUrls);
  const newItems: CandidateNewsItem[] = [];
  for (const item of allCandidates) {
    if (!item.url || seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    newItems.push(item);
  }
  if (newItems.length === 0) {
    return { itemsFound: allCandidates.length, itemsInserted: 0 };
  }

  const scoresByIndex = await scoreNewsImpact(
    projectId,
    focalQuestion,
    newItems.map((item) => ({ title: item.title, summary: item.summary })),
    options.batchId
  );

  const rows = newItems
    .map((item, i) => {
      const scored = scoresByIndex.get(i);
      if (!scored) return null; // never insert with a fabricated classification
      return {
        project_id: projectId,
        title: item.title,
        source: item.source,
        url: item.url,
        published_at: item.publishedDate,
        impact: scored.impact,
        impact_cited_phrase: scored.citedPhrase || null,
        steep_category: scored.steepCategory,
        summary: item.summary,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length === 0) {
    return { itemsFound: allCandidates.length, itemsInserted: 0 };
  }

  const { data: inserted, error: insertError } = await supabase.from("news_items").upsert(rows, { onConflict: "project_id,url" }).select("id");
  if (insertError) throw insertError;

  revalidatePath("/home");
  return { itemsFound: allCandidates.length, itemsInserted: inserted.length };
}

export interface NewsFeedProjectResult {
  projectId: string;
  itemsInserted: number;
}

export async function runNewsFeedForProject(projectId: string, batchId: string): Promise<NewsFeedProjectResult> {
  const supabase = createAdminClient();
  const result = await pullNewsForDashboard(projectId, { supabaseClient: supabase, batchId });
  return { projectId, itemsInserted: result.itemsInserted };
}

export interface NewsFeedSummary {
  batchId: string;
  projectsProcessed: number;
  // Opted out via project_ai_settings.suggest_from_news_feeds — distinct from a project that
  // ran but had nothing to pull (that still counts toward projectsProcessed).
  projectsSkipped: number;
  errors: { projectId: string; message: string }[];
}

// Entry point for the daily news-feed cron route — mirrors indicators-monitoring.ts's
// runIndicatorMonitoringForAllProjects shape (shared batchId, serial per-project loop,
// per-project errors collected rather than aborting the whole run). Skips any project whose
// AI Analyst "Suggest signals from external news feeds" toggle is off
// (project_ai_settings.suggest_from_news_feeds, default true when no row exists) — this is
// the only pipeline that toggle gates; the separate Knowledge Base news connector
// (ai-news-feed.ts's pullNewsFeed) is untouched.
export async function runNewsFeedForAllProjects(): Promise<NewsFeedSummary> {
  const batchId = crypto.randomUUID();
  const supabase = createAdminClient();

  const { data: projects, error } = await supabase.from("projects").select("id").eq("archived", false);
  if (error) throw error;

  const settingsByProject = await getProjectAiSettingsMap(
    projects.map((p) => p.id),
    supabase
  );

  let projectsProcessed = 0;
  let projectsSkipped = 0;
  const errors: { projectId: string; message: string }[] = [];

  for (const project of projects) {
    if (settingsByProject.get(project.id)?.suggest_from_news_feeds === false) {
      projectsSkipped += 1;
      continue;
    }
    try {
      await runNewsFeedForProject(project.id, batchId);
      projectsProcessed += 1;
    } catch (err) {
      errors.push({ projectId: project.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { batchId, projectsProcessed, projectsSkipped, errors };
}

// POST /projects/:id/news/:newsId/add-to-signals — "+ Add to Signals" button on the
// dashboard's News Feed card.
export async function addNewsItemToSignals(projectId: string, newsItemId: string): Promise<SignalRow> {
  const supabase = createClient();

  const { data: newsItem, error: newsItemError } = await supabase
    .from("news_items")
    .select("*")
    .eq("id", newsItemId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (newsItemError) throw newsItemError;
  if (!newsItem) throw new NotFoundError(`News item ${newsItemId} could not be found in project ${projectId}.`);

  // Idempotent re-click: already promoted, return the existing signal rather than duplicating.
  if (newsItem.added_to_signals && newsItem.signal_id) {
    const { data: existingSignal, error: existingSignalError } = await supabase.from("signals").select("*").eq("id", newsItem.signal_id).single();
    if (existingSignalError) throw existingSignalError;
    return existingSignal;
  }

  // One sources row for this specific item — identical shape to what pullNewsFeed already
  // produces per item, so it flows through extractInsightsForProject exactly like any other
  // web_feed source. The backing insight ends up tagged source_type:'Web' (existing
  // SOURCE_TYPE_LABEL convention in ai-insights.ts), not a new 'web_feed' enum value.
  const { data: insertedSource, error: sourceError } = await supabase
    .from("sources")
    .insert({
      project_id: projectId,
      name: newsItem.title,
      type: "web_feed" as const,
      status: "complete" as const,
      storage_url: newsItem.url,
      extracted_text: `[${newsItem.steep_category}] ${newsItem.title}${newsItem.published_at ? ` (${newsItem.published_at})` : ""}\n\n${newsItem.summary}`,
      uploaded_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    })
    .select("id")
    .single();
  if (sourceError) throw sourceError;

  await supabase.from("news_items").update({ source_id: insertedSource.id }).eq("id", newsItemId);

  // Same shared STEEP-classification pipeline every other source type uses — Task 4's
  // explicit requirement, not a news-specific extraction path.
  await extractInsightsForProject(projectId, {});

  const { data: insights, error: insightsError } = await supabase.from("insights").select("id").eq("source_id", insertedSource.id);
  if (insightsError) throw insightsError;
  if (insights.length === 0) {
    throw new Error(`No insight could be extracted from news item ${newsItemId} — insufficient evidence in its summary.`);
  }

  const signal = await createSignal({
    projectId,
    category: newsItem.steep_category,
    source: newsItem.source,
    title: newsItem.title,
    body: newsItem.summary,
    origin: "insight",
    groundedInsightIds: insights.map((i) => i.id),
  });

  // Awaited (not fire-and-forget, unlike the store's own createSignal UI path) so the
  // response never represents an unscored signal — Task 4's explicit "never inserted as a
  // bare unscored signal."
  await scoreOneSignal(projectId, signal.id);

  const { data: scoredSignal, error: scoredSignalError } = await supabase.from("signals").select("*").eq("id", signal.id).single();
  if (scoredSignalError) throw scoredSignalError;

  await supabase.from("news_items").update({ added_to_signals: true, signal_id: signal.id }).eq("id", newsItemId);

  revalidatePath("/home");
  return scoredSignal;
}
