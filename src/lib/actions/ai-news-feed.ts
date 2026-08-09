"use server";

// News-feed connector — product extension, not a Schwartz step (see
// SCHWARTZ_METHODOLOGY_SKILL.md's "Signpost" section for the parallel precedent: real-world
// grounding is allowed to enter via live web search, but only through the front door — the
// sources/insights pipeline — never through a generation prompt's own back-channel search.
// ai-narrative.ts's narrative/expand and ai-implications.ts's implications/generate never
// call web_search themselves; they only ever reason over storyline_nodes/insights already
// grounded in this project's own data, which may now include the news items this connector
// pulled in. This is what keeps "real current events can inform a narrative" compatible with
// "every AI output is grounded or explicitly flagged as inference/external" (§3's global
// scaffold, restated as a hard constraint in the skill file).
//
// Reuses the exact web_search pattern already proven in ai-grounding.ts's signpost
// generation — no new API key or dependency. Each found item is inserted directly as a
// `sources` row (type: 'web_feed', status: 'complete', extracted_text already populated —
// there's no separate fetch step the way processWebSource has, since the model already
// retrieved and summarized the content itself), then the exact same, type-agnostic
// extractInsightsForProject() every other source type uses picks it up — no news-specific
// insight-extraction path exists or is needed.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { runStructured } from "@/lib/ai/client";
import { AIWebSearchError } from "@/lib/ai/errors";
import { extractInsightsForProject } from "./ai-insights";
import type { Database } from "@/lib/supabase/types";

const NewsFeedSchema = z.object({
  sufficient_evidence: z.boolean(),
  gap: z.string().nullable(),
  items: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        // Only ever a real date the model found, never a guess — see the prompt rule below.
        published_date: z.string().nullable(),
        summary: z.string(),
        steep_category: z.enum(["Social", "Technology", "Economic", "Ecological", "Political"]),
      })
    )
    .max(8),
});

const NEWS_FEED_TASK_PROMPT = `Task: Search for RECENT, real, dated news items relevant to this
project's focal question and STEEP categories (Social, Technological, Economic, Ecological,
Political) — current-events grounding for a scenario-planning knowledge base, not analysis
or speculation about what the news means.

Input: { focal_question: string, industry: string, horizon: string,
         existing_signal_titles: string[] /* avoid resurfacing what's already covered */,
         focus_topics: [{ name: string, trigger_condition: string | null }]
         /* optional — when non-empty, this project is actively monitoring these specific
         Step 8 leading indicators; actively look for real, dated developments relevant to
         each named topic and its trigger_condition, IN ADDITION TO the general focal-question/
         STEEP search below — never restrict results to ONLY focus_topics, and never skip a
         genuinely relevant general item just because it isn't topic-specific */ }

Rules:
- Every item must be a real, dated news item you actually found via web_search — never a
  fabricated headline, url, or date. If you cannot determine a real publication date, set
  published_date: null rather than guessing one.
- \`summary\` must only restate what the article itself says — 2-4 sentences, no invented
  detail, no speculation about implications for the project (that belongs to a later step,
  not this one).
- Each item needs exactly one steep_category.
- Skip anything that's substantially the same story as an existing_signal_title.
- If focus_topics is non-empty, prioritize surfacing items relevant to each named topic's
  trigger_condition, without abandoning the general focal-question/STEEP search.
- If web_search turns up nothing genuinely relevant and recent, return
  sufficient_evidence:false and a gap explaining why — do not pad with old or tangential
  results to look complete.
- Cap at 8 items per call.

Output schema:
{ sufficient_evidence: boolean, gap: string | null,
  items: [{ title: string, url: string, published_date: string | null, summary: string,
            steep_category: "Social"|"Technology"|"Economic"|"Ecological"|"Political" }] }`;

export interface PullNewsFeedOptions {
  /** Defaults to createClient() (cookie/session) when omitted — the existing "Pull recent
   *  news" button on the Knowledge Base page is unaffected. Pass createAdminClient() for a
   *  session-less caller (the indicator monitoring cron job) — a cron invocation has no
   *  session cookie, so the default createClient() here would silently match zero rows under
   *  RLS, not throw. */
  supabaseClient?: SupabaseClient<Database>;
  /** Only consulted when supabaseClient is provided — an admin client has no session to look
   *  a user up from, so auth.getUser() isn't called on that path at all. Defaults to null. */
  uploadedBy?: string | null;
  /** Guides (does not restrict) the web search toward what's actively being monitored — see
   *  the prompt's own focus_topics rule. */
  focusTopics?: { name: string; triggerCondition: string | null }[];
  batchId?: string;
}

export interface PullNewsFeedResult {
  sufficientEvidence: boolean;
  gap?: string | null;
  sourcesCreated: number;
  insightsCreated: number;
  // Built directly from this call's own already-parsed model output, zipped with the insert's
  // returned ids — no re-query, no re-parsing the concatenated extracted_text blob. Lets a
  // caller (indicator-monitoring.ts) cite a real, specific news item without a second lookup.
  sources: {
    id: string;
    title: string;
    url: string;
    summary: string;
    publishedDate: string | null;
    steepCategory: "Social" | "Technology" | "Economic" | "Ecological" | "Political";
  }[];
}

// "Pull recent news" on the Knowledge Base page (default args); also the ingestion half of the
// daily indicator monitoring job (indicator-monitoring.ts), which passes supabaseClient/
// uploadedBy/focusTopics/batchId.
export async function pullNewsFeed(projectId: string, options: PullNewsFeedOptions = {}): Promise<PullNewsFeedResult> {
  const supabase = options.supabaseClient ?? createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("focal_question, refined_focal_question, industry, horizon")
    .eq("id", projectId)
    .single();
  if (projectError) throw projectError;

  const { data: signals, error: signalsError } = await supabase.from("signals").select("title").eq("project_id", projectId);
  if (signalsError) throw signalsError;

  let output: z.infer<typeof NewsFeedSchema>;
  try {
    output = await runStructured({
      step: "news_feed.pull",
      projectId,
      taskPrompt: NEWS_FEED_TASK_PROMPT,
      input: {
        focal_question: project.refined_focal_question ?? project.focal_question,
        industry: project.industry,
        horizon: project.horizon,
        existing_signal_titles: signals.map((s) => s.title),
        focus_topics: (options.focusTopics ?? []).map((t) => ({ name: t.name, trigger_condition: t.triggerCondition })),
      },
      schema: NewsFeedSchema,
      effort: "medium",
      webSearch: { maxUses: 5 },
      // Same headroom bump ai-grounding.ts's web-search call needed — web_search tool turns
      // plus a multi-item structured response can run long.
      maxTokens: 6000,
      batchId: options.batchId,
    });
  } catch (err) {
    if (err instanceof Anthropic.APIError) throw new AIWebSearchError(err);
    throw err;
  }

  if (!output.sufficient_evidence || output.items.length === 0) {
    return { sufficientEvidence: false, gap: output.gap ?? "No relevant recent news found.", sourcesCreated: 0, insightsCreated: 0, sources: [] };
  }

  // Only resolve a session user on the default (cookie) path — an admin client has no session,
  // and auth.getUser() against it isn't meaningful to call at all.
  const uploadedBy = options.supabaseClient ? (options.uploadedBy ?? null) : ((await supabase.auth.getUser()).data.user?.id ?? null);

  const rows = output.items.map((item) => ({
    project_id: projectId,
    name: item.title,
    type: "web_feed" as const,
    status: "complete" as const,
    storage_url: item.url,
    extracted_text: `[${item.steep_category}] ${item.title}${item.published_date ? ` (${item.published_date})` : ""}\n\n${item.summary}`,
    uploaded_by: uploadedBy,
  }));

  const { data: inserted, error: insertError } = await supabase.from("sources").insert(rows).select("id");
  if (insertError) throw insertError;

  revalidatePath("/knowledge");

  // Same call the "Extract insights" button uses — type-agnostic, so these new web_feed
  // sources are picked up exactly like any Doc/Audio/Survey/Web source would be. The
  // narrative/implications prompts never see this news directly, only the grounded
  // insights (and, eventually, signals) it produces.
  const extractResult = await extractInsightsForProject(projectId, { supabaseClient: options.supabaseClient, batchId: options.batchId });

  const sourcesOut = inserted.map((row, idx) => ({
    id: row.id,
    title: output.items[idx].title,
    url: output.items[idx].url,
    summary: output.items[idx].summary,
    publishedDate: output.items[idx].published_date,
    steepCategory: output.items[idx].steep_category,
  }));

  return { sufficientEvidence: true, sourcesCreated: inserted.length, insightsCreated: extractResult.insightsCreated, sources: sourcesOut };
}
