import "server-only";
import { prisma } from "@/lib/db";
import type { OrderSide, OrderStatus } from "@prisma/client";

type Order = {
  id: string;
  projectId: string;
  wallet: string;
  side: OrderSide;
  tokenAmount: number;
  pricePerToken: number;
  filledAmount: number;
  status: OrderStatus;
  createdAt: Date;
};

type Trade = {
  projectId: string;
  buyOrderId: string;
  sellOrderId: string;
  buyerWallet: string;
  sellerWallet: string;
  tokenAmount: number;
  pricePerToken: number;
  totalValue: number;
};

/**
 * Create a new limit order in the order book
 */
export async function createOrder(
  projectId: string,
  wallet: string,
  side: OrderSide,
  tokenAmount: number,
  pricePerToken: number
) {
  // Validate inputs
  if (tokenAmount <= 0) {
    throw new Error("Token amount must be positive");
  }
  if (pricePerToken <= 0) {
    throw new Error("Price must be positive");
  }

  // Create the order
  const order = await prisma.projectOrder.create({
    data: {
      projectId,
      wallet,
      side,
      tokenAmount,
      pricePerToken,
      filledAmount: 0,
      status: "OPEN",
    },
  });

  // Try to match immediately
  await matchOrders(projectId);

  return order;
}

/**
 * Match orders for a specific project using price-time priority
 * This is the core matching algorithm (similar to Binance)
 */
export async function matchOrders(projectId: string): Promise<void> {
  // Get all open buy orders (sorted by price DESC, then time ASC)
  const buyOrders = await prisma.projectOrder.findMany({
    where: {
      projectId,
      side: "BUY",
      status: {
        in: ["OPEN", "PARTIALLY_FILLED"],
      },
    },
    orderBy: [
      { pricePerToken: "desc" }, // Best price first
      { createdAt: "asc" },       // Oldest first (FIFO)
    ],
  });

  // Get all open sell orders (sorted by price ASC, then time ASC)
  const sellOrders = await prisma.projectOrder.findMany({
    where: {
      projectId,
      side: "SELL",
      status: {
        in: ["OPEN", "PARTIALLY_FILLED"],
      },
    },
    orderBy: [
      { pricePerToken: "asc" },  // Best price first
      { createdAt: "asc" },      // Oldest first (FIFO)
    ],
  });

  const matches: Trade[] = [];

  let buyIndex = 0;
  let sellIndex = 0;

  // Price-time priority matching algorithm
  while (buyIndex < buyOrders.length && sellIndex < sellOrders.length) {
    const buyOrder = buyOrders[buyIndex];
    const sellOrder = sellOrders[sellIndex];

    // Check if prices cross (buy price >= sell price)
    if (buyOrder.pricePerToken < sellOrder.pricePerToken) {
      // No more matches possible
      break;
    }

    // Calculate remaining amounts
    const buyRemaining = buyOrder.tokenAmount - buyOrder.filledAmount;
    const sellRemaining = sellOrder.tokenAmount - sellOrder.filledAmount;

    // Match quantity is the minimum of the two
    const matchAmount = Math.min(buyRemaining, sellRemaining);

    // Execution price is the maker's price (older order gets their price)
    // In a real exchange, this would be more sophisticated
    const executionPrice =
      buyOrder.createdAt < sellOrder.createdAt
        ? buyOrder.pricePerToken
        : sellOrder.pricePerToken;

    // Create trade record
    matches.push({
      projectId,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      buyerWallet: buyOrder.wallet,
      sellerWallet: sellOrder.wallet,
      tokenAmount: matchAmount,
      pricePerToken: executionPrice,
      totalValue: matchAmount * executionPrice,
    });

    // Update filled amounts locally (for this matching session)
    buyOrder.filledAmount += matchAmount;
    sellOrder.filledAmount += matchAmount;

    // Move to next order if this one is fully filled
    if (buyOrder.filledAmount >= buyOrder.tokenAmount) {
      buyIndex++;
    }
    if (sellOrder.filledAmount >= sellOrder.tokenAmount) {
      sellIndex++;
    }
  }

  // Execute all matches in a transaction
  if (matches.length > 0) {
    await executeMatches(matches);
  }
}

/**
 * Execute matched trades and update order statuses
 */
async function executeMatches(matches: Trade[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const match of matches) {
      // Create trade record
      await tx.trade.create({
        data: {
          projectId: match.projectId,
          buyOrderId: match.buyOrderId,
          sellOrderId: match.sellOrderId,
          buyerWallet: match.buyerWallet,
          sellerWallet: match.sellerWallet,
          tokenAmount: match.tokenAmount,
          pricePerToken: match.pricePerToken,
          totalValue: match.totalValue,
          status: "PENDING", // Awaiting blockchain execution
        },
      });

      // Update buy order
      const buyOrder = await tx.projectOrder.findUnique({
        where: { id: match.buyOrderId },
      });

      if (buyOrder) {
        const newFilledAmount = buyOrder.filledAmount + match.tokenAmount;
        const isFilled = newFilledAmount >= buyOrder.tokenAmount;

        await tx.projectOrder.update({
          where: { id: match.buyOrderId },
          data: {
            filledAmount: newFilledAmount,
            status: isFilled ? "FILLED" : "PARTIALLY_FILLED",
          },
        });
      }

      // Update sell order
      const sellOrder = await tx.projectOrder.findUnique({
        where: { id: match.sellOrderId },
      });

      if (sellOrder) {
        const newFilledAmount = sellOrder.filledAmount + match.tokenAmount;
        const isFilled = newFilledAmount >= sellOrder.tokenAmount;

        await tx.projectOrder.update({
          where: { id: match.sellOrderId },
          data: {
            filledAmount: newFilledAmount,
            status: isFilled ? "FILLED" : "PARTIALLY_FILLED",
          },
        });
      }

      // Update project metrics with latest price
      await tx.projectMetric.update({
        where: { projectId: match.projectId },
        data: {
          currentPrice: match.pricePerToken,
        },
      });
    }
  });
}

/**
 * Cancel an open order
 */
export async function cancelOrder(orderId: string, wallet: string): Promise<void> {
  const order = await prisma.projectOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.wallet !== wallet) {
    throw new Error("Unauthorized: You can only cancel your own orders");
  }

  if (order.status === "FILLED" || order.status === "CANCELLED") {
    throw new Error("Order cannot be cancelled");
  }

  await prisma.projectOrder.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });
}

/**
 * Get order book (bid/ask spread) for a project
 */
export async function getOrderBook(projectId: string) {
  const [buyOrders, sellOrders] = await Promise.all([
    // Bids (buy orders)
    prisma.projectOrder.findMany({
      where: {
        projectId,
        side: "BUY",
        status: { in: ["OPEN", "PARTIALLY_FILLED"] },
      },
      orderBy: [
        { pricePerToken: "desc" },
        { createdAt: "asc" },
      ],
      take: 20, // Top 20 bids
    }),
    // Asks (sell orders)
    prisma.projectOrder.findMany({
      where: {
        projectId,
        side: "SELL",
        status: { in: ["OPEN", "PARTIALLY_FILLED"] },
      },
      orderBy: [
        { pricePerToken: "asc" },
        { createdAt: "asc" },
      ],
      take: 20, // Top 20 asks
    }),
  ]);

  // Aggregate orders by price level
  const aggregateBids = aggregateByPrice(buyOrders);
  const aggregateAsks = aggregateByPrice(sellOrders);

  // Calculate spread
  const bestBid = aggregateBids[0]?.price || 0;
  const bestAsk = aggregateAsks[0]?.price || 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const spreadPercent =
    bestAsk > 0 && bestBid > 0 ? ((bestAsk - bestBid) / bestAsk) * 100 : 0;

  return {
    bids: aggregateBids,
    asks: aggregateAsks,
    bestBid,
    bestAsk,
    spread,
    spreadPercent,
  };
}

/**
 * Aggregate orders by price level (sum quantities at same price)
 */
function aggregateByPrice(orders: Order[]) {
  const priceMap = new Map<number, number>();

  for (const order of orders) {
    const remaining = order.tokenAmount - order.filledAmount;
    const current = priceMap.get(order.pricePerToken) || 0;
    priceMap.set(order.pricePerToken, current + remaining);
  }

  return Array.from(priceMap.entries())
    .map(([price, quantity]) => ({ price, quantity }))
    .sort((a, b) =>
      orders[0]?.side === "BUY" ? b.price - a.price : a.price - b.price
    );
}

/**
 * Get market price (last trade price) for a project
 */
export async function getMarketPrice(projectId: string): Promise<number> {
  const lastTrade = await prisma.trade.findFirst({
    where: {
      projectId,
      status: { in: ["CONFIRMED", "EXECUTING"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (lastTrade) {
    return lastTrade.pricePerToken;
  }

  // Fallback to current price from metrics
  const metrics = await prisma.projectMetric.findUnique({
    where: { projectId },
  });

  return metrics?.currentPrice || 0;
}

/**
 * Get recent trades for a project
 */
export async function getRecentTrades(projectId: string, limit: number = 50) {
  return prisma.trade.findMany({
    where: {
      projectId,
      status: { in: ["CONFIRMED", "EXECUTING", "PENDING"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Get user's orders
 */
export async function getUserOrders(wallet: string, projectId?: string) {
  return prisma.projectOrder.findMany({
    where: {
      wallet,
      ...(projectId && { projectId }),
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          tokenSymbol: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get user's trade history
 */
export async function getUserTrades(wallet: string, projectId?: string) {
  return prisma.trade.findMany({
    where: {
      OR: [{ buyerWallet: wallet }, { sellerWallet: wallet }],
      ...(projectId && { projectId }),
    },
    orderBy: { createdAt: "desc" },
  });
}
