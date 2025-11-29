/**
 * Order Book Client - Frontend integration for Limit Order Book
 * Provides limit order placement, cancellation, and order book queries.
 */

"use client";

import {
  Args,
  CLValue,
  ContractHash,
  Deploy,
  DeployHeader,
  Duration,
  ExecutableDeployItem,
  Hash,
  PublicKey,
  Timestamp,
  StoredContractByHash,
} from "casper-js-sdk";
import { getCasperWalletProvider } from "./casperWallet";

// ============================================================================
// Types
// ============================================================================

export interface OrderBookStatus {
  configured: boolean;
  contractHash?: string;
  buyOrderCount?: number;
  sellOrderCount?: number;
  network?: string;
}

export interface Order {
  orderId: string;
  side: "buy" | "sell";
  maker: string;
  price: string; // Price in motes per token
  amount: string; // Token amount
  filled: string; // Amount already filled
  timestamp: number;
  status: "open" | "partial" | "filled" | "cancelled";
}

export interface OrderBook {
  buyOrders: Order[];
  sellOrders: Order[];
  spread?: {
    motes: string;
    cspr: number;
  };
  midPrice?: {
    motes: string;
    cspr: number;
  };
}

export interface PlaceOrderResult {
  success: boolean;
  deployHash: string;
  orderId?: string;
  message?: string;
  error?: string;
}

export interface CancelOrderResult {
  success: boolean;
  deployHash: string;
  message?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_GAS_PRICE = 1;
const PLACE_ORDER_GAS = "10000000000"; // 10 CSPR
const CANCEL_ORDER_GAS = "5000000000"; // 5 CSPR

const getChainName = () => {
  if (typeof window !== "undefined") {
    return (window as unknown as { __NEXT_DATA__?: { props?: { pageProps?: { chainName?: string } } } }).__NEXT_DATA__?.props?.pageProps?.chainName || "casper-test";
  }
  return "casper-test";
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get Order Book contract status
 */
export async function getOrderBookStatus(): Promise<OrderBookStatus> {
  const response = await fetch("/api/orderbook/status");
  if (!response.ok) {
    throw new Error(`Failed to get Order Book status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get current order book (buy and sell orders)
 */
export async function getOrderBook(depth: number = 20): Promise<OrderBook> {
  const response = await fetch(`/api/orderbook/book?depth=${depth}`);
  if (!response.ok) {
    throw new Error(`Failed to get order book: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get user's open orders
 */
export async function getUserOrders(accountHash: string): Promise<Order[]> {
  const response = await fetch(`/api/orderbook/orders/${encodeURIComponent(accountHash)}`);
  if (!response.ok) {
    throw new Error(`Failed to get user orders: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get order by ID
 */
export async function getOrder(orderId: string): Promise<Order> {
  const response = await fetch(`/api/orderbook/order/${encodeURIComponent(orderId)}`);
  if (!response.ok) {
    throw new Error(`Failed to get order: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// Contract Functions
// ============================================================================

/**
 * Place a buy limit order
 */
export async function placeBuyOrder(params: {
  pricePerTokenCSPR: number; // Price willing to pay per token
  tokenAmount: string; // Amount of tokens to buy
  senderPublicKey: string;
}): Promise<PlaceOrderResult> {
  const { pricePerTokenCSPR, tokenAmount, senderPublicKey } = params;

  const status = await getOrderBookStatus();
  if (!status.configured || !status.contractHash) {
    throw new Error("Order Book contract not configured");
  }

  const cleanHash = status.contractHash.replace("hash-", "");
  const contractHashBytes = new Uint8Array(
    (cleanHash.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const contractHash = new ContractHash(new Hash(contractHashBytes), "contract-");

  const accountKey = PublicKey.fromHex(senderPublicKey);
  const priceMotes = Math.round(pricePerTokenCSPR * 1_000_000_000).toString();

  // Calculate total cost for escrow
  const totalCostMotes = BigInt(priceMotes) * BigInt(tokenAmount);

  const runtimeArgs = Args.fromMap({
    price: CLValue.newCLUInt512(priceMotes),
    amount: CLValue.newCLUInt512(tokenAmount),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "place_buy_order",
    runtimeArgs
  );

  // Payment includes gas + escrow for the order
  const totalPayment = BigInt(PLACE_ORDER_GAS) + totalCostMotes;
  const payment = ExecutableDeployItem.standardPayment(totalPayment.toString());

  const header = new DeployHeader(
    getChainName(),
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date(Date.now() - 20000)),
    new Duration(DEFAULT_TTL_MS),
    accountKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);
  const deployJson = Deploy.toJSON(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy");
  }

  const wallet = getCasperWalletProvider();
  if (!wallet) {
    throw new Error("Casper Wallet not available");
  }

  const signResult = await wallet.sign(
    JSON.stringify(deployJson),
    senderPublicKey
  );

  if (signResult.cancelled) {
    return {
      success: false,
      deployHash: "",
      error: signResult.message || "User cancelled signing",
    };
  }

  const submitResponse = await fetch("/api/orderbook/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployJson,
      signatureHex: signResult.signatureHex,
      signerPublicKey: senderPublicKey,
      action: "place_buy_order",
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to submit buy order");
  }

  const submitResult = await submitResponse.json();

  return {
    success: true,
    deployHash: submitResult.deployHash || deploy.hash.toHex(),
    message: "Buy order submitted successfully",
  };
}

/**
 * Place a sell limit order
 */
export async function placeSellOrder(params: {
  pricePerTokenCSPR: number; // Price to sell per token
  tokenAmount: string; // Amount of tokens to sell
  senderPublicKey: string;
}): Promise<PlaceOrderResult> {
  const { pricePerTokenCSPR, tokenAmount, senderPublicKey } = params;

  const status = await getOrderBookStatus();
  if (!status.configured || !status.contractHash) {
    throw new Error("Order Book contract not configured");
  }

  const cleanHash = status.contractHash.replace("hash-", "");
  const contractHashBytes = new Uint8Array(
    (cleanHash.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const contractHash = new ContractHash(new Hash(contractHashBytes), "contract-");

  const accountKey = PublicKey.fromHex(senderPublicKey);
  const priceMotes = Math.round(pricePerTokenCSPR * 1_000_000_000).toString();

  const runtimeArgs = Args.fromMap({
    price: CLValue.newCLUInt512(priceMotes),
    amount: CLValue.newCLUInt512(tokenAmount),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "place_sell_order",
    runtimeArgs
  );

  const payment = ExecutableDeployItem.standardPayment(PLACE_ORDER_GAS);

  const header = new DeployHeader(
    getChainName(),
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date(Date.now() - 20000)),
    new Duration(DEFAULT_TTL_MS),
    accountKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);
  const deployJson = Deploy.toJSON(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy");
  }

  const wallet = getCasperWalletProvider();
  if (!wallet) {
    throw new Error("Casper Wallet not available");
  }

  const signResult = await wallet.sign(
    JSON.stringify(deployJson),
    senderPublicKey
  );

  if (signResult.cancelled) {
    return {
      success: false,
      deployHash: "",
      error: signResult.message || "User cancelled signing",
    };
  }

  const submitResponse = await fetch("/api/orderbook/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployJson,
      signatureHex: signResult.signatureHex,
      signerPublicKey: senderPublicKey,
      action: "place_sell_order",
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to submit sell order");
  }

  const submitResult = await submitResponse.json();

  return {
    success: true,
    deployHash: submitResult.deployHash || deploy.hash.toHex(),
    message: "Sell order submitted successfully",
  };
}

/**
 * Cancel an open order
 */
export async function cancelOrder(params: {
  orderId: string;
  side: "buy" | "sell";
  senderPublicKey: string;
}): Promise<CancelOrderResult> {
  const { orderId, side, senderPublicKey } = params;

  const status = await getOrderBookStatus();
  if (!status.configured || !status.contractHash) {
    throw new Error("Order Book contract not configured");
  }

  const cleanHash = status.contractHash.replace("hash-", "");
  const contractHashBytes = new Uint8Array(
    (cleanHash.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const contractHash = new ContractHash(new Hash(contractHashBytes), "contract-");

  const accountKey = PublicKey.fromHex(senderPublicKey);
  const entryPoint = side === "buy" ? "cancel_buy_order" : "cancel_sell_order";

  // Parse order_id as u64
  const orderIdNum = BigInt(orderId);

  const runtimeArgs = Args.fromMap({
    order_id: CLValue.newCLUint64(orderIdNum),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    entryPoint,
    runtimeArgs
  );

  const payment = ExecutableDeployItem.standardPayment(CANCEL_ORDER_GAS);

  const header = new DeployHeader(
    getChainName(),
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date(Date.now() - 20000)),
    new Duration(DEFAULT_TTL_MS),
    accountKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);
  const deployJson = Deploy.toJSON(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy");
  }

  const wallet = getCasperWalletProvider();
  if (!wallet) {
    throw new Error("Casper Wallet not available");
  }

  const signResult = await wallet.sign(
    JSON.stringify(deployJson),
    senderPublicKey
  );

  if (signResult.cancelled) {
    return {
      success: false,
      deployHash: "",
      error: signResult.message || "User cancelled signing",
    };
  }

  const submitResponse = await fetch("/api/orderbook/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployJson,
      signatureHex: signResult.signatureHex,
      signerPublicKey: senderPublicKey,
      action: "cancel_order",
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to submit order cancellation");
  }

  const submitResult = await submitResponse.json();

  return {
    success: true,
    deployHash: submitResult.deployHash || deploy.hash.toHex(),
    message: "Order cancellation submitted successfully",
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format order price for display
 */
export function formatOrderPrice(priceMotes: string): string {
  const cspr = Number(priceMotes) / 1_000_000_000;
  return cspr.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

/**
 * Calculate order total value
 */
export function calculateOrderTotal(priceMotes: string, amount: string): { motes: string; cspr: number } {
  const total = BigInt(priceMotes) * BigInt(amount);
  return {
    motes: total.toString(),
    cspr: Number(total) / 1_000_000_000,
  };
}

/**
 * Get order fill percentage
 */
export function getOrderFillPercentage(order: Order): number {
  if (order.amount === "0") return 100;
  return (Number(order.filled) / Number(order.amount)) * 100;
}

/**
 * Format order amount with filled status
 */
export function formatOrderAmount(order: Order): string {
  const remaining = BigInt(order.amount) - BigInt(order.filled);
  if (order.filled === "0") {
    return order.amount;
  }
  return `${remaining.toString()} / ${order.amount}`;
}
