import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

// GET /api/amm/quote/buy?amount=<tokenAmount>
// Returns the cost to buy a given amount of tokens
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
    const searchParams = request.nextUrl.searchParams;
    const amountStr = searchParams.get("amount");

    if (!amountStr) {
      return NextResponse.json({ error: "Missing amount parameter" }, { status: 400 });
    }

    const tokenAmount = BigInt(amountStr);
    if (tokenAmount <= BigInt(0)) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    if (!appConfig.amm.contractHash) {
      return NextResponse.json({
        error: "AMM contract not configured",
        configured: false,
      }, { status: 503 });
    }

    const rpcUrl = appConfig.rpcUrls.primary;
    const contractHash = appConfig.amm.contractHash;

    // Query contract state for pricing parameters
    const [supplyResponse, priceResponse, ratioResponse] = await Promise.all([
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "query_global_state",
          params: {
            state_identifier: null,
            key: contractHash,
            path: ["total_supply"],
          },
        }),
      }),
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "query_global_state",
          params: {
            state_identifier: null,
            key: contractHash,
            path: ["initial_price"],
          },
        }),
      }),
      fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "query_global_state",
          params: {
            state_identifier: null,
            key: contractHash,
            path: ["reserve_ratio"],
          },
        }),
      }),
    ]);

    const [supplyData, priceData, ratioData] = await Promise.all([
      supplyResponse.json(),
      priceResponse.json(),
      ratioResponse.json(),
    ]);

    const totalSupply = BigInt(supplyData.result?.stored_value?.CLValue?.parsed || "0");
    const initialPrice = BigInt(priceData.result?.stored_value?.CLValue?.parsed || "0");
    const reserveRatio = BigInt(ratioData.result?.stored_value?.CLValue?.parsed || "0");

    // Calculate buy cost using bonding curve integration
    // Cost = initialPrice × amount + slope × (S2² - S1²) / 2
    // slope_numerator = initialPrice × reserveRatio
    const SCALE = BigInt(1_000_000_000);
    const slopeNumerator = initialPrice * reserveRatio;

    // Linear cost: initialPrice × amount
    const linearCost = initialPrice * tokenAmount;

    // Quadratic cost: slope × (S2² - S1²) / 2
    const s1 = totalSupply;
    const s2 = totalSupply + tokenAmount;
    const s2Squared = s2 * s2;
    const s1Squared = s1 * s1;
    const diffSquared = s2Squared - s1Squared;

    // quadraticCost = slopeNumerator × diffSquared / (20000 × SCALE)
    const quadraticCost = (slopeNumerator * diffSquared) / (BigInt(20000) * SCALE);

    const totalCostMotes = linearCost + quadraticCost;
    const totalCostCSPR = Number(totalCostMotes) / 1_000_000_000;

    // Calculate current price at supply
    const currentPriceMotes = initialPrice + (slopeNumerator * totalSupply / BigInt(10000)) / SCALE;
    const currentPriceCSPR = Number(currentPriceMotes) / 1_000_000_000;

    // Calculate price per token for this trade
    const pricePerToken = totalCostCSPR / Number(tokenAmount);

    // Calculate price impact
    const priceImpact = currentPriceCSPR > 0
      ? ((pricePerToken - currentPriceCSPR) / currentPriceCSPR) * 100
      : 0;

    return NextResponse.json({
      tokenAmount: tokenAmount.toString(),
      estimatedCost: {
        motes: totalCostMotes.toString(),
        cspr: totalCostCSPR,
      },
      pricePerToken,
      currentPrice: currentPriceCSPR,
      priceImpact,
      supply: totalSupply.toString(),
    });
  } catch (error) {
    console.error("AMM buy quote error:", error);
    const message = error instanceof Error ? error.message : "Failed to get buy quote";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
