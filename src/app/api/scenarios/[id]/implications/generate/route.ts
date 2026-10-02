import { NextResponse } from "next/server";
import { generateImplicationsForScenario } from "@/lib/actions/ai-implications";
import { errorResponse } from "@/lib/api/error-response";

// "Regenerate" on the Narrative page's Implications block, and the auto-generate-once call
// on scenario select (§10 of the Backend Build Plan). Single synchronous call, same idiom
// as narrative/expand — no status-polling table needed.
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    // ?allowCache=1 is only ever sent by page-narrative.tsx's automatic "no implications yet"
    // effect — the explicit "Regenerate" button omits it, so it always gets a fresh call.
    const allowCache = new URL(request.url).searchParams.get("allowCache") === "1";
    return NextResponse.json(await generateImplicationsForScenario(params.id, { allowCache }));
  } catch (err) {
    return errorResponse(err);
  }
}
