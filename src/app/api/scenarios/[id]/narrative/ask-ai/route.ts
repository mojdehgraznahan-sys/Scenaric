import { NextResponse } from "next/server";
import { checkNarrativeFidelity, stressTestImplications } from "@/lib/actions/ai-narrative-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="narrative" branch). Same shape
// as .../storyline/ask-ai/route.ts. "regenerate_implications"/"suggest_indicators" used to be
// dispatched here too — removed (Ask AI audit, design/2026-10-05 follow-up): both duplicated
// buttons the Narrative page already has, see ai-narrative-tasks.ts's own comment.
type Task = "check_fidelity" | "stress_test_implications";

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

      case "stress_test_implications":
        return NextResponse.json(await stressTestImplications(scenarioId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
