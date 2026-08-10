import { NextResponse } from "next/server";
import { getProjectAiSettings, updateProjectAiSettings, type ProjectAiSettings } from "@/lib/actions/project-ai-settings";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await getProjectAiSettings(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: Partial<Omit<ProjectAiSettings, "project_id">>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    return NextResponse.json(await updateProjectAiSettings(params.id, body));
  } catch (err) {
    return errorResponse(err);
  }
}
