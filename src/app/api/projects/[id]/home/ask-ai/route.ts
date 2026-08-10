import { NextResponse } from "next/server";
import { whatShouldIDoNext, summarizeWeekSignals, whatsChangedSinceLastVisit, explainProgress } from "@/lib/actions/ai-home-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="home" branch; freeform is the
// separate /home/chat route). Same dispatch shape as /monitoring/ask-ai.
export const maxDuration = 120;

type Task = "next_steps" | "summarize_week_signals" | "whats_changed" | "explain_progress";

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
      case "next_steps":
        return NextResponse.json(await whatShouldIDoNext(projectId));

      case "summarize_week_signals":
        return NextResponse.json(await summarizeWeekSignals(projectId));

      case "whats_changed":
        return NextResponse.json(await whatsChangedSinceLastVisit(projectId));

      case "explain_progress":
        return NextResponse.json(await explainProgress(projectId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
