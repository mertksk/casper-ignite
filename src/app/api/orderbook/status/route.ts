import { NextResponse } from "next/server";

const NODE_URL = process.env.CSPR_RPC_URL_PRIMARY || "https://node.testnet.casper.network/rpc";
const ORDERBOOK_CONTRACT_HASH = process.env.ORDERBOOK_CONTRACT_HASH;

export async function GET() {
  if (!ORDERBOOK_CONTRACT_HASH) {
    return NextResponse.json({
      configured: false,
      error: "Order Book contract not configured",
    });
  }

  try {
    const cleanHash = ORDERBOOK_CONTRACT_HASH.replace("hash-", "");

    // Get buy order count
    const buyCountResponse = await fetch(NODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "query_global_state",
        params: {
          state_identifier: { BlockIdentifier: null },
          key: `hash-${cleanHash}`,
          path: ["next_buy_id"],
        },
      }),
    });

    const buyCountData = await buyCountResponse.json();
    let buyOrderCount = 0;

    if (buyCountData.result?.stored_value?.CLValue?.parsed) {
      buyOrderCount = parseInt(buyCountData.result.stored_value.CLValue.parsed);
    }

    // Get sell order count
    const sellCountResponse = await fetch(NODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "query_global_state",
        params: {
          state_identifier: { BlockIdentifier: null },
          key: `hash-${cleanHash}`,
          path: ["next_sell_id"],
        },
      }),
    });

    const sellCountData = await sellCountResponse.json();
    let sellOrderCount = 0;

    if (sellCountData.result?.stored_value?.CLValue?.parsed) {
      sellOrderCount = parseInt(sellCountData.result.stored_value.CLValue.parsed);
    }

    return NextResponse.json({
      configured: true,
      contractHash: ORDERBOOK_CONTRACT_HASH,
      buyOrderCount,
      sellOrderCount,
      network: process.env.NEXT_PUBLIC_CHAIN_NAME || "casper-test",
    });
  } catch (error) {
    console.error("Error fetching orderbook status:", error);
    return NextResponse.json(
      {
        configured: true,
        contractHash: ORDERBOOK_CONTRACT_HASH,
        error: "Failed to fetch contract state",
      },
      { status: 500 }
    );
  }
}
