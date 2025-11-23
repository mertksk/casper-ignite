import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bondingCurveService } from "@/server/services/bonding-curve-service";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { checkDeployStatus, sendTokenTransfer } from "@/lib/casper";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const executeSchema = z.object({
  wallet: z.string().min(10),
  tokenAmount: z.number().positive(),
  paymentDeployHash: z.string().min(64),
});

// POST /api/projects/[id]/buy/execute
// Verify CSPR payment and send tokens to buyer
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
    const parsed = executeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, tokenAmount, paymentDeployHash } = parsed.data;

    // Get the project
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
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

    // Step 1: Verify user's CSPR payment on-chain
    console.log(`[Buy Execute] Verifying payment deploy: ${paymentDeployHash}`);
    const paymentStatus = await checkDeployStatus(paymentDeployHash);

    if (!paymentStatus.executed) {
      return NextResponse.json(
        { error: "Payment not yet confirmed on blockchain. Please wait and try again." },
        { status: 400 }
      );
    }

    if (!paymentStatus.success) {
      return NextResponse.json(
        { error: "Payment deploy failed on blockchain" },
        { status: 400 }
      );
    }

    // Step 2: Execute bonding curve update in database
    const calculation = await bondingCurveService.executePurchase(projectId, tokenAmount);

    // Step 3: Send tokens from platform wallet to buyer
    console.log(`[Buy Execute] Sending ${tokenAmount} tokens to ${wallet}`);

    const tokenTransferResult = await sendTokenTransfer({
      projectId,
      tokenContractHash: project.tokenContractHash,
      toAddress: wallet,
      tokenAmount,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${tokenAmount} ${project.tokenSymbol} for ${calculation.cost.toFixed(4)} CSPR`,
      transaction: {
        paymentDeployHash,
        tokenTransferDeployHash: tokenTransferResult.deployHash,
        tokenAmount,
        cost: calculation.cost,
        newPrice: calculation.newPrice,
      },
      explorerLinks: {
        payment: `https://testnet.cspr.live/deploy/${paymentDeployHash}`,
        tokenTransfer: `https://testnet.cspr.live/deploy/${tokenTransferResult.deployHash}`,
      },
    });
  } catch (error) {
    console.error("Buy execute error:", error);
    const message = error instanceof Error ? error.message : "Failed to execute buy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
