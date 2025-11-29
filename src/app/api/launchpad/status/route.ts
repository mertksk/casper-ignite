import { NextResponse } from "next/server";

const NODE_URL = process.env.CSPR_RPC_URL_PRIMARY || "https://node.testnet.casper.network/rpc";
const LAUNCHPAD_CONTRACT_HASH = process.env.LAUNCHPAD_CONTRACT_HASH;

export async function GET() {
  if (!LAUNCHPAD_CONTRACT_HASH) {
    return NextResponse.json({
      configured: false,
      error: "Launchpad contract not configured",
    });
  }

  try {
    // Query contract state
    const cleanHash = LAUNCHPAD_CONTRACT_HASH.replace("hash-", "");

    // Get platform_fee_bps from contract
    const stateResponse = await fetch(NODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "query_global_state",
        params: {
          state_identifier: { BlockIdentifier: null },
          key: `hash-${cleanHash}`,
          path: ["platform_fee_bps"],
        },
      }),
    });

    const stateData = await stateResponse.json();
    let platformFeeBps = 500; // Default 5%

    if (stateData.result?.stored_value?.CLValue?.parsed) {
      platformFeeBps = parseInt(stateData.result.stored_value.CLValue.parsed);
    }

    // Get project count
    const countResponse = await fetch(NODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "query_global_state",
        params: {
          state_identifier: { BlockIdentifier: null },
          key: `hash-${cleanHash}`,
          path: ["project_count"],
        },
      }),
    });

    const countData = await countResponse.json();
    let projectCount = 0;

    if (countData.result?.stored_value?.CLValue?.parsed) {
      projectCount = parseInt(countData.result.stored_value.CLValue.parsed);
    }

    return NextResponse.json({
      configured: true,
      contractHash: LAUNCHPAD_CONTRACT_HASH,
      platformFeeBps,
      projectCount,
      network: process.env.NEXT_PUBLIC_CHAIN_NAME || "casper-test",
    });
  } catch (error) {
    console.error("Error fetching launchpad status:", error);
    return NextResponse.json(
      {
        configured: true,
        contractHash: LAUNCHPAD_CONTRACT_HASH,
        error: "Failed to fetch contract state",
      },
      { status: 500 }
    );
  }
}
