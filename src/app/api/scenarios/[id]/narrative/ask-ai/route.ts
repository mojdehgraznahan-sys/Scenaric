import { NextResponse } from "next/server";
import {
  checkNarrativeFidelity,
  regenerateImplicationsTask,
  stressTestImplications,
  suggestIndicatorsTask,
} from "@/lib/actions/ai-narrative-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="narrative" branch). Same shape
// as .../storyline/ask-ai/route.ts.
export const maxDuration = 120;

type Task = "check_fidelity" | "regenerate_implications" | "stress_test_implications" | "suggest_indicators";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const scenarioId = params.id;

  let body: { task?: Task };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    switch (body.task) {
      case "check_fidelity":
        return NextResponse.json(await checkNarrativeFidelity(scenarioId));

      case "regenerate_implications":
        return NextResponse.json(await regenerateImplicationsTask(scenarioId));

      case "stress_test_implications":
        return NextResponse.json(await stressTestImplications(scenarioId));

      case "suggest_indicators":
        return NextResponse.json(await suggestIndicatorsTask(scenarioId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
