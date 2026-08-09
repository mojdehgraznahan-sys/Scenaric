import { NextResponse } from "next/server";
import { stressTestOption, explainNonRobustCell, suggestHedge } from "@/lib/actions/ai-strategy-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="strategy" branch; freeform is the
// separate /strategy/chat route). Each task reasons only over this project's own strategic
// options/scores/scenarios/implications, no general external knowledge.
export const maxDuration = 120;

type Task = "stress_test_option" | "explain_non_robust" | "suggest_hedge";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const projectId = params.id;

  let body: { task?: Task; optionId?: string; scenarioId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    switch (body.task) {
      case "stress_test_option":
        if (!body.optionId) {
          return NextResponse.json({ error: "optionId is required for stress_test_option." }, { status: 400 });
        }
        return NextResponse.json(await stressTestOption(body.optionId));

      case "explain_non_robust":
        if (!body.optionId || !body.scenarioId) {
          return NextResponse.json({ error: "optionId and scenarioId are required for explain_non_robust." }, { status: 400 });
        }
        return NextResponse.json(await explainNonRobustCell(body.optionId, body.scenarioId));

      case "suggest_hedge":
        return NextResponse.json(await suggestHedge(projectId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
