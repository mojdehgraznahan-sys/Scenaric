import { NextResponse } from "next/server";
import { getStrategyRecommendation } from "@/lib/actions/ai-strategy-recommendation";
import { errorResponse } from "@/lib/api/error-response";

// GET /projects/:id/strategy/recommendation — called on Strategy page load whenever
// strategic_options exist (Build Plan §12 follow-on). A cache hit (see ai-strategy-
// recommendation.ts) returns instantly with no AI call; a cache miss computes and persists one.
export const maxDuration = 120;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await getStrategyRecommendation(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
