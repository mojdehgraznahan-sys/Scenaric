import { NextResponse } from "next/server";
import { listProjectNews } from "@/lib/actions/news";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const unreadOnly = new URL(request.url).searchParams.get("unread") === "true";
    return NextResponse.json(await listProjectNews(params.id, { unreadOnly }));
  } catch (err) {
    return errorResponse(err);
  }
}
