import { NextRequest, NextResponse } from "next/server";

const NODE_URL = process.env.CSPR_RPC_URL_PRIMARY || "https://node.testnet.casper.network/rpc";
const ORDERBOOK_CONTRACT_HASH = process.env.ORDERBOOK_CONTRACT_HASH;

interface Order {
  orderId: string;
  side: "buy" | "sell";
  maker: string;
  price: string;
  amount: string;
  filled: string;
  timestamp: number;
  status: "open" | "partial" | "filled" | "cancelled";
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const depth = parseInt(searchParams.get("depth") || "20");

  if (!ORDERBOOK_CONTRACT_HASH) {
    return NextResponse.json({
      buyOrders: [],
      sellOrders: [],
      error: "Order Book contract not configured",
    });
  }

  try {
    const cleanHash = ORDERBOOK_CONTRACT_HASH.replace("hash-", "");
    const buyOrders: Order[] = [];
    const sellOrders: Order[] = [];

    // Fetch buy orders from dictionary
    // In a real implementation, this would query the buy_orders dictionary
    // For now, return empty arrays as the contract is just deployed

    // Get next_buy_id to know how many orders exist
    const buyIdResponse = await fetch(NODE_URL, {
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

    const buyIdData = await buyIdResponse.json();
    const nextBuyId = buyIdData.result?.stored_value?.CLValue?.parsed
      ? parseInt(buyIdData.result.stored_value.CLValue.parsed)
      : 0;

    // Query individual buy orders (up to depth)
    for (let i = 0; i < Math.min(nextBuyId, depth); i++) {
      try {
        const orderResponse = await fetch(NODE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: i + 10,
            method: "state_get_dictionary_item",
            params: {
              state_identifier: { BlockIdentifier: null },
              state_root_hash: null,
              dictionary_identifier: {
                ContractNamedKey: {
                  key: `hash-${cleanHash}`,
                  dictionary_name: "buy_orders",
                  dictionary_item_key: i.toString(),
                },
              },
            },
          }),
        });

        const orderData = await orderResponse.json();
        if (orderData.result?.stored_value?.CLValue?.parsed) {
          const parsed = orderData.result.stored_value.CLValue.parsed;
          // Parse the order tuple data
          buyOrders.push({
            orderId: i.toString(),
            side: "buy",
            maker: parsed[0] || "",
            price: parsed[1] || "0",
            amount: parsed[2] || "0",
            filled: parsed[3] || "0",
            timestamp: parseInt(parsed[4]) || Date.now(),
            status: "open",
          });
        }
      } catch {
        // Order may not exist or be cancelled
      }
    }

    // Get next_sell_id
    const sellIdResponse = await fetch(NODE_URL, {
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

    const sellIdData = await sellIdResponse.json();
    const nextSellId = sellIdData.result?.stored_value?.CLValue?.parsed
      ? parseInt(sellIdData.result.stored_value.CLValue.parsed)
      : 0;

    // Query individual sell orders (up to depth)
    for (let i = 0; i < Math.min(nextSellId, depth); i++) {
      try {
        const orderResponse = await fetch(NODE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: i + 100,
            method: "state_get_dictionary_item",
            params: {
              state_identifier: { BlockIdentifier: null },
              state_root_hash: null,
              dictionary_identifier: {
                ContractNamedKey: {
                  key: `hash-${cleanHash}`,
                  dictionary_name: "sell_orders",
                  dictionary_item_key: i.toString(),
                },
              },
            },
          }),
        });

        const orderData = await orderResponse.json();
        if (orderData.result?.stored_value?.CLValue?.parsed) {
          const parsed = orderData.result.stored_value.CLValue.parsed;
          sellOrders.push({
            orderId: i.toString(),
            side: "sell",
            maker: parsed[0] || "",
            price: parsed[1] || "0",
            amount: parsed[2] || "0",
            filled: parsed[3] || "0",
            timestamp: parseInt(parsed[4]) || Date.now(),
            status: "open",
          });
        }
      } catch {
        // Order may not exist or be cancelled
      }
    }

    // Sort orders: buys descending by price, sells ascending by price
    buyOrders.sort((a, b) => Number(BigInt(b.price) - BigInt(a.price)));
    sellOrders.sort((a, b) => Number(BigInt(a.price) - BigInt(b.price)));

    // Calculate spread and mid price
    let spread = undefined;
    let midPrice = undefined;

    if (buyOrders.length > 0 && sellOrders.length > 0) {
      const bestBid = BigInt(buyOrders[0].price);
      const bestAsk = BigInt(sellOrders[0].price);
      const spreadMotes = bestAsk - bestBid;
      const midMotes = (bestBid + bestAsk) / BigInt(2);

      spread = {
        motes: spreadMotes.toString(),
        cspr: Number(spreadMotes) / 1_000_000_000,
      };
      midPrice = {
        motes: midMotes.toString(),
        cspr: Number(midMotes) / 1_000_000_000,
      };
    }

    return NextResponse.json({
      buyOrders,
      sellOrders,
      spread,
      midPrice,
    });
  } catch (error) {
    console.error("Error fetching order book:", error);
    return NextResponse.json(
      {
        buyOrders: [],
        sellOrders: [],
        error: "Failed to fetch order book",
      },
      { status: 500 }
    );
  }
}
