import { NextResponse } from "next/server";
import { getProjectDashboard } from "@/lib/actions/dashboard";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await getProjectDashboard(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
