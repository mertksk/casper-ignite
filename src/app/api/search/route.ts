import { NextRequest, NextResponse } from "next/server";
import { projectService } from "@/server/services/project-service";
import { searchQuerySchema } from "@/lib/dto";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = searchQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = await projectService.list({
    search: parsed.data.q,
    limit: "5",
  });

  const results = data.items.map((project) => ({
    id: project.id,
    title: project.title,
    tokenSymbol: project.tokenSymbol,
    creatorAddress: project.creatorAddress,
  }));

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "public, max-age=30",
    },
  });
}
