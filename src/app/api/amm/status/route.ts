import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

// GET /api/amm/status
// Returns the AMM contract status
export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit(request, "amm-query");
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    if (!appConfig.amm.contractHash) {
      return NextResponse.json({
        configured: false,
        message: "AMM contract not configured",
      });
    }

    const rpcUrl = appConfig.rpcUrls.primary;
    const contractHash = appConfig.amm.contractHash;

    // Query current price
    const priceResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "query_global_state",
        params: {
          state_identifier: null,
          key: contractHash,
          path: ["initial_price"],
        },
      }),
    });

    const priceData = await priceResponse.json();
    const initialPriceMotes = priceData.result?.stored_value?.CLValue?.parsed || "0";

    // Query total supply
    const supplyResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "query_global_state",
        params: {
          state_identifier: null,
          key: contractHash,
          path: ["total_supply"],
        },
      }),
    });

    const supplyData = await supplyResponse.json();
    const totalSupply = supplyData.result?.stored_value?.CLValue?.parsed || "0";

    // Query reserve balance (CSPR)
    // 1. Get the cspr_reserve URef
    const reserveUrefResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "query_global_state",
        params: {
          state_identifier: null,
          key: contractHash,
          path: ["cspr_reserve"],
        },
      }),
    });

    const reserveUrefData = await reserveUrefResponse.json();
    const reserveUref = reserveUrefData.result?.stored_value?.CLValue?.parsed;

    let reserveMotes = "0";

    if (reserveUref) {
      // 2. Get balance of the URef
      // For a purse URef, we need to use query_balance or state_get_balance if we had state root
      // However, query_global_state with the URef key should return the CLValue if it was a stored value,
      // but for a Purse, we specifically need the balance.
      // Let's try query_balance endpoint if available, but query_global_state usually handles URefs for stored values.
      // Wait, a Purse is not a stored value, it's a balance.
      // We often use "state_get_balance" for main purse.
      // For contract purse, let's try reading the URef directly via query_global_state to see if it resolves to a balance
      // (It likely won't, it resolves to the Unit usually or specific data. Balance is separate in the trie).

      // Let's use standard query_balance assuming we can pass the purse URef.
      // NOTE: query_balance requires the main purse URef usually.

      // Attempting to query the balance using "query_balance" method
      const balanceResponse = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "query_balance",
          params: {
            purse_identifier: {
              main_purse_under_uref: reserveUref
            }
          },
        }),
      });

      // If query_balance fails with the above param structure (newer nodes), fallback to simple URef string
      // Actually standard Casper 1.5+ JSON-RPC "query_balance" takes "purse_uref" or "purse_identifier" depending on version.
      // Let's try the most common "purse_uref" param or just "key" in global state if checking balance is supported there.

      // Simpler approach that works on most nodes: query_global_state with key=reserveUref might NOT return balance.
      // Correct approach for integration often involves getting state root first, then state_get_balance.
      // But let's try a direct "query_balance" which handles state root internally or accepts block identifier.

      // Let's use the robust approach: Getting state root hash is expensive/extra call.
      // Let's try "query_balance" with "purse_identifier": { "uref": ... }

      const balanceResponseAttempt = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "query_balance",
          params: {
            purse_identifier: {
              uref: reserveUref
            }
          }
        })
      });

      const balanceData = await balanceResponseAttempt.json();
      if (balanceData.result?.balance) {
        reserveMotes = balanceData.result.balance;
      }
    }

    return NextResponse.json({
      configured: true,
      contractHash: contractHash,
      currentPrice: {
        motes: initialPriceMotes,
        cspr: Number(initialPriceMotes) / 1_000_000_000,
      },
      totalSupply,
      reserve: {
        motes: reserveMotes,
        cspr: Number(reserveMotes) / 1_000_000_000,
      },
      network: appConfig.NEXT_PUBLIC_CHAIN_NAME,
    });
  } catch (error) {
    console.error("AMM status error:", error);
    const message = error instanceof Error ? error.message : "Failed to get AMM status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
