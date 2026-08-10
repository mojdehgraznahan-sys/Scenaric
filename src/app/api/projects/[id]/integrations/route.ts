import { NextResponse } from "next/server";
import { getProjectIntegrations } from "@/lib/actions/project-integrations";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await getProjectIntegrations(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}
