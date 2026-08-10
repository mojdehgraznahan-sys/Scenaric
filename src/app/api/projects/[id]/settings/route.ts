import { NextResponse } from "next/server";
import { getProjectSettings, updateProjectSettings, type ProjectSettingsPatch } from "@/lib/actions/project-settings";
import { errorResponse } from "@/lib/api/error-response";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return NextResponse.json(await getProjectSettings(params.id));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  let body: ProjectSettingsPatch;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    return NextResponse.json(await updateProjectSettings(params.id, body));
  } catch (err) {
    return errorResponse(err);
  }
}
