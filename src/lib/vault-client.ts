/**
 * Client-side vault helpers for Token Vault contract interactions.
 * These functions work with the Casper Wallet for signing transactions.
 */

import { buildLockCsprDeploy } from "./casper-client";
import { getCasperWalletProvider } from "./casperWallet";

// ============================================================================
// Types
// ============================================================================

export interface VaultStatus {
  configured: boolean;
  accountHash?: string;
  contractHash?: string;
  balance?: {
    motes: string;
    cspr: number;
  };
  network?: string;
  message?: string;
}

export interface OrderLock {
  orderId: string;
  locked: {
    motes: string;
    cspr: number;
  };
  vaultAccountHash: string;
}

export interface LockResult {
  success: boolean;
  deployHash: string;
  orderId: string;
  amountMotes: string;
  amountCSPR: number;
  message?: string;
  error?: string;
}

export interface UnlockResult {
  success: boolean;
  deployHash: string;
  confirmed: boolean;
  orderId: string;
  recipientAccountHash: string;
  amountCSPR: number;
  message?: string;
  error?: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get the vault contract status and balance.
 */
export async function getVaultStatus(): Promise<VaultStatus> {
  const response = await fetch("/api/vault/status");
  if (!response.ok) {
    throw new Error(`Failed to get vault status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get the locked CSPR amount for an order.
 * Returns null if order not found.
 */
export async function getOrderLock(orderId: string): Promise<OrderLock | null> {
  const response = await fetch(`/api/vault/orders/${encodeURIComponent(orderId)}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to get order lock: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check if an order has CSPR locked in the vault.
 */
export async function isOrderLocked(orderId: string): Promise<boolean> {
  const lock = await getOrderLock(orderId);
  return lock !== null && parseFloat(lock.locked.motes) > 0;
}

/**
 * Lock CSPR in the vault for an order.
 * This is a multi-step process:
 * 1. Build the deploy
 * 2. Sign with Casper Wallet
 * 3. Submit to network
 *
 * @param params Lock parameters
 * @returns Lock result with deploy hash
 */
export async function lockCspr(params: {
  orderId: string;
  amountCSPR: number;
  senderPublicKey: string;
}): Promise<LockResult> {
  const { orderId, amountCSPR, senderPublicKey } = params;

  // Get vault contract hash from status
  const status = await getVaultStatus();
  if (!status.configured || !status.contractHash) {
    throw new Error("Vault contract not configured. Cannot lock CSPR.");
  }

  const amountMotes = csprToMotes(amountCSPR);

  // Build the lock deploy
  const { deployJson, deployHash } = await buildLockCsprDeploy({
    senderPublicKey,
    vaultContractHash: status.contractHash,
    orderId,
    amountMotes,
  });

  // Get Casper Wallet provider
  const wallet = getCasperWalletProvider();
  if (!wallet) {
    throw new Error("Casper Wallet not available. Please install the Casper Wallet extension.");
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
      orderId,
      amountMotes,
      amountCSPR,
      error: signResult.message || "User cancelled signing",
    };
  }

  // Submit the signed deploy
  const submitResponse = await fetch("/api/vault/lock/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployJson,
      signatureHex: signResult.signatureHex,
      signerPublicKey: senderPublicKey,
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to submit deploy: ${submitResponse.statusText}`);
  }

  const submitResult = await submitResponse.json();

  return {
    success: true,
    deployHash: submitResult.deployHash || deployHash,
    orderId,
    amountMotes,
    amountCSPR,
    message: "Lock transaction submitted successfully",
  };
}

/**
 * Wait for a lock deploy to be confirmed.
 */
export async function waitForLockConfirmation(
  deployHash: string,
  timeoutMs: number = 300_000
): Promise<{ confirmed: boolean; error?: string }> {
  const response = await fetch(`/api/vault/deploy/${encodeURIComponent(deployHash)}/wait?timeout=${timeoutMs}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    return { confirmed: false, error: errorData.error || "Failed to check deploy status" };
  }

  return response.json();
}

/**
 * Request unlock of CSPR from vault (admin only).
 * NOTE: Not yet implemented - requires admin backend integration.
 * This is typically called by the trading backend, not directly by users.
 */
export async function requestUnlock(_params: {
  orderId: string;
  recipientAccountHash: string;
  amountCSPR: number;
  waitForConfirmation?: boolean;
}): Promise<UnlockResult> {
  throw new Error(
    "Vault unlock not yet implemented. " +
    "This is typically called by the trading backend for trade execution."
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert CSPR to motes.
 */
export function csprToMotes(cspr: number): string {
  return (BigInt(Math.round(cspr * 1_000_000_000))).toString();
}

/**
 * Convert motes to CSPR.
 */
export function motesToCspr(motes: string | bigint): number {
  const motesBig = typeof motes === "bigint" ? motes : BigInt(motes);
  return Number(motesBig) / 1_000_000_000;
}

/**
 * Format CSPR amount for display.
 */
export function formatCspr(cspr: number, decimals: number = 4): string {
  return cspr.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format motes as CSPR for display.
 */
export function formatMotes(motes: string | bigint, decimals: number = 4): string {
  return formatCspr(motesToCspr(motes), decimals);
}
