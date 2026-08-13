"use server";

// Cold-start convenience — not a Schwartz step, not a new AI prompt. Runs the two
// existing Step 2 research actions (pullNewsFeed: STEEP news via web_search;
// runLocalForceScan: named local actors via web_search) together for projects with
// no uploaded sources yet, so a user with nothing to upload isn't left guessing
// that they need to click two separate, easy-to-miss buttons to get real Step 2
// coverage. Each underlying action keeps its own behavior unchanged — pullNewsFeed
// still writes sources+insights directly, runLocalForceScan still stages
// unconfirmed research_suggestions requiring explicit confirm. This wrapper does
// not change either action's data-writing or confirmation semantics.
import { pullNewsFeed, type PullNewsFeedResult } from "./ai-news-feed";
import { runLocalForceScan, type RunScanResult } from "./ai-research-suggestions";

export interface ResearchIndustryFailure {
  failed: true;
  error: string;
}

export interface ResearchIndustryResult {
  news: PullNewsFeedResult | ResearchIndustryFailure;
  localForces: RunScanResult | ResearchIndustryFailure;
}

// Promise.allSettled, not Promise.all — these are two independent live web_search
// calls; one failing (rate limit, transient API error) should never hide the
// other's real result. Each half is reported separately so the caller can render
// partial success exactly like the two individual buttons already do.
export async function researchIndustry(projectId: string): Promise<ResearchIndustryResult> {
  const [newsOutcome, forcesOutcome] = await Promise.allSettled([pullNewsFeed(projectId), runLocalForceScan(projectId)]);

  return {
    news:
      newsOutcome.status === "fulfilled"
        ? newsOutcome.value
        : { failed: true, error: newsOutcome.reason instanceof Error ? newsOutcome.reason.message : "News search failed." },
    localForces:
      forcesOutcome.status === "fulfilled"
        ? forcesOutcome.value
        : { failed: true, error: forcesOutcome.reason instanceof Error ? forcesOutcome.reason.message : "Local actor search failed." },
  };
}
