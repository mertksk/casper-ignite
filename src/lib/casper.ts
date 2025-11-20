import "server-only";
import {
  CasperServiceByJsonRPC,
  CLPublicKey,
  DeployUtil,
  CLValueBuilder,
  RuntimeArgs
} from "casper-js-sdk";
import { readFileSync } from "fs";
import { join } from "path";
import { appConfig } from "./config";

type DeployInput = {
  projectName: string;
  symbol: string;
  totalSupply: number;
  creatorPublicKey: string;
  decimals?: number;
};

let rpcClient: CasperServiceByJsonRPC | null = null;

function getRpcClient() {
  if (appConfig.isTest) return null;
  if (!rpcClient) {
    rpcClient = new CasperServiceByJsonRPC(appConfig.rpcUrls.primary);
  }
  return rpcClient;
}

/**
 * Deploy a CEP-18 token contract
 *
 * NOTE: This function creates an unsigned deploy that must be signed by the creator's wallet.
 * The actual deployment requires:
 * 1. CEP-18 contract WASM file (stored in /public/contracts/cep18.wasm)
 * 2. User to sign the deploy with their Casper Wallet
 * 3. Deploy to be sent to the network
 *
 * For development/testing, this returns a mock hash.
 * For production, uncomment the real deployment code below.
 */
export async function deployProjectToken(input: DeployInput): Promise<string> {
  const client = getRpcClient();

  // Verify RPC connectivity
  if (client) {
    try {
      await client.getLatestBlockInfo();
    } catch (error) {
      console.error("RPC connection failed:", error);
      throw new Error("Unable to connect to Casper network");
    }
  }

  // TODO: For production deployment, uncomment this section
  /*
  try {
    const deployParams = createTokenDeployParams(input);

    // This deploy needs to be signed by the creator's wallet
    // and submitted through the frontend using Casper Wallet

    return deployParams.deployHash;
  } catch (error) {
    console.error("Token deployment failed:", error);
    throw error;
  }
  */

  // MOCK IMPLEMENTATION (for development)
  // Generate a deterministic mock hash based on input
  const hashSeed = `${input.projectName}-${input.symbol}-${input.totalSupply}-${Date.now()}`;
  const mockHash = `hash-${Buffer.from(hashSeed).toString("hex").slice(0, 64)}`;

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(`[MOCK] Token deployment simulated for ${input.symbol}:`, {
    name: input.projectName,
    symbol: input.symbol,
    totalSupply: input.totalSupply,
    mockHash,
  });

  return mockHash;
}

/**
 * Create deploy parameters for CEP-18 token contract
 * This creates an unsigned deploy that needs to be signed by the user
 */
export function createTokenDeployParams(input: DeployInput) {
  const {
    projectName,
    symbol,
    totalSupply,
    creatorPublicKey,
    decimals = 9, // Standard decimals for Casper tokens
  } = input;

  // Parse creator's public key
  const creatorKey = CLPublicKey.fromHex(creatorPublicKey);

  // Load CEP-18 WASM binary
  const wasmPath = join(process.cwd(), "public", "contracts", "cep18.wasm");
  let wasmBytes: Uint8Array;

  try {
    const wasmBuffer = readFileSync(wasmPath);
    wasmBytes = new Uint8Array(wasmBuffer);
  } catch (error) {
    console.error("Failed to load CEP-18 WASM file:", error);
    throw new Error("CEP-18 contract WASM file not found. Please download it to /public/contracts/cep18.wasm");
  }

  // Prepare named arguments for CEP-18 contract
  const runtimeArgs = RuntimeArgs.fromMap({
    name: CLValueBuilder.string(projectName),
    symbol: CLValueBuilder.string(symbol),
    decimals: CLValueBuilder.u8(decimals),
    total_supply: CLValueBuilder.u256(totalSupply * Math.pow(10, decimals)),
  });

  // Create the deploy
  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      creatorKey,
      appConfig.chainName,
      1, // Gas price
      1800000, // TTL (30 minutes)
    ),
    DeployUtil.ExecutableDeployItem.newModuleBytes(
      wasmBytes,
      runtimeArgs
    ),
    DeployUtil.standardPayment(150_000_000_000) // 150 CSPR for contract deployment
  );

  const deployHash = Buffer.from(deploy.hash).toString("hex");
  const deployJson = DeployUtil.deployToJson(deploy);

  return {
    deploy,
    deployJson,
    deployHash,
    creatorKey,
    runtimeArgs,
    name: projectName,
    symbol,
    totalSupply,
    decimals,
  };
}

/**
 * Check if a deploy has been executed successfully
 */
export async function checkDeployStatus(deployHash: string): Promise<{
  executed: boolean;
  success: boolean;
  error?: string;
}> {
  const client = getRpcClient();

  if (!client) {
    return { executed: false, success: false, error: "No RPC client available" };
  }

  try {
    const deployInfo = await client.getDeployInfo(deployHash);

    if (!deployInfo || !deployInfo.execution_results || deployInfo.execution_results.length === 0) {
      return { executed: false, success: false };
    }

    const result = deployInfo.execution_results[0].result;

    if (result.Success) {
      return { executed: true, success: true };
    } else if (result.Failure) {
      return {
        executed: true,
        success: false,
        error: JSON.stringify(result.Failure),
      };
    }

    return { executed: false, success: false };
  } catch (error) {
    console.error("Error checking deploy status:", error);
    return { executed: false, success: false, error: String(error) };
  }
}

/**
 * Get contract hash from a successful token deployment
 */
export async function getContractHashFromDeploy(deployHash: string): Promise<string | null> {
  const client = getRpcClient();

  if (!client) {
    return null;
  }

  try {
    const deployInfo = await client.getDeployInfo(deployHash);

    if (!deployInfo || !deployInfo.execution_results || deployInfo.execution_results.length === 0) {
      return null;
    }

    const result = deployInfo.execution_results[0].result;

    if (result.Success) {
      // Extract contract hash from named keys
      // This is specific to CEP-18 contract deployment
      const transforms = result.Success.effect.transforms;

      for (const transform of transforms) {
        if (transform.transform === "WriteContract") {
          return transform.key;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error getting contract hash:", error);
    return null;
  }
}

/**
 * Create CSPR transfer deploy parameters
 * Used for platform fee and liquidity pool payments
 */
export function createCSPRTransferParams(
  fromPublicKey: string,
  toPublicKey: string,
  amount: number, // Amount in CSPR
  transferId: number = Date.now()
) {
  const fromKey = CLPublicKey.fromHex(fromPublicKey);
  const toKey = CLPublicKey.fromHex(toPublicKey);

  // Convert CSPR to motes (1 CSPR = 1,000,000,000 motes)
  const amountInMotes = amount * 1_000_000_000;

  const deployParams = {
    deploy: DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        fromKey,
        appConfig.chainName,
        1, // Gas price
        1800000 // TTL (30 minutes)
      ),
      DeployUtil.ExecutableDeployItem.newTransfer(
        amountInMotes,
        toKey,
        undefined,
        transferId
      ),
      DeployUtil.standardPayment(100_000_000) // 0.1 CSPR payment
    ),
  };

  return {
    deployJson: DeployUtil.deployToJson(deployParams.deploy),
    deployHash: Buffer.from(deployParams.deploy.hash).toString("hex"),
  };
}

/**
 * Create CEP-18 token transfer deploy parameters
 * Used for executing trades
 */
export function createTokenTransferParams(
  contractHash: string,
  fromPublicKey: string,
  toPublicKey: string,
  amount: string, // Amount as string (with decimals)
  paymentAmount: number = 3_000_000_000 // 3 CSPR for gas
) {
  const fromKey = CLPublicKey.fromHex(fromPublicKey);
  const toKey = CLPublicKey.fromHex(toPublicKey);

  // Parse contract hash (remove "hash-" prefix if present)
  const cleanHash = contractHash.startsWith("hash-")
    ? contractHash.substring(5)
    : contractHash;

  // Build runtime arguments for CEP-18 transfer
  const runtimeArgs = RuntimeArgs.fromMap({
    recipient: CLValueBuilder.key(toKey),
    amount: CLValueBuilder.u256(amount),
  });

  const deployParams = {
    deploy: DeployUtil.makeDeploy(
      new DeployUtil.DeployParams(
        fromKey,
        appConfig.chainName,
        1,
        1800000
      ),
      DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Uint8Array.from(Buffer.from(cleanHash, "hex")),
        "transfer",
        runtimeArgs
      ),
      DeployUtil.standardPayment(paymentAmount)
    ),
  };

  return {
    deployJson: DeployUtil.deployToJson(deployParams.deploy),
    deployHash: Buffer.from(deployParams.deploy.hash).toString("hex"),
  };
}

/**
 * Wait for a deploy to be executed on-chain
 * Polls the RPC until deploy is finalized or timeout
 */
export async function waitForDeploy(
  deployHash: string,
  timeoutMs: number = 120000 // 2 minutes
): Promise<{ success: boolean; error?: string }> {
  const client = getRpcClient();

  if (!client) {
    return { success: false, error: "No RPC client available" };
  }

  const startTime = Date.now();
  const pollInterval = 5000; // 5 seconds

  while (Date.now() - startTime < timeoutMs) {
    const status = await checkDeployStatus(deployHash);

    if (status.executed) {
      return {
        success: status.success,
        error: status.error,
      };
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return { success: false, error: "Deploy timeout" };
}

/**
 * Get token balance for a specific wallet address
 */
export async function getTokenBalance(
  contractHash: string,
  walletAddress: string
): Promise<string | null> {
  const client = getRpcClient();

  if (!client) {
    return null;
  }

  try {
    // Parse contract hash
    const cleanHash = contractHash.startsWith("hash-")
      ? contractHash.substring(5)
      : contractHash;

    const stateRootHash = await client.getStateRootHash();

    // Query the contract's balances dictionary
    // This is specific to CEP-18 implementation
    const balance = await client.getBlockState(
      stateRootHash,
      `hash-${cleanHash}`,
      [`balances_${walletAddress}`]
    );

    // Parse and return balance
    if (balance && balance.stored_value) {
      return balance.stored_value.toString();
    }

    return "0";
  } catch (error) {
    console.error("Error getting token balance:", error);
    return null;
  }
}

/**
 * Helper to format motes to CSPR
 */
export function motesToCSPR(motes: number | string): number {
  const motesNum = typeof motes === "string" ? parseInt(motes) : motes;
  return motesNum / 1_000_000_000;
}

/**
 * Helper to format CSPR to motes
 */
export function csprToMotes(cspr: number): number {
  return Math.floor(cspr * 1_000_000_000);
}
