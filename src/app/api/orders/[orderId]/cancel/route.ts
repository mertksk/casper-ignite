import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cancelOrder } from "@/server/services/order-matching-service";

const cancelSchema = z.object({
  wallet: z.string().min(1, "Wallet address required"),
});

/**
 * POST /api/orders/[orderId]/cancel
 * Cancel an open order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const body = await request.json().catch(() => null);
  const parsed = cancelSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orderId } = await params;

  try {
    await cancelOrder(orderId, parsed.data.wallet);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
