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

    return NextResponse.json({
      configured: true,
      contractHash: contractHash,
      currentPrice: {
        motes: initialPriceMotes,
        cspr: Number(initialPriceMotes) / 1_000_000_000,
      },
      totalSupply,
      network: appConfig.NEXT_PUBLIC_CHAIN_NAME,
    });
  } catch (error) {
    console.error("AMM status error:", error);
    const message = error instanceof Error ? error.message : "Failed to get AMM status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
