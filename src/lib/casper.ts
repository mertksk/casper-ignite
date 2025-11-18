import "server-only";
import {
  CasperServiceByJsonRPC,
  CLPublicKey,
  DeployUtil,
  CLValueBuilder,
  RuntimeArgs
} from "casper-js-sdk";
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

  // Prepare named arguments for CEP-18 contract
  const runtimeArgs = RuntimeArgs.fromMap({
    name: CLValueBuilder.string(projectName),
    symbol: CLValueBuilder.string(symbol),
    decimals: CLValueBuilder.u8(decimals),
    total_supply: CLValueBuilder.u256(totalSupply * Math.pow(10, decimals)),
  });

  // Note: In production, you would need to:
  // 1. Load the CEP-18 WASM binary
  // 2. Create a Deploy with newModuleBytes
  // 3. Have the user sign it with their wallet
  // 4. Submit to the network

  const deployHash = `deploy-${symbol}-${Date.now()}`;

  return {
    creatorKey,
    runtimeArgs,
    deployHash,
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
