import { NextRequest, NextResponse } from "next/server";
import { getLockedAmount, orderExists } from "@/lib/vault";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { appConfig } from "@/lib/config";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

// GET /api/vault/orders/[orderId]
// Returns the locked CSPR amount for a specific order
export async function GET(request: NextRequest, context: RouteContext) {
  const { orderId } = await context.params;

  // Rate limiting
  try {
    await enforceRateLimit(request, "vault-query");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    // Check if vault is configured
    if (!appConfig.vault.accountHash) {
      return NextResponse.json(
        { error: "Token Vault contract not configured" },
        { status: 503 }
      );
    }

    // Check if order exists
    const exists = await orderExists(orderId);
    if (!exists) {
      return NextResponse.json(
        { error: "Order not found in vault", orderId },
        { status: 404 }
      );
    }

    // Get locked amount
    const locked = await getLockedAmount(orderId);

    return NextResponse.json({
      orderId,
      locked: {
        motes: locked.amountMotes,
        cspr: locked.amountCSPR,
      },
      vaultAccountHash: appConfig.vault.accountHash,
    });
  } catch (error) {
    console.error("Vault order query error:", error);
    const message = error instanceof Error ? error.message : "Failed to query order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
