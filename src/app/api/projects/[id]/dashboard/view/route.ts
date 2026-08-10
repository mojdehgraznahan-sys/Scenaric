import { NextResponse } from "next/server";
import { markDashboardViewed } from "@/lib/actions/news";
import { errorResponse } from "@/lib/api/error-response";

// POST /projects/:id/dashboard/view — called by the client AFTER its unread-news fetch
// resolves, never before (stamping the view first would erase that same visit's own "unread"
// badge before it's ever shown).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await markDashboardViewed(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
