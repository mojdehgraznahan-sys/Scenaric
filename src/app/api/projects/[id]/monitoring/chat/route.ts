import { NextResponse } from "next/server";
import { askMonitoringChat } from "@/lib/actions/ai-monitoring-chat";
import { errorResponse } from "@/lib/api/error-response";

// "Ask anything…" freeform chat, sitting alongside the fixed task menu at
// /monitoring/ask-ai — never replacing it.
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let body: { question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.question || !body.question.trim()) {
    return NextResponse.json({ error: "question is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await askMonitoringChat({ projectId: params.id, question: body.question }));
  } catch (err) {
    return errorResponse(err);
  }
}
