import { NextRequest, NextResponse } from "next/server";
import { getVaultBalance } from "@/lib/vault";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { appConfig } from "@/lib/config";

// GET /api/vault/status
// Returns the vault contract status and total balance
export async function GET(request: NextRequest) {
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
      return NextResponse.json({
        configured: false,
        message: "Token Vault contract not configured",
      });
    }

    // Get vault balance
    const balance = await getVaultBalance();

    return NextResponse.json({
      configured: true,
      accountHash: appConfig.vault.accountHash,
      contractHash: appConfig.vault.contractHash,
      balance: {
        motes: balance.balanceMotes,
        cspr: balance.balanceCSPR,
      },
      network: appConfig.NEXT_PUBLIC_CHAIN_NAME,
    });
  } catch (error) {
    console.error("Vault status error:", error);
    const message = error instanceof Error ? error.message : "Failed to get vault status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
