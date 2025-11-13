import { NextRequest, NextResponse } from "next/server";
import { projectService } from "@/server/services/project-service";
import { projectCreateSchema } from "@/lib/dto";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  try {
    const data = await projectService.list(searchParams);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Listeleme sırasında hata oluştu." }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, "project-create");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = projectCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const project = await projectService.createProject(parsed.data);
  return NextResponse.json(project, { status: 201 });
}
