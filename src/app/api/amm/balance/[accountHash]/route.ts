import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

// GET /api/amm/balance/:accountHash
// Returns the token balance for a given account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountHash: string }> }
) {
  try {
    await enforceRateLimit(request, "amm-query");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const { accountHash } = await params;

    if (!accountHash) {
      return NextResponse.json({ error: "Missing accountHash parameter" }, { status: 400 });
    }

    if (!appConfig.amm.contractHash) {
      return NextResponse.json({
        error: "AMM contract not configured",
        configured: false,
        balance: "0",
      }, { status: 503 });
    }

    const rpcUrl = appConfig.rpcUrls.primary;
    const contractHash = appConfig.amm.contractHash;

    // Normalize account hash (remove account-hash- prefix if present)
    const normalizedHash = accountHash.replace(/^account-hash-/, "");

    // Query the token_balances dictionary for this account
    // The dictionary key is the account hash as a string
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "state_get_dictionary_item",
        params: {
          state_root_hash: null,
          dictionary_identifier: {
            ContractNamedKey: {
              key: contractHash,
              dictionary_name: "token_balances",
              dictionary_item_key: `account-hash-${normalizedHash}`,
            },
          },
        },
      }),
    });

    const data = await response.json();

    // If no entry exists, balance is 0
    if (data.error || !data.result?.stored_value?.CLValue?.parsed) {
      return NextResponse.json({
        accountHash: `account-hash-${normalizedHash}`,
        balance: "0",
        balanceFormatted: "0",
      });
    }

    const balance = data.result.stored_value.CLValue.parsed;
    const balanceNum = BigInt(balance);

    // Format with proper decimals (tokens have 9 decimal places like CSPR)
    const balanceFormatted = (Number(balanceNum) / 1_000_000_000).toFixed(9);

    return NextResponse.json({
      accountHash: `account-hash-${normalizedHash}`,
      balance: balance.toString(),
      balanceFormatted,
    });
  } catch (error) {
    console.error("AMM balance error:", error);
    const message = error instanceof Error ? error.message : "Failed to get balance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
