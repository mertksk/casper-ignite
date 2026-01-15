/**
 * AMM Client - Frontend integration for Bonding Curve AMM
 * Provides buy/sell functionality with Casper Wallet integration.
 */

"use client";

import {
  CLPublicKey,
  CLValueBuilder,
  DeployUtil,
  RuntimeArgs,
} from "casper-js-sdk";
import { getCasperWalletProvider } from "./casperWallet";

// ============================================================================
// Types
// ============================================================================

export interface AmmStatus {
  configured: boolean;
  contractHash?: string;
  currentPrice?: {
    motes: string;
    cspr: number;
  };
  totalSupply?: string;
  reserve?: {
    motes: string;
    cspr: number;
  };
  network?: string;
}

export interface BuyQuote {
  tokenAmount: string;
  estimatedCost: {
    motes: string;
    cspr: number;
  };
  pricePerToken: number;
  currentPrice: number;
  priceImpact: number;
}

export interface SellQuote {
  tokenAmount: string;
  estimatedProceeds: {
    motes: string;
    cspr: number;
  };
  pricePerToken: number;
  currentPrice: number;
  priceImpact: number;
}

export interface TradeResult {
  success: boolean;
  deployHash: string;
  tokenAmount: string;
  amountMotes: string;
  amountCSPR: number;
  type: "buy" | "sell";
  message?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TTL_MS = 1800000; // 30 min
const DEFAULT_GAS_PRICE = 1;
const BUY_SESSION_PAYMENT = 5000000000; // 5 CSPR

// Get chain name from env or default
const getChainName = () => {
  if (typeof window !== "undefined") {
    return (window as unknown as { __NEXT_DATA__?: { props?: { pageProps?: { chainName?: string } } } }).__NEXT_DATA__?.props?.pageProps?.chainName || "casper-test";
  }
  return "casper-test";
};

// ============================================================================
// WASM Fetchers
// ============================================================================

async function fetchAmmBuyWasm(): Promise<Uint8Array> {
  const response = await fetch("/wasm/amm_buy_session.wasm");
  if (!response.ok) {
    throw new Error("Failed to fetch AMM buy session WASM");
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get AMM contract status
 */
export async function getAmmStatus(): Promise<AmmStatus> {
  const response = await fetch("/api/amm/status");
  if (!response.ok) {
    throw new Error(`Failed to get AMM status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get buy quote for a token amount
 */
export async function getBuyQuote(tokenAmount: string): Promise<BuyQuote> {
  const response = await fetch(`/api/amm/quote/buy?amount=${encodeURIComponent(tokenAmount)}`);
  if (!response.ok) {
    throw new Error(`Failed to get buy quote: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get sell quote for a token amount
 */
export async function getSellQuote(tokenAmount: string): Promise<SellQuote> {
  const response = await fetch(`/api/amm/quote/sell?amount=${encodeURIComponent(tokenAmount)}`);
  if (!response.ok) {
    throw new Error(`Failed to get sell quote: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get user's token balance
 */
export async function getTokenBalance(accountHash: string): Promise<string> {
  const response = await fetch(`/api/amm/balance/${encodeURIComponent(accountHash)}`);
  if (!response.ok) {
    throw new Error(`Failed to get balance: ${response.statusText}`);
  }
  const data = await response.json();
  return data.balance;
}

// ============================================================================
// Trade Functions
// ============================================================================

/**
 * Buy tokens from the AMM
 */
export async function buyTokens(params: {
  tokenAmount: string; // Amount of tokens to buy
  maxCostCSPR: number; // Maximum cost willing to pay (slippage protection)
  senderPublicKey: string;
}): Promise<TradeResult> {
  const { tokenAmount, maxCostCSPR, senderPublicKey } = params;

  // Get AMM contract hash from status
  const status = await getAmmStatus();
  if (!status.configured || !status.contractHash) {
    throw new Error("AMM contract not configured");
  }

  const maxCostMotes = Math.round(maxCostCSPR * 1_000_000_000).toString();

  // Build the buy deploy
  const wasmBytes = await fetchAmmBuyWasm();
  const accountKey = CLPublicKey.fromHex(senderPublicKey);

  // Convert contract hash to bytes
  const cleanHash = status.contractHash.replace("hash-", "");
  const contractHashBytes = Uint8Array.from(Buffer.from(cleanHash, "hex"));

  const runtimeArgs = RuntimeArgs.fromMap({
    amm_contract_hash: CLValueBuilder.byteArray(contractHashBytes),
    token_amount: CLValueBuilder.u512(tokenAmount),
    max_cost: CLValueBuilder.u512(maxCostMotes),
  });

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      accountKey,
      getChainName(),
      DEFAULT_GAS_PRICE,
      DEFAULT_TTL_MS
    ),
    DeployUtil.ExecutableDeployItem.newModuleBytes(wasmBytes, runtimeArgs),
    DeployUtil.standardPayment(BUY_SESSION_PAYMENT)
  );

  const deployJson = DeployUtil.deployToJson(deploy);

  // Get Casper Wallet provider
  const wallet = getCasperWalletProvider();
  if (!wallet) {
    throw new Error("Casper Wallet not available");
  }

  // Sign the deploy
  const signResult = await wallet.sign(
    JSON.stringify(deployJson),
    senderPublicKey
  );

  if (signResult.cancelled) {
    return {
      success: false,
      deployHash: "",
      tokenAmount,
      amountMotes: maxCostMotes,
      amountCSPR: maxCostCSPR,
      type: "buy",
      error: signResult.message || "User cancelled signing",
    };
  }

  // Submit the signed deploy
  const submitResponse = await fetch("/api/amm/trade/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployJson,
      signatureHex: signResult.signatureHex,
      signerPublicKey: senderPublicKey,
      tradeType: "buy",
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to submit trade");
  }

  const submitResult = await submitResponse.json();

  return {
    success: true,
    // Prefer server returned hash as potential signature malleability fixes might happen there
    deployHash: submitResult.deployHash || Buffer.from(deploy.hash).toString('hex'),
    tokenAmount,
    amountMotes: maxCostMotes,
    amountCSPR: maxCostCSPR,
    type: "buy",
    message: "Buy order submitted successfully",
  };
}

/**
 * Sell tokens to the AMM
 * Note: This calls the contract directly without a session (tokens are in the contract)
 */
export async function sellTokens(params: {
  tokenAmount: string;
  minProceedsCSPR: number;
  senderPublicKey: string;
}): Promise<TradeResult> {
  const { tokenAmount, minProceedsCSPR, senderPublicKey } = params;

  // Get AMM contract hash from status
  const status = await getAmmStatus();
  if (!status.configured || !status.contractHash) {
    throw new Error("AMM contract not configured");
  }

  const minProceedsMotes = Math.round(minProceedsCSPR * 1_000_000_000).toString();

  // For sell, we call the contract entry point directly
  // This requires a session that just calls the sell entry point
  // The server API prepares the deploy JSON for sell
  const response = await fetch("/api/amm/trade/sell", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokenAmount,
      minProceedsMotes,
      signerPublicKey: senderPublicKey,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to prepare sell transaction");
  }

  const { deployJson } = await response.json();

  // Get Casper Wallet provider
  const wallet = getCasperWalletProvider();
  if (!wallet) {
    throw new Error("Casper Wallet not available");
  }

  // Sign the deploy
  const signResult = await wallet.sign(
    JSON.stringify(deployJson),
    senderPublicKey
  );

  if (signResult.cancelled) {
    return {
      success: false,
      deployHash: "",
      tokenAmount,
      amountMotes: minProceedsMotes,
      amountCSPR: minProceedsCSPR,
      type: "sell",
      error: signResult.message || "User cancelled signing",
    };
  }

  // Submit the signed deploy
  const submitResponse = await fetch("/api/amm/trade/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployJson,
      signatureHex: signResult.signatureHex,
      signerPublicKey: senderPublicKey,
      tradeType: "sell",
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to submit sell");
  }

  const submitResult = await submitResponse.json();

  return {
    success: true,
    deployHash: submitResult.deployHash,
    tokenAmount,
    amountMotes: minProceedsMotes,
    amountCSPR: minProceedsCSPR,
    type: "sell",
    message: "Sell order submitted successfully",
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function csprToMotes(cspr: number): string {
  return Math.round(cspr * 1_000_000_000).toString();
}

export function motesToCspr(motes: string | bigint): number {
  const motesBig = typeof motes === "bigint" ? motes : BigInt(motes);
  return Number(motesBig) / 1_000_000_000;
}

export function formatCspr(cspr: number, decimals: number = 4): string {
  return cspr.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
