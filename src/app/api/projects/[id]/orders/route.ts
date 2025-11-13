import { NextRequest, NextResponse } from "next/server";
import { orderCreateSchema } from "@/lib/dto";
import { projectService } from "@/server/services/project-service";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await enforceRateLimit(request, "project-order");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = orderCreateSchema.safeParse({ ...body, projectId: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const order = await projectService.createOrder(parsed.data);
    return NextResponse.json(order, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Emir kaydedilemedi." }, { status: 400 });
  }
}
