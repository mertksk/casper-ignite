import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bondingCurveService } from "@/server/services/bonding-curve-service";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { createCSPRTransferParams } from "@/lib/casper";
import { appConfig } from "@/lib/config";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const prepareSchema = z.object({
  wallet: z.string().min(10),
  tokenAmount: z.number().positive(),
});

// POST /api/projects/[id]/buy/prepare
// Prepare unsigned CSPR payment deploy for user to sign
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

    // Get the project to verify token is deployed
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
    const quote = await bondingCurveService.getInstantBuyQuote(projectId, tokenAmount);

    // Create unsigned CSPR transfer deploy (user → platform)
    // User pays the cost in CSPR to the platform wallet
    const deployParams = createCSPRTransferParams(
      wallet, // From: buyer's wallet
      appConfig.platformAddresses.tokenWallet, // To: platform wallet
      quote.cost // Amount in CSPR
    );

    return NextResponse.json({
      success: true,
      quote,
      paymentDeploy: {
        deployJson: deployParams.deployJson,
        deployHash: deployParams.deployHash,
      },
      tokenSymbol: project.tokenSymbol,
      instructions: {
        step1: `Sign and send ${quote.cost.toFixed(4)} CSPR payment`,
        step2: `After confirmation, platform will send ${tokenAmount} ${project.tokenSymbol} tokens`,
        totalCost: `${quote.cost.toFixed(4)} CSPR + ~0.1 CSPR gas`,
      },
    });
  } catch (error) {
    console.error("Buy prepare error:", error);
    const message = error instanceof Error ? error.message : "Failed to prepare buy transaction";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
