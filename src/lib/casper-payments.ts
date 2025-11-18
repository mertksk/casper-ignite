/**
 * Casper Payment Service
 * Handles CSPR transfers for project creation fees
 *
 * Payment Flow:
 * 1. User pays 2000 CSPR total
 * 2. 600 CSPR goes to platform wallet
 * 3. 1400 CSPR goes to project liquidity pool
 */

import { CLPublicKey, DeployUtil, CLValueBuilder } from "casper-js-sdk";
import { appConfig } from "./config";

const TOTAL_FEE_CSPR = 2000;
const PLATFORM_FEE_CSPR = 600;
const LIQUIDITY_CSPR = 1400;

// Platform wallet address (should be in .env for production)
const PLATFORM_WALLET = process.env.NEXT_PUBLIC_PLATFORM_WALLET || "020000000000000000000000000000000000000000000000000000000000000000";

// Motes conversion (1 CSPR = 1,000,000,000 motes)
const CSPR_TO_MOTES = 1_000_000_000;

export interface PaymentDeploy {
  platformDeploy: DeployUtil.Deploy;
  liquidityDeploy: DeployUtil.Deploy;
}

export interface PaymentResult {
  platformTxHash: string;
  liquidityTxHash: string;
}

/**
 * Create unsigned deploys for the 2000 CSPR payment
 * These need to be signed by the user's wallet
 */
export function createPaymentDeploys(
  fromPublicKey: string,
  projectLiquidityAddress: string,
  chainName: string = appConfig.NEXT_PUBLIC_CHAIN_NAME
): PaymentDeploy {
  const fromKey = CLPublicKey.fromHex(fromPublicKey);
  const platformKey = CLPublicKey.fromHex(PLATFORM_WALLET);
  const liquidityKey = CLPublicKey.fromHex(projectLiquidityAddress);

  // Deploy 1: 600 CSPR to platform
  const platformTransferParams = DeployUtil.ExecutableDeployItem.newTransfer(
    PLATFORM_FEE_CSPR * CSPR_TO_MOTES,
    platformKey,
    undefined, // source URef (optional)
    BigInt(1) // transfer ID
  );

  const platformPayment = DeployUtil.standardPayment(100_000_000); // 0.1 CSPR gas fee

  const platformDeploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      fromKey,
      chainName,
      1, // Gas price
      1800000 // TTL (30 minutes)
    ),
    platformTransferParams,
    platformPayment
  );

  // Deploy 2: 1400 CSPR to liquidity pool
  const liquidityTransferParams = DeployUtil.ExecutableDeployItem.newTransfer(
    LIQUIDITY_CSPR * CSPR_TO_MOTES,
    liquidityKey,
    undefined,
    BigInt(2) // transfer ID
  );

  const liquidityPayment = DeployUtil.standardPayment(100_000_000);

  const liquidityDeploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      fromKey,
      chainName,
      1,
      1800000
    ),
    liquidityTransferParams,
    liquidityPayment
  );

  return {
    platformDeploy,
    liquidityDeploy,
  };
}

/**
 * Verify payment deploys are correctly structured
 */
export function verifyPaymentDeploys(deploys: PaymentDeploy): boolean {
  // TODO: Add verification logic
  // - Check amounts are correct
  // - Check recipient addresses
  // - Validate signatures
  return true;
}

/**
 * Get deploy hashes from signed deploys
 */
export function getDeployHashes(deploys: PaymentDeploy): {
  platformHash: string;
  liquidityHash: string;
} {
  return {
    platformHash: DeployUtil.deployToBytes(deploys.platformDeploy).toString("hex"),
    liquidityHash: DeployUtil.deployToBytes(deploys.liquidityDeploy).toString("hex"),
  };
}

/**
 * Send signed deploys to the network
 * This would be called after the user signs the deploys with their wallet
 */
export async function sendPaymentDeploys(
  signedDeploys: PaymentDeploy
): Promise<PaymentResult> {
  const rpcUrl = appConfig.rpcUrls.primary;

  try {
    // Send platform fee deploy
    const platformResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "account_put_deploy",
        params: {
          deploy: DeployUtil.deployToJson(signedDeploys.platformDeploy),
        },
      }),
    });

    const platformResult = await platformResponse.json();
    const platformTxHash = platformResult.result?.deploy_hash;

    if (!platformTxHash) {
      throw new Error("Failed to send platform fee deploy");
    }

    // Send liquidity deploy
    const liquidityResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "account_put_deploy",
        params: {
          deploy: DeployUtil.deployToJson(signedDeploys.liquidityDeploy),
        },
      }),
    });

    const liquidityResult = await liquidityResponse.json();
    const liquidityTxHash = liquidityResult.result?.deploy_hash;

    if (!liquidityTxHash) {
      throw new Error("Failed to send liquidity deploy");
    }

    return {
      platformTxHash,
      liquidityTxHash,
    };
  } catch (error) {
    console.error("Error sending payment deploys:", error);
    throw error;
  }
}

/**
 * Wait for deploy to be executed and verify success
 */
export async function waitForDeployExecution(
  deployHash: string,
  timeoutMs: number = 180000 // 3 minutes
): Promise<boolean> {
  const rpcUrl = appConfig.rpcUrls.primary;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "info_get_deploy",
          params: {
            deploy_hash: deployHash,
          },
        }),
      });

      const result = await response.json();
      const executionResults = result.result?.execution_results;

      if (executionResults && executionResults.length > 0) {
        const execution = executionResults[0].result;
        if (execution.Success) {
          return true;
        } else if (execution.Failure) {
          throw new Error(`Deploy failed: ${JSON.stringify(execution.Failure)}`);
        }
      }

      // Wait 5 seconds before checking again
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error("Error checking deploy status:", error);
      throw error;
    }
  }

  throw new Error("Deploy execution timeout");
}

/**
 * Verify both payments were successful
 */
export async function verifyPayments(result: PaymentResult): Promise<boolean> {
  try {
    const platformSuccess = await waitForDeployExecution(result.platformTxHash);
    const liquiditySuccess = await waitForDeployExecution(result.liquidityTxHash);

    return platformSuccess && liquiditySuccess;
  } catch (error) {
    console.error("Payment verification failed:", error);
    return false;
  }
}

export const PAYMENT_CONFIG = {
  TOTAL_FEE_CSPR,
  PLATFORM_FEE_CSPR,
  LIQUIDITY_CSPR,
  PLATFORM_WALLET,
} as const;
