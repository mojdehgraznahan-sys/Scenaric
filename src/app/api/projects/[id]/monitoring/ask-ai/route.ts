import { NextResponse } from "next/server";
import { rankScenariosByIndicatorSignal, explainIndicatorStatus, summarizeRecentChanges, suggestIndicatorForUnderMonitoredScenario } from "@/lib/actions/ai-monitoring-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="monitoring" branch; freeform is
// the separate /monitoring/chat route). Each task reasons only over this project's own
// indicators/indicator_readings/sources, no general external knowledge.
export const maxDuration = 120;

type Task = "most_likely_scenario" | "explain_indicator" | "recent_changes" | "suggest_indicator";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const projectId = params.id;

  let body: { task?: Task; indicatorId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    switch (body.task) {
      case "most_likely_scenario":
        return NextResponse.json(await rankScenariosByIndicatorSignal(projectId));

      case "explain_indicator":
        if (!body.indicatorId) {
          return NextResponse.json({ error: "indicatorId is required for explain_indicator." }, { status: 400 });
        }
        return NextResponse.json(await explainIndicatorStatus(body.indicatorId));

      case "recent_changes":
        return NextResponse.json(await summarizeRecentChanges(projectId));

      case "suggest_indicator":
        return NextResponse.json(await suggestIndicatorForUnderMonitoredScenario(projectId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
