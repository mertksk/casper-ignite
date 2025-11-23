import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bondingCurveService } from "@/server/services/bonding-curve-service";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { checkDeployStatus, sendCSPRTransfer } from "@/lib/casper";
import { prisma } from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const executeSchema = z.object({
  wallet: z.string().min(10),
  tokenAmount: z.number().positive(),
  tokenTransferDeployHash: z.string().min(64),
});

// POST /api/projects/[id]/sell/execute
// Verify token transfer and send CSPR to seller
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

    const { wallet, tokenAmount, tokenTransferDeployHash } = parsed.data;

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

    // Step 1: Verify user's token transfer on-chain
    console.log(`[Sell Execute] Verifying token transfer deploy: ${tokenTransferDeployHash}`);
    const tokenTransferStatus = await checkDeployStatus(tokenTransferDeployHash);

    if (!tokenTransferStatus.executed) {
      return NextResponse.json(
        { error: "Token transfer not yet confirmed on blockchain. Please wait and try again." },
        { status: 400 }
      );
    }

    if (!tokenTransferStatus.success) {
      return NextResponse.json(
        { error: "Token transfer deploy failed on blockchain" },
        { status: 400 }
      );
    }

    // Step 2: Execute bonding curve update in database
    const calculation = await bondingCurveService.executeSell(projectId, tokenAmount);

    // Step 3: Send CSPR from platform wallet to seller
    console.log(`[Sell Execute] Sending ${calculation.proceeds.toFixed(4)} CSPR to ${wallet}`);

    const csprTransferResult = await sendCSPRTransfer({
      toAddress: wallet,
      amountCSPR: calculation.proceeds,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully sold ${tokenAmount} ${project.tokenSymbol} for ${calculation.proceeds.toFixed(4)} CSPR`,
      transaction: {
        tokenTransferDeployHash,
        csprPaymentDeployHash: csprTransferResult.deployHash,
        tokenAmount,
        proceeds: calculation.proceeds,
        newPrice: calculation.newPrice,
      },
      explorerLinks: {
        tokenTransfer: `https://testnet.cspr.live/deploy/${tokenTransferDeployHash}`,
        csprPayment: `https://testnet.cspr.live/deploy/${csprTransferResult.deployHash}`,
      },
    });
  } catch (error) {
    console.error("Sell execute error:", error);
    const message = error instanceof Error ? error.message : "Failed to execute sell";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
