import { NextRequest, NextResponse } from "next/server";
import { getRecentTrades } from "@/server/services/order-matching-service";

/**
 * GET /api/projects/[id]/trades
 * Get recent trades for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const { id: projectId } = await params;

  try {
    const trades = await getRecentTrades(projectId, limit);
    return NextResponse.json({ trades });
  } catch (error) {
    console.error("Error fetching trades:", error);
    return NextResponse.json(
      { error: "Failed to fetch trades" },
      { status: 500 }
    );
  }
}
