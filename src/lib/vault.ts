import "server-only";
import {
  HttpHandler,
  RpcClient,
} from "casper-js-sdk";
import { appConfig } from "./config";

// ============================================================================
// Constants
// ============================================================================

// Named keys in the vault contract account
const KEY_LOCKED_CSPR = "locked_cspr";
const KEY_CSPR_PURSE = "cspr_purse";
const KEY_ADMIN = "admin";
const KEY_ORDER_BOOK = "order_book";
const KEY_ORDER_OWNERS = "order_owners";

// ============================================================================
// RPC Client
// ============================================================================

let rpcClient: RpcClient | null = null;

function buildRpcClient(endpoint: string) {
  return new RpcClient(new HttpHandler(endpoint, "fetch"));
}

function getRpcClient(): RpcClient {
  if (!rpcClient) {
    rpcClient = buildRpcClient(appConfig.rpcUrls.primary);
  }
  return rpcClient;
}

function withRpcFallback<T>(fn: (client: RpcClient) => Promise<T>): Promise<T> {
  return fn(getRpcClient()).catch(async (primaryError) => {
    if (!appConfig.rpcUrls.fallback || appConfig.rpcUrls.fallback === appConfig.rpcUrls.primary) {
      throw primaryError;
    }
    const fallbackClient = buildRpcClient(appConfig.rpcUrls.fallback);
    return fn(fallbackClient);
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getVaultAccountHash(): string {
  const accountHash = appConfig.vault.accountHash;
  if (!accountHash) {
    throw new Error(
      "Token Vault contract not configured. Set VAULT_CONTRACT_ACCOUNT_HASH in environment variables."
    );
  }
  return accountHash.startsWith("account-hash-") ? accountHash : `account-hash-${accountHash}`;
}

/**
 * Convert CSPR to motes (1 CSPR = 1,000,000,000 motes)
 */
export function csprToMotes(cspr: number | string): bigint {
  const csprNumber = typeof cspr === "string" ? Number(cspr) : cspr;
  return BigInt(Math.round(csprNumber * 1_000_000_000));
}

/**
 * Convert motes to CSPR
 */
export function motesToCSPR(motes: number | string | bigint): number {
  const motesBig = typeof motes === "bigint" ? motes : BigInt(motes.toString());
  return Number(motesBig) / 1_000_000_000;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get the locked CSPR amount for an order.
 * Returns 0 if order doesn't exist.
 */
export async function getLockedAmount(orderId: string): Promise<{
  amountMotes: string;
  amountCSPR: number;
}> {
  const vaultAccountHash = getVaultAccountHash();

  try {
    // Query the locked_cspr dictionary using direct RPC call
    const rpcUrl = appConfig.rpcUrls.primary;

    // First get the dictionary seed URef
    const stateResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "query_global_state",
        params: {
          state_identifier: null, // latest state
          key: vaultAccountHash,
          path: [KEY_LOCKED_CSPR],
        },
        id: 1,
      }),
    });

    const stateData = await stateResponse.json();

    if (stateData.error) {
      console.log(`[Vault Query] Dictionary lookup failed:`, stateData.error);
      return { amountMotes: "0", amountCSPR: 0 };
    }

    // Get the dictionary seed URef from result
    const storedValue = stateData.result?.stored_value;
    const seedURef = storedValue?.CLValue?.parsed;

    if (!seedURef) {
      return { amountMotes: "0", amountCSPR: 0 };
    }

    // Query dictionary item by key
    const dictResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "state_get_dictionary_item",
        params: {
          state_root_hash: null,
          dictionary_identifier: {
            URef: {
              seed_uref: seedURef,
              dictionary_item_key: orderId,
            },
          },
        },
        id: 2,
      }),
    });

    const dictData = await dictResponse.json();

    if (dictData.error) {
      // Order not found in dictionary
      return { amountMotes: "0", amountCSPR: 0 };
    }

    const value = dictData.result?.stored_value?.CLValue?.parsed;
    if (!value) {
      return { amountMotes: "0", amountCSPR: 0 };
    }

    const amountMotes = typeof value === "string" ? value : String(value);
    return {
      amountMotes,
      amountCSPR: motesToCSPR(amountMotes),
    };
  } catch (error) {
    console.log(`[Vault Query] Order ${orderId} lookup error:`, error);
    return { amountMotes: "0", amountCSPR: 0 };
  }
}

/**
 * Check if an order exists in the vault.
 */
export async function orderExists(orderId: string): Promise<boolean> {
  const { amountMotes } = await getLockedAmount(orderId);
  return amountMotes !== "0";
}

/**
 * Get the vault's CSPR purse balance (total locked CSPR).
 */
export async function getVaultBalance(): Promise<{
  balanceMotes: string;
  balanceCSPR: number;
}> {
  const vaultAccountHash = getVaultAccountHash();

  try {
    const rpcUrl = appConfig.rpcUrls.primary;

    // Query the cspr_purse URef from the vault account
    const purseResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "query_global_state",
        params: {
          state_identifier: null,
          key: vaultAccountHash,
          path: [KEY_CSPR_PURSE],
        },
        id: 1,
      }),
    });

    const purseData = await purseResponse.json();

    if (purseData.error) {
      console.log("[Vault Balance] Failed to get purse:", purseData.error);
      return { balanceMotes: "0", balanceCSPR: 0 };
    }

    const purseURef = purseData.result?.stored_value?.CLValue?.parsed;
    if (!purseURef) {
      return { balanceMotes: "0", balanceCSPR: 0 };
    }

    // Query balance of the purse
    const balanceResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "query_balance",
        params: { purse_identifier: { purse_uref: purseURef } },
        id: 2,
      }),
    });

    const balanceData = await balanceResponse.json();

    if (balanceData.error || !balanceData.result?.balance) {
      return { balanceMotes: "0", balanceCSPR: 0 };
    }

    const balanceMotes = balanceData.result.balance;
    return {
      balanceMotes,
      balanceCSPR: motesToCSPR(balanceMotes),
    };
  } catch (error) {
    console.error("[Vault Balance Query] Error:", error);
    return { balanceMotes: "0", balanceCSPR: 0 };
  }
}

/**
 * Get vault configuration info.
 */
export async function getVaultInfo(): Promise<{
  accountHash: string;
  adminHash?: string;
  orderBookHash?: string;
}> {
  const vaultAccountHash = getVaultAccountHash();
  const rpcUrl = appConfig.rpcUrls.primary;

  const result: {
    accountHash: string;
    adminHash?: string;
    orderBookHash?: string;
  } = {
    accountHash: vaultAccountHash,
  };

  try {
    // Get admin
    const adminResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "query_global_state",
        params: {
          state_identifier: null,
          key: vaultAccountHash,
          path: [KEY_ADMIN],
        },
        id: 1,
      }),
    });

    const adminData = await adminResponse.json();
    if (!adminData.error && adminData.result?.stored_value?.CLValue?.parsed) {
      result.adminHash = adminData.result.stored_value.CLValue.parsed;
    }

    // Get order_book
    const orderBookResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "query_global_state",
        params: {
          state_identifier: null,
          key: vaultAccountHash,
          path: [KEY_ORDER_BOOK],
        },
        id: 2,
      }),
    });

    const orderBookData = await orderBookResponse.json();
    if (!orderBookData.error && orderBookData.result?.stored_value?.CLValue?.parsed) {
      const orderBook = orderBookData.result.stored_value.CLValue.parsed;
      // Check if it's not the zero address
      if (orderBook && orderBook !== "0000000000000000000000000000000000000000000000000000000000000000") {
        result.orderBookHash = orderBook;
      }
    }
  } catch (error) {
    console.error("[Vault Info] Error:", error);
  }

  return result;
}

// ============================================================================
// Deploy Status (for tracking vault transactions)
// ============================================================================

/**
 * Check if a deploy was successful.
 */
export async function checkVaultDeployStatus(deployHash: string): Promise<{
  executed: boolean;
  success: boolean;
  error?: string;
}> {
  const cleanHash = deployHash.startsWith("hash-") ? deployHash.slice(5) : deployHash;

  try {
    const result = await withRpcFallback((client) => client.getDeploy(cleanHash));
    const execution =
      result.executionResultsV1?.[0] ?? result.rawJSON?.execution_results?.[0];

    if (!execution) {
      return { executed: false, success: false };
    }

    const successResult = execution.result?.success ?? execution.result?.Success;
    const failureResult = execution.result?.failure ?? execution.result?.Failure;

    if (successResult) {
      return { executed: true, success: true };
    }

    if (failureResult) {
      const errorMsg =
        failureResult.errorMessage ??
        failureResult.error_message ??
        JSON.stringify(failureResult);
      return { executed: true, success: false, error: errorMsg };
    }

    return { executed: false, success: false };
  } catch (error) {
    return {
      executed: false,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Wait for a deploy to complete.
 */
export async function waitForVaultDeploy(
  deployHash: string,
  timeoutMs: number = 300_000
): Promise<{ executed: boolean; success: boolean; error?: string }> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await checkVaultDeployStatus(deployHash);
    if (status.executed) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  return { executed: false, success: false, error: "Deploy timeout exceeded" };
}
