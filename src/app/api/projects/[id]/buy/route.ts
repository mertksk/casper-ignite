import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { bondingCurveService } from "@/server/services/bonding-curve-service";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { sendTokenTransfer, waitForDeploy } from "@/lib/casper";
import { prisma } from "@/lib/db";
import { rollbackService } from "@/server/services/rollback-service";
import { tradingLogger } from "@/lib/logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const buySchema = z.object({
  wallet: z.string().min(10),
  tokenAmount: z.number().positive(),
  maxSlippage: z.number().min(0).max(100).optional().default(5), // Default 5% slippage tolerance
  idempotencyKey: z.string().optional(), // Prevent duplicate trades
});

// In-memory idempotency cache (production should use Redis)
const idempotencyCache = new Map<string, { timestamp: number; response: unknown }>();
const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000; // 10 minutes

// POST /api/projects/[id]/buy
// Execute instant buy from bonding curve with blockchain integration
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
    const parsed = buySchema.safeParse(body);

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
        console.log(`[Buy] Idempotency hit for key ${idempotencyKey}`);
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

    // Get quote to calculate required CSPR
    const quote = await bondingCurveService.getInstantBuyQuote(projectId, tokenAmount);

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

    // TODO: Verify user has enough CSPR balance (requires signature to verify ownership)
    // For now, we'll proceed optimistically and let blockchain reject if insufficient funds

    tradingLogger.logTrade("BUY", projectId, wallet, tokenAmount, quote.cost);

    // Execute purchase (updates database and bonding curve)
    const result = await bondingCurveService.executePurchase(projectId, tokenAmount);

    // Send tokens from platform wallet to buyer
    const transferResult = await sendTokenTransfer({
      projectId,
      tokenContractHash: project.tokenContractHash,
      toAddress: wallet,
      tokenAmount,
    });

    tradingLogger.info("Token transfer initiated", { projectId, deployHash: transferResult.deployHash, userId: wallet });

    // Wait for blockchain confirmation (with 5-minute timeout)
    const confirmed = await waitForDeploy(transferResult.deployHash, 300_000);

    if (!confirmed.success) {
      console.error(`[Buy] CRITICAL - Token transfer failed for deploy ${transferResult.deployHash}`);

      // Rollback database changes and bonding curve
      try {
        await rollbackService.rollbackBuy({
          projectId,
          tokenAmount,
          cost: result.cost,
          deployHash: transferResult.deployHash,
          reason: confirmed.error || "Token transfer failed on blockchain",
        });

        console.log(`[Buy] Rollback completed successfully for failed transfer ${transferResult.deployHash}`);
      } catch (rollbackError) {
        console.error(`[Buy] CRITICAL - Rollback failed:`, rollbackError);
        // Alert sent by rollback service
      }

      return NextResponse.json(
        {
          error: `Token transfer failed on blockchain. Transaction has been rolled back. Deploy hash: ${transferResult.deployHash}`,
          deployHash: transferResult.deployHash,
          rolledBack: true,
        },
        { status: 500 }
      );
    }

    tradingLogger.info(`Buy transaction successful - ${tokenAmount} ${project.tokenSymbol} tokens sent`, {
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
      message: `Successfully purchased ${tokenAmount} ${project.tokenSymbol} for ${result.cost.toFixed(4)} CSPR`,
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
    console.error("Buy error:", error);
    const message = error instanceof Error ? error.message : "Failed to execute buy";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
