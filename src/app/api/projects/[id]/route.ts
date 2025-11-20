import { NextRequest, NextResponse } from "next/server";
import { projectService } from "@/server/services/project-service";
import { projectIdSchema } from "@/lib/dto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const awaitedParams = await params;
  const parsed = projectIdSchema.safeParse(awaitedParams);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await projectService.get(parsed.data.id);
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json(project);
}
