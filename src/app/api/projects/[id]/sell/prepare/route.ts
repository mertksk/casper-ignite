import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bondingCurveService } from "@/server/services/bonding-curve-service";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { createTokenTransferParams } from "@/lib/casper";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const prepareSchema = z.object({
  wallet: z.string().min(10),
  tokenAmount: z.number().positive(),
});

// POST /api/projects/[id]/sell/prepare
// Prepare unsigned token transfer deploy for user to sign (user → platform)
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params;

  // Rate limiting
  try {
    await enforceRateLimit(request, "bonding-curve-trade");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const body = await request.json();
    const parsed = prepareSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, tokenAmount } = parsed.data;

    // Get the project to find token contract hash
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        tokenContractHash: true,
        tokenStatus: true,
        tokenSymbol: true,
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.tokenStatus !== "DEPLOYED" || !project.tokenContractHash) {
      return NextResponse.json(
        { error: "Token not yet deployed on blockchain" },
        { status: 400 }
      );
    }

    // Get bonding curve quote
    const quote = await bondingCurveService.getInstantSellQuote(projectId, tokenAmount);

    // Convert token amount to smallest unit (9 decimals)
    const tokenAmountInSmallestUnit = (tokenAmount * 1_000_000_000).toString();

    // Create unsigned token transfer deploy (user → platform)
    // User sends tokens to platform wallet
    const deployParams = createTokenTransferParams(
      project.tokenContractHash,
      wallet, // From: seller's wallet
      appConfig.platformAddresses.tokenWallet, // To: platform wallet
      tokenAmountInSmallestUnit
    );

    return NextResponse.json({
      success: true,
      quote,
      tokenTransferDeploy: {
        deployJson: deployParams.deployJson,
        deployHash: deployParams.deployHash,
      },
      tokenSymbol: project.tokenSymbol,
      instructions: {
        step1: `Sign and send ${tokenAmount} ${project.tokenSymbol} tokens to platform`,
        step2: `After confirmation, platform will send ${quote.payout.toFixed(4)} CSPR to your wallet`,
        gasCost: "~3 CSPR for token transfer",
      },
    });
  } catch (error) {
    console.error("Sell prepare error:", error);
    const message = error instanceof Error ? error.message : "Failed to prepare sell transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
