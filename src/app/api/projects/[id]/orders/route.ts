import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import {
  createOrder,
  getOrderBook,
  getUserOrders,
} from "@/server/services/order-matching-service";

const orderCreateSchema = z.object({
  wallet: z.string().min(1, "Wallet address required"),
  side: z.enum(["BUY", "SELL"]),
  tokenAmount: z.number().positive("Token amount must be positive"),
  pricePerToken: z.number().positive("Price must be positive"),
});

/**
 * GET /api/projects/[id]/orders
 * Get order book for a project
 * Optional query param: ?wallet=<address> to filter by user's orders
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  const { id: projectId } = await params;

  try {
    if (wallet) {
      // Get user's orders for this project
      const orders = await getUserOrders(wallet, projectId);
      return NextResponse.json({ orders });
    } else {
      // Get full order book
      const orderBook = await getOrderBook(projectId);
      return NextResponse.json(orderBook);
    }
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/orders
 * Create a new limit order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await enforceRateLimit(request, "project-order");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = orderCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id: projectId } = await params;

  try {
    const order = await createOrder(
      projectId,
      parsed.data.wallet,
      parsed.data.side,
      parsed.data.tokenAmount,
      parsed.data.pricePerToken
    );

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
