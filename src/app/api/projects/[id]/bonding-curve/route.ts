import { NextRequest, NextResponse } from "next/server";
import { bondingCurveService } from "@/server/services/bonding-curve-service";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET /api/projects/[id]/bonding-curve
// Returns current bonding curve state and price
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params;

  try {
    const curveInfo = await bondingCurveService.getCurveInfo(projectId);
    return NextResponse.json(curveInfo);
  } catch (error) {
    console.error("Error fetching bonding curve:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch bonding curve";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// POST /api/projects/[id]/bonding-curve/quote
// Get instant buy or sell quote
const quoteSchema = z.object({
  type: z.enum(["buy", "sell"]),
  tokenAmount: z.coerce.number().positive(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params;

  try {
    const body = await request.json();
    const parsed = quoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { type, tokenAmount } = parsed.data;

    if (type === "buy") {
      const quote = await bondingCurveService.getInstantBuyQuote(projectId, tokenAmount);
      return NextResponse.json(quote);
    } else {
      const quote = await bondingCurveService.getInstantSellQuote(projectId, tokenAmount);
      return NextResponse.json(quote);
    }
  } catch (error) {
    console.error("Error getting quote:", error);
    const message = error instanceof Error ? error.message : "Failed to get quote";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
