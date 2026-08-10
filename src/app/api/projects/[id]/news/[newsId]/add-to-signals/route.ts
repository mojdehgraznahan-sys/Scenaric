import { NextResponse } from "next/server";
import { addNewsItemToSignals } from "@/lib/actions/ai-news-items";
import { errorResponse } from "@/lib/api/error-response";

// POST /projects/:id/news/:newsId/add-to-signals — "+ Add to Signals" on the dashboard's
// News Feed card. Runs insight extraction + signal scoring inline (see ai-news-items.ts),
// same maxDuration headroom convention as the other AI-backed POST routes (strategy/generate).
export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: { id: string; newsId: string } }) {
  try {
    return NextResponse.json(await addNewsItemToSignals(params.id, params.newsId));
  } catch (err) {
    return errorResponse(err);
  }
}
