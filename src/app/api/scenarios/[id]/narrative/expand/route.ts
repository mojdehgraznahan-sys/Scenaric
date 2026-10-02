import { NextResponse } from "next/server";
import { expandNarrativeWithAI } from "@/lib/actions/ai-narrative";
import { errorResponse } from "@/lib/api/error-response";

// "Expand with AI" on the Narrative page — a single synchronous call, no status-polling
// table needed (unlike Storyline's multi-node generate, Narrative writes one text column).
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    // ?allowCache=1 is only ever sent by page-narrative.tsx's automatic "no narrative yet"
    // effect — the explicit "Expand with AI"/"Overwrite and regenerate" buttons omit it, so
    // they always get a fresh call. See expandNarrativeWithAI's own comment.
    const allowCache = new URL(request.url).searchParams.get("allowCache") === "1";
    return NextResponse.json(await expandNarrativeWithAI(params.id, { allowCache }));
  } catch (err) {
    return errorResponse(err);
  }
}
