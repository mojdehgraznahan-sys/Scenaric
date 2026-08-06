import { NextResponse } from "next/server";
import {
  validateStorylinePlausibility,
  validateStorylineChain,
  findMissingLinksInStoryline,
  explainStorylineChain,
} from "@/lib/actions/ai-storyline-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="storyline" branch). Each task
// reasons only over this project's own storyline graph, no general external knowledge.
export const maxDuration = 120;

type Task = "validate_plausibility" | "validate_chain" | "find_missing_links" | "explain_chain";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const scenarioId = params.id;

  let body: { task?: Task; nodeIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    switch (body.task) {
      case "validate_plausibility":
        return NextResponse.json(await validateStorylinePlausibility(scenarioId));

      case "validate_chain":
        if (!body.nodeIds || body.nodeIds.length === 0) {
          return NextResponse.json({ error: "nodeIds is required for validate_chain." }, { status: 400 });
        }
        return NextResponse.json(await validateStorylineChain(scenarioId, body.nodeIds));

      case "find_missing_links":
        return NextResponse.json(await findMissingLinksInStoryline(scenarioId));

      case "explain_chain":
        if (!body.nodeIds || body.nodeIds.length === 0) {
          return NextResponse.json({ error: "nodeIds is required for explain_chain." }, { status: 400 });
        }
        return NextResponse.json(await explainStorylineChain(scenarioId, body.nodeIds));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
