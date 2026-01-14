import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";

// GET /api/amm/quote/buy-with-cspr?cspr=<csprAmount>
// Returns how many tokens you get for a given CSPR amount
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
    const csprStr = searchParams.get("cspr");

    if (!csprStr) {
      return NextResponse.json({ error: "Missing cspr parameter" }, { status: 400 });
    }

    const csprAmount = parseFloat(csprStr);
    if (csprAmount <= 0 || isNaN(csprAmount)) {
      return NextResponse.json({ error: "CSPR amount must be positive" }, { status: 400 });
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

    const totalSupply = Number(supplyData.result?.stored_value?.CLValue?.parsed || "0");
    const initialPriceMotes = Number(priceData.result?.stored_value?.CLValue?.parsed || "0");
    const reserveRatio = Number(ratioData.result?.stored_value?.CLValue?.parsed || "0");

    // Convert CSPR to motes for calculation
    const budgetMotes = csprAmount * 1_000_000_000;

    // Current price per token (in motes)
    const currentPriceMotes = initialPriceMotes + (initialPriceMotes * reserveRatio * totalSupply) / 10000;
    const currentPriceCSPR = currentPriceMotes / 1_000_000_000;

    // Contract formula with SCALE division:
    // Cost = (initialPrice * amount) / SCALE + slope * (S2² - S1²) / (20000 * SCALE)
    // where slope = initialPrice * reserveRatio, SCALE = 1e9
    //
    // Solving for tokenAmount given budgetMotes:
    // budgetMotes * SCALE = initialPrice * n + slope * (2Sn + n²) / 20000
    // (slope/20000) * n² + (initialPrice + slope*2S/20000) * n - budget*SCALE = 0

    const SCALE = 1_000_000_000;
    const slope = initialPriceMotes * reserveRatio;
    const a = slope / 20000;
    const b = initialPriceMotes + (slope * 2 * totalSupply) / 20000;
    const c = -budgetMotes;  // Matches contract formula (no SCALE division)

    let tokenAmount: number;

    if (a === 0 || reserveRatio === 0) {
      // Pure linear pricing: cost = (initialPrice * n) / SCALE
      // n = (budget * SCALE) / initialPrice
      tokenAmount = (budgetMotes * SCALE) / initialPriceMotes;
    } else {
      // Solve quadratic: n = (-b + sqrt(b² - 4ac)) / 2a
      const discriminant = b * b - 4 * a * c;
      if (discriminant < 0) {
        return NextResponse.json({ error: "Invalid calculation" }, { status: 400 });
      }
      tokenAmount = (-b + Math.sqrt(discriminant)) / (2 * a);
    }

    // Round down to whole tokens
    tokenAmount = Math.floor(tokenAmount);

    if (tokenAmount <= 0) {
      return NextResponse.json({
        error: "CSPR amount too small to buy any tokens",
        minimumCSPR: currentPriceCSPR
      }, { status: 400 });
    }

    // Calculate actual cost for this token amount (matches contract formula)
    const s1 = totalSupply;
    const s2 = totalSupply + tokenAmount;
    const linearCost = (initialPriceMotes * tokenAmount);
    const quadraticCost = (slope * (s2 * s2 - s1 * s1)) / 20000;
    const actualCostMotes = linearCost + quadraticCost;
    const actualCostCSPR = actualCostMotes / 1_000_000_000;

    // Price per token for this trade
    const pricePerToken = actualCostCSPR / tokenAmount;

    // Calculate new price after purchase
    const newPriceMotes = initialPriceMotes + (slope * s2) / 10000;
    const newPriceCSPR = newPriceMotes / 1_000_000_000;

    // Price impact
    const priceImpact = currentPriceCSPR > 0
      ? ((newPriceCSPR - currentPriceCSPR) / currentPriceCSPR) * 100
      : 0;

    return NextResponse.json({
      csprAmount,
      tokenAmount,
      actualCost: {
        motes: Math.round(actualCostMotes).toString(),
        cspr: actualCostCSPR,
      },
      pricePerToken,
      currentPrice: currentPriceCSPR,
      priceImpact,
      supply: totalSupply.toString(),
    });
  } catch (error) {
    console.error("AMM buy-with-cspr quote error:", error);
    const message = error instanceof Error ? error.message : "Failed to get quote";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
