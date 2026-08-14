import { NextResponse } from "next/server";
import { askSettingsChat } from "@/lib/actions/ai-settings-chat";
import { errorResponse } from "@/lib/api/error-response";

// "Ask anything…" freeform chat, sitting alongside the fixed task menu at /settings/ask-ai —
// never replacing it. Same shape as /monitoring/chat and /home/chat. Optional `research: true`
// is the one explicit, user-invoked exception to Step 1's closed-book rule (askSettingsChat's
// "Research" branch, "settings.research_chat" on RESEARCH_MODE_ALLOWED_STEPS) — omitted/false
// keeps the original closed-book behavior unchanged.
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  let body: { question?: string; research?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.question || !body.question.trim()) {
    return NextResponse.json({ error: "question is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(await askSettingsChat({ projectId: params.id, question: body.question, research: body.research }));
  } catch (err) {
    return errorResponse(err);
  }
}
