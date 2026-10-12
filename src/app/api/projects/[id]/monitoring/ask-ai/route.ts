import { NextResponse } from "next/server";
import { rankScenariosByEventSignal, explainEventLikelihood, summarizeRecentEventChanges, suggestEventMonitoringForUnderMonitoredScenario } from "@/lib/actions/ai-monitoring-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="monitoring" branch; freeform is
// the separate /monitoring/chat route). Each task reasons only over this project's own tracked
// events (event_scenario_links/event_likelihood_history), no general external knowledge.
export const maxDuration = 120;

type Task = "most_likely_scenario" | "explain_event" | "recent_changes" | "suggest_events";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const projectId = params.id;

  let body: { task?: Task; eventId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    switch (body.task) {
      case "most_likely_scenario":
        return NextResponse.json(await rankScenariosByEventSignal(projectId));

      case "explain_event":
        if (!body.eventId) {
          return NextResponse.json({ error: "eventId is required for explain_event." }, { status: 400 });
        }
        return NextResponse.json(await explainEventLikelihood(body.eventId));

      case "recent_changes":
        return NextResponse.json(await summarizeRecentEventChanges(projectId));

      case "suggest_events":
        return NextResponse.json(await suggestEventMonitoringForUnderMonitoredScenario(projectId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
