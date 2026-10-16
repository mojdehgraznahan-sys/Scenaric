import { NextResponse } from "next/server";
import { getProjectAiUsage } from "@/lib/actions/ai-usage";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await getProjectAiUsage(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
