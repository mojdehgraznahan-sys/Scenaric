import { NextResponse } from "next/server";
import { generateIndicatorsForScenario } from "@/lib/actions/ai-indicators";
import { errorResponse } from "@/lib/api/error-response";

// POST /projects/:id/indicators/generate — Build Plan §11's literal project-scoped path.
// The actual generation is always scoped to one scenario (its storyline is what indicators
// are grounded in), so the request body carries scenarioId — today's only caller is the
// Narrative page's "Track indicators" button, generating for its currently-selected scenario.
export const maxDuration = 120;

export async function POST(request: Request) {
  let body: { scenarioId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.scenarioId) {
    return NextResponse.json({ error: "scenarioId is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await generateIndicatorsForScenario(body.scenarioId));
  } catch (err) {
    return errorResponse(err);
  }
}
