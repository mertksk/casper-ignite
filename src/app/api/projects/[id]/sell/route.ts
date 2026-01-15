import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bondingCurveService } from "@/server/services/bonding-curve-service";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { getTokenBalance, sendCSPRTransfer, waitForDeploy } from "@/lib/casper";
import { prisma } from "@/lib/db";
import { rollbackService } from "@/server/services/rollback-service";
import { tradingLogger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const sellSchema = z.object({
  wallet: z.string().min(10),
  tokenAmount: z.coerce.number().positive(),
  maxSlippage: z.number().min(0).max(100).optional().default(5), // Default 5% slippage tolerance
  idempotencyKey: z.string().optional(), // Prevent duplicate trades
});

// In-memory idempotency cache (production should use Redis)
const idempotencyCache = new Map<string, { timestamp: number; response: unknown }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes

// POST /api/projects/[id]/sell
// Execute instant sell to bonding curve with blockchain integration
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
    const parsed = sellSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { wallet, tokenAmount, maxSlippage, idempotencyKey } = parsed.data;

    // Idempotency check
    if (idempotencyKey) {
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL_MS) {
        console.log(`[Sell] Idempotency hit for key ${idempotencyKey}`);
        return NextResponse.json(cached.response);
      }
    }

    // Get project details
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        tokenContractHash: true,
        tokenPackageHash: true,
        tokenSymbol: true,
        title: true,
      },
    });

    if (!project || !project.tokenContractHash) {
      return NextResponse.json(
        { error: "Project not found or token not deployed" },
        { status: 404 }
      );
    }

    // Balance check: Verify user has enough tokens
    const userBalanceRaw = await getTokenBalance(
      project.tokenContractHash,
      wallet
    );
    const userBalance = Number(userBalanceRaw) / 1_000_000_000; // Convert from smallest unit (9 decimals)

    if (userBalance < tokenAmount) {
      return NextResponse.json(
        {
          error: `Insufficient token balance. You have ${userBalance.toFixed(2)} ${project.tokenSymbol}, but trying to sell ${tokenAmount}`,
          balance: userBalance,
        },
        { status: 400 }
      );
    }

    // Get quote to calculate CSPR proceeds
    const quote = await bondingCurveService.getInstantSellQuote(projectId, tokenAmount);

    // Slippage protection: Check if price impact exceeds user's tolerance
    if (quote.priceImpact > maxSlippage) {
      return NextResponse.json(
        {
          error: `Price impact (${quote.priceImpact.toFixed(2)}%) exceeds maximum slippage (${maxSlippage}%). Please reduce order size or increase slippage tolerance.`,
          quote,
        },
        { status: 400 }
      );
    }

    tradingLogger.logTrade("SELL", projectId, wallet, tokenAmount, quote.payout);

    // TODO: Receive tokens from user to platform wallet
    // For now, we'll trust the balance check and proceed optimistically
    // In full production, we'd need user to sign a CEP-18 transfer to platform wallet first

    // Execute sell (updates database and bonding curve)
    const result = await bondingCurveService.executeSell(projectId, tokenAmount);

    // Send CSPR from platform wallet to seller
    const transferResult = await sendCSPRTransfer({
      toAddress: wallet,
      amountCSPR: result.proceeds,
    });

    tradingLogger.info("CSPR transfer initiated", { projectId, deployHash: transferResult.deployHash, userId: wallet });

    // Wait for blockchain confirmation (with 5-minute timeout)
    const confirmed = await waitForDeploy(transferResult.deployHash, 300_000);

    if (!confirmed.success) {
      console.error(`[Sell] CRITICAL - CSPR transfer failed for deploy ${transferResult.deployHash}`);

      // Rollback database changes and bonding curve
      try {
        await rollbackService.rollbackSell({
          projectId,
          tokenAmount,
          proceeds: result.proceeds,
          deployHash: transferResult.deployHash,
          reason: confirmed.error || "CSPR transfer failed on blockchain",
        });

        console.log(`[Sell] Rollback completed successfully for failed transfer ${transferResult.deployHash}`);
      } catch (rollbackError) {
        console.error(`[Sell] CRITICAL - Rollback failed:`, rollbackError);
        // Alert sent by rollback service
      }

      return NextResponse.json(
        {
          error: `CSPR transfer failed on blockchain. Transaction has been rolled back. Deploy hash: ${transferResult.deployHash}`,
          deployHash: transferResult.deployHash,
          rolledBack: true,
        },
        { status: 500 }
      );
    }

    tradingLogger.info(`Sell transaction successful - ${result.proceeds.toFixed(4)} CSPR sent`, {
      projectId,
      userId: wallet,
      deployHash: transferResult.deployHash
    });

    const response = {
      success: true,
      quote,
      result: {
        ...result,
        deployHash: transferResult.deployHash,
      },
      message: `Successfully sold ${tokenAmount} ${project.tokenSymbol} for ${result.proceeds.toFixed(4)} CSPR`,
      deployHash: transferResult.deployHash,
      explorerUrl: `https://testnet.cspr.live/deploy/${transferResult.deployHash}`,
    };

    // Cache response for idempotency
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, { timestamp: Date.now(), response });

      // Clean up old entries
      for (const [key, value] of idempotencyCache.entries()) {
        if (Date.now() - value.timestamp > IDEMPOTENCY_TTL_MS) {
          idempotencyCache.delete(key);
        }
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("Sell error:", error);
    const message = error instanceof Error ? error.message : "Failed to execute sell";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
