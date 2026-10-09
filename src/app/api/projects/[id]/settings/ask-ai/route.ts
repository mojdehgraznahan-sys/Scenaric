import { NextResponse } from "next/server";
import { draftFocalQuestion, sharpenFocalQuestion, critiqueFocalQuestion } from "@/lib/actions/ai-settings-tasks";
import { errorResponse } from "@/lib/api/error-response";

// Fixed task menu — never freeform (see ask-ai.tsx's context="settings" branch; freeform is
// the separate /settings/chat route). Same dispatch shape as /monitoring/ask-ai.
export const maxDuration = 120;

type Task = "draft_focal_question" | "sharpen_focal_question" | "critique_focal_question";

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
      case "draft_focal_question":
        return NextResponse.json(await draftFocalQuestion(projectId));

      case "sharpen_focal_question":
        return NextResponse.json(await sharpenFocalQuestion(projectId));

      case "critique_focal_question":
        return NextResponse.json(await critiqueFocalQuestion(projectId));

      default:
        return NextResponse.json({ error: `Unknown task: ${body.task}` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
