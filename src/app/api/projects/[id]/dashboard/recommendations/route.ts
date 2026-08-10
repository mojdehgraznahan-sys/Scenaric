import { NextResponse } from "next/server";
import { getDashboardRecommendations } from "@/lib/actions/dashboard-recommendations";
import { errorResponse } from "@/lib/api/error-response";

export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await getDashboardRecommendations(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
