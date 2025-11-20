import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTokenDeployParams } from "@/lib/casper";

const deploySchema = z.object({
  projectName: z.string().min(3).max(120),
  symbol: z.string().min(3).max(8).regex(/^[A-Z0-9]+$/),
  totalSupply: z.number().int().positive(),
  creatorPublicKey: z.string().min(1),
  decimals: z.number().int().min(0).max(18).optional(),
});

/**
 * POST /api/tokens/deploy
 * Create an unsigned CEP-18 token deployment
 * Frontend will sign this with the user's wallet
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = deploySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const deployParams = createTokenDeployParams(parsed.data);

    return NextResponse.json({
      deployJson: deployParams.deployJson,
      deployHash: deployParams.deployHash,
      tokenInfo: {
        name: deployParams.name,
        symbol: deployParams.symbol,
        totalSupply: deployParams.totalSupply,
        decimals: deployParams.decimals,
      },
    });
  } catch (error) {
    console.error("Error creating token deploy:", error);
    const message = error instanceof Error ? error.message : "Failed to create deploy";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
