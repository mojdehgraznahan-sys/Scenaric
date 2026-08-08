import { NextResponse } from "next/server";
import { generateImplicationsForScenario } from "@/lib/actions/ai-implications";
import { errorResponse } from "@/lib/api/error-response";

// "Regenerate" on the Narrative page's Implications block, and the auto-generate-once call
// on scenario select (§10 of the Backend Build Plan). Single synchronous call, same idiom
// as narrative/expand — no status-polling table needed.
export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await generateImplicationsForScenario(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
