import { NextResponse } from "next/server";
import { expandNarrativeWithAI } from "@/lib/actions/ai-narrative";
import { errorResponse } from "@/lib/api/error-response";

// "Expand with AI" on the Narrative page — a single synchronous call, no status-polling
// table needed (unlike Storyline's multi-node generate, Narrative writes one text column).
export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await expandNarrativeWithAI(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
