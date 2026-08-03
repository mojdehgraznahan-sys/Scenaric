import { NextResponse } from "next/server";
import { generateScenarioGrounding } from "@/lib/actions/ai-grounding";
import { errorResponse } from "@/lib/api/error-response";

// Single web-search-enabled call — smaller budget than /generate's, which runs this
// concurrently with a second model call.
export const maxDuration = 120;

// Re-runs ONLY the plausibility + signposts research — never re-derives the storyline chain
// itself (autoSuggestStoryline), since news changes over time but the causal timeline doesn't
// need to be rebuilt just to get an updated plausibility read. Does not touch
// scenario_storylines — that column tracks the storyline chain's generation run specifically.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await generateScenarioGrounding(params.id);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
