import { NextResponse } from "next/server";
import { explainPredeterminedAcrossScenarios, findWeakestStoryline, summarizeAllScenarios } from "@/lib/actions/ai-canvas-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="canvas" branch). All 3 tasks are
// project-wide; none attach webSearch (Step 6 narrative/storyline is closed-book).
export const maxDuration = 120;

type Task = "predetermined_elements" | "weakest_storyline" | "summarize_all";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const projectId = params.id;

  let body: { task?: Task };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    switch (body.task) {
      case "predetermined_elements":
        return NextResponse.json(await explainPredeterminedAcrossScenarios(projectId));

      case "weakest_storyline":
        return NextResponse.json(await findWeakestStoryline(projectId));

      case "summarize_all":
        return NextResponse.json(await summarizeAllScenarios(projectId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
