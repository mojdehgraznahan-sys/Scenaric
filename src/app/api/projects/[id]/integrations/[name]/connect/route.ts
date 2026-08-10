import { NextResponse } from "next/server";
import { connectSlack, connectRss } from "@/lib/actions/project-integrations";
import { errorResponse } from "@/lib/api/error-response";

// POST /projects/:id/integrations/:name/connect { url } — "slack" (an Incoming Webhook URL)
// or "rss" (a feed URL). Notion/Bloomberg have no backend — 400 for any other name.
export async function POST(request: Request, { params }: { params: { id: string; name: string } }) {
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.url || !body.url.trim()) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  try {
    switch (params.name) {
      case "slack":
        await connectSlack(params.id, body.url);
        return NextResponse.json({ ok: true });
      case "rss":
        await connectRss(params.id, body.url);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: `"${params.name}" isn't available to connect yet.` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
