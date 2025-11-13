import { NextRequest, NextResponse } from "next/server";
import { projectService } from "@/server/services/project-service";
import { projectIdSchema } from "@/lib/dto";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const parsed = projectIdSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await projectService.get(parsed.data.id);
  if (!project) {
    return NextResponse.json({ error: "Proje bulunamadı." }, { status: 404 });
  }

  return NextResponse.json(project);
}
