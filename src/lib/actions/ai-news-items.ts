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
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runStructured } from "@/lib/ai/client";
import { NotFoundError } from "@/lib/ai/errors";
import { searchNewsItems } from "./ai-news-feed";
import { extractInsightsForProject } from "./ai-insights";
import { createSignal } from "./signals";
import { scoreOneSignal } from "./ai-signals";
import type { Database } from "@/lib/supabase/types";

export type NewsItemRow = Database["public"]["Tables"]["news_items"]["Row"];
type SignalRow = Database["public"]["Tables"]["signals"]["Row"];

const NewsImpactSchema = z.object({
  items: z
    .array(
      z.object({
        index: z.number(),
        impact: z.enum(["HIGH", "MED", "LOW"]),
        // Must be a verbatim substring of the item's own title/summary — never invented.
        cited_phrase: z.string(),
        rationale: z.string(),
      })
    )
    .max(8),
});

const NEWS_IMPACT_TASK_PROMPT = `Task: Score each news item's impact on this project's focal
decision, using a fixed rubric — deterministic classification, not creative judgment.

Input: { focal_question: string,
         items: [{ index: number, title: string, summary: string, steep_category: string }] }

Rubric (apply literally, do not freelance a different scale):
- HIGH: would materially change the focal decision itself, or directly concerns a signal/
  trend this project is already tracking as high-stakes.
- MED: relevant to the focal question or its STEEP category, but incremental — moves the
  picture without changing the decision.
- LOW: tangential or background — related to the industry/horizon but not squarely on the
  focal question.

Rules:
- \`cited_phrase\` MUST be a verbatim substring copied from that item's own title or summary —
  the specific phrase that drove the score. Never invent or paraphrase it.
- Score every item given, in the same order, referencing its \`index\`.
- \`rationale\` is one sentence citing the mechanism, not a vibe.

Output schema:
{ items: [{ index: number, impact: "HIGH"|"MED"|"LOW", cited_phrase: string, rationale: string }] }`;

interface ScorableItem {
  title: string;
  summary: string;
  steepCategory: string;
}

async function scoreNewsImpact(
  projectId: string,
  focalQuestion: string,
  items: ScorableItem[],
  batchId?: string
): Promise<{ impact: "HIGH" | "MED" | "LOW"; citedPhrase: string; rationale: string }[]> {
  const output = await runStructured({
    step: "news_items.score_impact",
    projectId,
    taskPrompt: NEWS_IMPACT_TASK_PROMPT,
    input: {
      focal_question: focalQuestion,
      items: items.map((item, index) => ({ index, title: item.title, summary: item.summary, steep_category: item.steepCategory })),
    },
    schema: NewsImpactSchema,
    // Deterministic/rubric-driven scoring — this codebase has no literal temperature knob;
    // effort:"low" + thinking:false is its equivalent (same convention already used by
    // evaluateIndicatorsAgainstNews for its own rubric-driven status calls).
    effort: "low",
    thinking: false,
    batchId,
  });

  // Defense in depth: never trust the model's claimed index blindly — map back by position,
  // falling back to a conservative MED/no-citation entry for any item it skipped.
  const byIndex = new Map(output.items.map((i) => [i.index, i]));
  return items.map((_, index) => {
    const scored = byIndex.get(index);
    return scored
      ? { impact: scored.impact, citedPhrase: scored.cited_phrase, rationale: scored.rationale }
      : { impact: "MED" as const, citedPhrase: "", rationale: "Not individually scored by the model; defaulted." };
  });
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

  const searchResult = await searchNewsItems(supabase, projectId, {
    existingTitles: existingSignals.map((s) => s.title),
    existingUrls: Array.from(existingUrls),
    focusTopics: [],
    batchId: options.batchId,
  });

  if (!searchResult.sufficientEvidence) {
    return { itemsFound: 0, itemsInserted: 0 };
  }

  // Hard, application-level dedupe by URL on top of the model's own soft avoidance — the
  // migration's unique(project_id, url) constraint is the final backstop via upsert below.
  const newItems = searchResult.items.filter((item) => !existingUrls.has(item.url));
  if (newItems.length === 0) {
    return { itemsFound: searchResult.items.length, itemsInserted: 0 };
  }

  const scores = await scoreNewsImpact(
    projectId,
    focalQuestion,
    newItems.map((item) => ({ title: item.title, summary: item.summary, steepCategory: item.steepCategory })),
    options.batchId
  );

  const rows = newItems.map((item, i) => ({
    project_id: projectId,
    title: item.title,
    source: item.source,
    url: item.url,
    published_at: item.publishedDate,
    impact: scores[i].impact,
    impact_cited_phrase: scores[i].citedPhrase || null,
    steep_category: item.steepCategory,
    summary: item.summary,
  }));

  const { data: inserted, error: insertError } = await supabase.from("news_items").upsert(rows, { onConflict: "project_id,url" }).select("id");
  if (insertError) throw insertError;

  revalidatePath("/home");
  return { itemsFound: searchResult.items.length, itemsInserted: inserted.length };
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
  errors: { projectId: string; message: string }[];
}

// Entry point for the daily news-feed cron route — mirrors indicators-monitoring.ts's
// runIndicatorMonitoringForAllProjects shape (shared batchId, serial per-project loop,
// per-project errors collected rather than aborting the whole run).
export async function runNewsFeedForAllProjects(): Promise<NewsFeedSummary> {
  const batchId = crypto.randomUUID();
  const supabase = createAdminClient();

  const { data: projects, error } = await supabase.from("projects").select("id").eq("archived", false);
  if (error) throw error;

  let projectsProcessed = 0;
  const errors: { projectId: string; message: string }[] = [];

  for (const project of projects) {
    try {
      await runNewsFeedForProject(project.id, batchId);
      projectsProcessed += 1;
    } catch (err) {
      errors.push({ projectId: project.id, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { batchId, projectsProcessed, errors };
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
