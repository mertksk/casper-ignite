import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createCSPRTransferParams } from "@/lib/casper";
import { appConfig } from "@/lib/config";

const transferSchema = z.object({
  fromPublicKey: z.string().min(1, "From address required"),
  purpose: z.enum(["platform_fee", "liquidity_pool"]),
});

/**
 * POST /api/payments/create-transfer
 * Create an unsigned CSPR transfer deploy
 * The recipient address and amount are determined by the purpose
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = transferSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const { fromPublicKey, purpose } = parsed.data;

    // Determine recipient and amount based on purpose
    const toPublicKey = purpose === "platform_fee"
      ? appConfig.platformAddresses.fee
      : appConfig.platformAddresses.liquidity;

    const amount = purpose === "platform_fee"
      ? appConfig.paymentAmounts.platformFee
      : appConfig.paymentAmounts.liquidityPool;

    // Create transfer deploy parameters
    const { deployJson, deployHash } = createCSPRTransferParams(
      fromPublicKey,
      toPublicKey,
      amount
    );

    return NextResponse.json({
      deployJson,
      deployHash,
      amount,
      purpose,
      from: fromPublicKey,
      to: toPublicKey,
    });
  } catch (error) {
    console.error("Error creating transfer:", error);
    const message = error instanceof Error ? error.message : "Failed to create transfer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
