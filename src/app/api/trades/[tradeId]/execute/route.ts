import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createTokenTransferParams } from "@/lib/casper";

const executeSchema = z.object({
  signedDeployJson: z.string(), // Signed deploy from wallet
});

/**
 * POST /api/trades/[tradeId]/execute
 * Submit a signed token transfer deploy to the blockchain
 * This is called after the user signs the transaction in their wallet
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  const body = await request.json().catch(() => null);
  const parsed = executeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { tradeId } = await params;

  try {
    // Get the trade
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        buyOrder: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    if (trade.status !== "PENDING") {
      return NextResponse.json(
        { error: "Trade already executed or failed" },
        { status: 400 }
      );
    }

    // TODO: Submit the signed deploy to the Casper network
    // For now, we'll just store the deploy hash
    // In production, you would:
    // 1. Parse the signed deploy JSON
    // 2. Submit it to the RPC
    // 3. Get the deploy hash
    // 4. Update the trade with the hash
    // 5. Poll for confirmation

    const mockDeployHash = `trade-${trade.id}-${Date.now()}`;

    // Update trade status
    await prisma.trade.update({
      where: { id: tradeId },
      data: {
        blockchainHash: mockDeployHash,
        status: "EXECUTING",
      },
    });

    // TODO: In production, start a background job to poll for deploy confirmation
    // For now, we'll simulate it

    return NextResponse.json({
      success: true,
      deployHash: mockDeployHash,
      message: "Trade execution initiated",
    });
  } catch (error) {
    console.error("Error executing trade:", error);
    const message = error instanceof Error ? error.message : "Failed to execute trade";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/trades/[tradeId]/execute
 * Get trade execution parameters (unsigned deploy)
 * This is called before signing to prepare the deploy
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tradeId: string }> }
) {
  try {
    const { tradeId } = await params;
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        sellOrder: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    if (trade.status !== "PENDING") {
      return NextResponse.json(
        { error: "Trade not pending execution" },
        { status: 400 }
      );
    }

    const project = trade.sellOrder.project;

    const tokenHashForTransfer = project.tokenPackageHash ?? project.tokenContractHash;

    if (!tokenHashForTransfer) {
      return NextResponse.json(
        { error: "Token contract not deployed" },
        { status: 400 }
      );
    }

    // Create unsigned deploy parameters
    const tokenAmount = (trade.tokenAmount * Math.pow(10, 9)).toString(); // Convert to smallest unit
    const deployParams = createTokenTransferParams(
      tokenHashForTransfer,
      trade.sellerWallet, // From seller
      trade.buyerWallet,  // To buyer
      tokenAmount
    );

    return NextResponse.json({
      trade: {
        id: trade.id,
        tokenAmount: trade.tokenAmount,
        pricePerToken: trade.pricePerToken,
        totalValue: trade.totalValue,
        buyerWallet: trade.buyerWallet,
        sellerWallet: trade.sellerWallet,
        tokenSymbol: project.tokenSymbol,
      },
      deployParams: {
        deployJson: deployParams.deployJson,
        deployHash: deployParams.deployHash,
      },
    });
  } catch (error) {
    console.error("Error creating trade deploy:", error);
    const message = error instanceof Error ? error.message : "Failed to create deploy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
