import { NextResponse } from "next/server";
import { askSettingsChat } from "@/lib/actions/ai-settings-chat";
import { errorResponse } from "@/lib/api/error-response";

// "Ask anything…" freeform chat, sitting alongside the fixed task menu at /settings/ask-ai —
// never replacing it. Same shape as /monitoring/chat and /home/chat.
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
    return NextResponse.json(await askSettingsChat({ projectId: params.id, question: body.question }));
  } catch (err) {
    return errorResponse(err);
  }
}
