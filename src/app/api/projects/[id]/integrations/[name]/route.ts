import { NextResponse } from "next/server";
import { disconnectSlack, disconnectRss } from "@/lib/actions/project-integrations";
import { errorResponse } from "@/lib/api/error-response";

// DELETE /projects/:id/integrations/:name — disconnect.
export async function DELETE(_request: Request, { params }: { params: { id: string; name: string } }) {
  try {
    switch (params.name) {
      case "slack":
        await disconnectSlack(params.id);
        return NextResponse.json({ ok: true });
      case "rss":
        await disconnectRss(params.id);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: `"${params.name}" isn't available to disconnect.` }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
