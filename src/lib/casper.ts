
import {
  CasperServiceByJsonRPC,
  CLPublicKey,
  Keys,
  DeployUtil,
  RuntimeArgs,
  CLValueBuilder,
  CLValueParsers,
  encodeBase16,
  CLU8Type,
  CLBoolType
} from "casper-js-sdk";
import { CEP18Client } from "casper-cep18-js-client";
import { appConfig } from "./config";
import { readFileSync } from "fs";
import { join } from "path";
import { BigNumber } from "@ethersproject/bignumber";

// Configuration
const NETWORK_NAME = appConfig.NEXT_PUBLIC_CHAIN_NAME;
const RPC_URL = appConfig.rpcUrls.primary;

// Helper to get RPC client
function getRpcClient() {
  return new CasperServiceByJsonRPC(RPC_URL);
}

// Helper to load WASM
function readCep18Wasm(): Uint8Array {
  const wasmPath = join(process.cwd(), "public", "contracts", "cep18.wasm");
  return new Uint8Array(readFileSync(wasmPath));
}

// Type for deploy input
type DeployInput = {
  projectName: string;
  symbol: string;
  totalSupply: number;
  creatorPublicKey: string;
  decimals?: number;
};

/**
 * Deploy a project token using the official CEP-18 client.
 */
export async function deployProjectToken(
  input: DeployInput,
  options: { waitForConfirmation?: boolean } = { waitForConfirmation: true }
): Promise<{
  contractHash?: string;
  contractPackageHash?: string;
  deployHash: string;
}> {
  // Load server-side deployer key
  const deployerKey = loadServerSigner();
  if (!deployerKey) {
    throw new Error("Server-side deployer key not configured");
  }

  // Load WASM
  const wasm = readCep18Wasm();

  // Create CEP-18 Client
  const cep18 = new CEP18Client(RPC_URL, NETWORK_NAME);

  // Prepare install arguments
  const decimals = input.decimals ?? 9;
  const supply = BigInt(input.totalSupply) * (BigInt(10) ** BigInt(decimals));

  // CEP-18 v2.0.0 required arguments only
  // Optional: events_mode (defaults to 0), enable_mint_burn (defaults to 0)
  const runtimeArgs = RuntimeArgs.fromMap({
    name: CLValueBuilder.string(input.projectName),
    symbol: CLValueBuilder.string(input.symbol),
    decimals: CLValueBuilder.u8(decimals),
    total_supply: CLValueBuilder.u256(supply.toString())
  });

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      deployerKey.publicKey,
      NETWORK_NAME,
      1,
      1800000
    ),
    DeployUtil.ExecutableDeployItem.newModuleBytes(wasm, runtimeArgs),
    DeployUtil.standardPayment(350000000000)
  );

  // Sign deploy
  const signedDeploy = DeployUtil.signDeploy(deploy, deployerKey);

  // Send deploy using RPC client
  const client = getRpcClient();
  const result = await client.deploy(signedDeploy);
  const deployHash = typeof result === 'string' ? result : (result as any).deploy_hash;

  console.log(`[CEP-18] Deploy submitted: ${deployHash}`);

  if (!options.waitForConfirmation) {
    return { deployHash };
  }

  // Wait for confirmation
  await waitForDeploy(deployHash);

  return { deployHash };
}

/**
 * Load server signer (deployer) key
 */
function loadServerSigner(): Keys.AsymmetricKey | null {
  const hex = process.env.CSPR_DEPLOYER_PRIVATE_KEY_HEX;
  const algo = process.env.CSPR_DEPLOYER_KEY_ALGO || "ed25519";

  if (hex) {
    const secret = Uint8Array.from(Buffer.from(hex, 'hex'));
    if (algo === 'secp256k1') {
      const pub = Keys.Secp256K1.privateToPublicKey(secret);
      return Keys.Secp256K1.parseKeyPair(pub, secret, 'raw');
    } else {
      const pub = Keys.Ed25519.privateToPublicKey(secret);
      return Keys.Ed25519.parseKeyPair(pub, secret);
    }
  }
  return null;
}

/**
 * Check deploy status - handles both Casper 1.x and 2.0 API formats
 */
export async function checkDeployStatus(deployHash: string) {
  const client = getRpcClient();
  try {
    console.log(`[checkDeployStatus] Checking deploy: ${deployHash}`);
    const deployInfo = await client.getDeployInfo(deployHash);

    // Log what we got from RPC
    console.log(`[checkDeployStatus] Response keys:`, Object.keys(deployInfo || {}));

    // Casper 2.0 format: execution_info.execution_result.Version2
    const execInfo = (deployInfo as any).execution_info;
    if (execInfo?.execution_result?.Version2) {
      const v2Result = execInfo.execution_result.Version2;
      const errorMessage = v2Result.error_message;
      console.log(`[checkDeployStatus] Casper 2.0 format - error_message:`, errorMessage);
      if (errorMessage === null || errorMessage === undefined) {
        return { executed: true, success: true };
      } else {
        return { executed: true, success: false, error: errorMessage };
      }
    }

    // Casper 1.x format: execution_results[0].result
    const execution = (deployInfo as any).execution_results?.[0];
    if (!execution) {
      console.log(`[checkDeployStatus] No execution_info or execution_results found. Deploy may still be pending.`);
      return { executed: false, success: false, debug: "No execution data - deploy pending" };
    }

    if (execution.result?.Success) {
      console.log(`[checkDeployStatus] Casper 1.x format - Success`);
      return { executed: true, success: true };
    } else {
      console.log(`[checkDeployStatus] Casper 1.x format - Failure:`, execution.result?.Failure);
      return { executed: true, success: false, error: JSON.stringify(execution.result?.Failure) };
    }
  } catch (e) {
    console.error(`[checkDeployStatus] Error:`, e);
    return { executed: false, success: false, error: String(e) };
  }
}

/**
 * Wait for deploy helper
 */
export async function waitForDeploy(deployHash: string, timeoutMs: number = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const check = await checkDeployStatus(deployHash);
    if (check.executed) {
      return check;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  return { success: false, error: "Timeout" };
}

/**
 * Get contract hashes from deploy (helper for parsing transforms)
 */
export async function getContractHashesFromDeploy(deployHash: string) {
  const client = getRpcClient();
  const deployInfo = await client.getDeployInfo(deployHash);
  const result = deployInfo.execution_results[0].result;

  if (!result.Success) return { contractHash: null, contractPackageHash: null };

  const transforms = result.Success.effect.transforms;

  let contractHash = null;
  let contractPackageHash = null;

  for (const t of transforms) {
    if (t.transform === "WriteContract") {
      contractHash = t.key;
    } else if (t.transform === "WriteContractPackage") {
      contractPackageHash = t.key;
    }
  }

  return { contractHash, contractPackageHash };
}

/**
 * Send CEP-18 token transfer
 * Used to transfer tokens from platform to user
 */
export async function sendTokenTransfer(params: {
  projectId?: string;
  tokenContractHash: string;
  toAddress: string;
  tokenAmount: number;
}) {
  const { tokenContractHash, toAddress, tokenAmount } = params;
  const deployerKey = loadServerSigner();
  if (!deployerKey) throw new Error("Server signer not configured");

  const cep18 = new CEP18Client(RPC_URL, NETWORK_NAME);

  // Format hash for CEP18Client (needs hash- prefix for setContractHash)
  const formattedHash = tokenContractHash.startsWith("hash-")
    ? tokenContractHash
    : `hash-${tokenContractHash}`;

  cep18.setContractHash(formattedHash as `hash-${string}`, undefined);

  const recipientKey = CLPublicKey.fromHex(toAddress);

  // Convert token amount to smallest unit (assuming 9 decimals for now)
  const amountBig = BigInt(Math.floor(tokenAmount * 1_000_000_000));

  // CEP18Client transfer takes args object
  const transferArgs = {
    recipient: recipientKey,
    amount: BigNumber.from(amountBig.toString())
  };

  const deploy = cep18.transfer(
    transferArgs,
    BigNumber.from("3000000000"), // 3 CSPR payment
    deployerKey.publicKey,
    NETWORK_NAME,
    [deployerKey]
  );

  const client = getRpcClient();
  const result = await client.deploy(deploy);
  const deployHash = typeof result === 'string' ? result : (result as any).deploy_hash;

  return { deployHash };
}

/**
 * Get token balance
 */
export async function getTokenBalance(contractHash: string, userPublicKey: string) {
  const cep18 = new CEP18Client(RPC_URL, NETWORK_NAME);
  // Format hash for CEP18Client
  const formattedHash = contractHash.startsWith("hash-")
    ? contractHash
    : `hash-${contractHash}`;

  cep18.setContractHash(formattedHash as `hash-${string}`, undefined);

  const balance = await cep18.balanceOf(CLPublicKey.fromHex(userPublicKey));
  return balance.toString();
}

/**
 * Legacy support: createTokenDeployParams for API compatibility
 */
export function createTokenDeployParams(input: DeployInput) {
  const decimals = input.decimals ?? 9;
  const supply = BigInt(input.totalSupply) * (BigInt(10) ** BigInt(decimals));

  const creatorKey = CLPublicKey.fromHex(input.creatorPublicKey);

  const runtimeArgs = RuntimeArgs.fromMap({
    name: CLValueBuilder.string(input.projectName),
    symbol: CLValueBuilder.string(input.symbol),
    decimals: CLValueBuilder.u8(decimals),
    total_supply: CLValueBuilder.u256(supply.toString())
  });

  const wasm = readCep18Wasm();

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      creatorKey,
      NETWORK_NAME,
      1,
      1800000
    ),
    DeployUtil.ExecutableDeployItem.newModuleBytes(wasm, runtimeArgs),
    DeployUtil.standardPayment(250000000000)
  );

  return {
    deploy,
    deployJson: DeployUtil.deployToJson(deploy),
    deployHash: Buffer.from(deploy.hash).toString("hex"),
    creatorKey,
    runtimeArgs,
    name: input.projectName,
    symbol: input.symbol,
    totalSupply: input.totalSupply,
    decimals
  };
}

/**
 * Legacy support: createCSPRTransferParams
 */
export function createCSPRTransferParams(
  fromPublicKey: string,
  toPublicKey: string,
  amount: string | number,
  transferId: number = 0
) {
  const sender = CLPublicKey.fromHex(fromPublicKey);
  const recipient = CLPublicKey.fromHex(toPublicKey);

  // Assume input is CSPR, convert to motes
  const amountVal = typeof amount === 'string' ? parseFloat(amount) : amount;
  const motes = BigInt(Math.floor(amountVal * 1_000_000_000));

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      sender,
      NETWORK_NAME,
      1,
      1800000
    ),
    DeployUtil.ExecutableDeployItem.newTransfer(
      motes.toString(),
      recipient,
      undefined,
      transferId
    ),
    DeployUtil.standardPayment(100000000)
  );

  return {
    deploy,
    deployJson: DeployUtil.deployToJson(deploy),
    deployHash: Buffer.from(deploy.hash).toString("hex")
  };
}

/**
 * Legacy support: createTokenTransferParams
 */
export function createTokenTransferParams(
  contractHash: string,
  senderPublicKey: string,
  recipientPublicKey: string,
  amount: string
) {
  const sender = CLPublicKey.fromHex(senderPublicKey);
  const recipientKey = CLPublicKey.fromHex(recipientPublicKey);
  const amountBig = BigNumber.from(amount);

  // Format hash
  const hashHex = contractHash.startsWith("hash-") ? contractHash.slice(5) : contractHash;
  const contractHashBytes = Uint8Array.from(Buffer.from(hashHex, "hex"));

  const runtimeArgs = RuntimeArgs.fromMap({
    recipient: CLValueBuilder.key(recipientKey),
    amount: CLValueBuilder.u256(amountBig.toString())
  });

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      sender,
      NETWORK_NAME,
      1,
      1800000
    ),
    DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      contractHashBytes,
      "transfer",
      runtimeArgs
    ),
    DeployUtil.standardPayment(3000000000)
  );

  return {
    deploy,
    deployJson: DeployUtil.deployToJson(deploy),
    deployHash: Buffer.from(deploy.hash).toString("hex")
  };
}


/**
 * Send CSPR Transfer (Server Side)
 * Updated to accept object for compatibility with sell/execute/route.ts
 */
export async function sendCSPRTransfer(params: {
  toAddress: string;
  amountCSPR: number;
}) {
  const { toAddress, amountCSPR } = params;

  const deployerKey = loadServerSigner();
  if (!deployerKey) throw new Error("Server signer not configured");

  const client = getRpcClient();

  // Convert CSPR to motes
  const motes = BigInt(Math.floor(amountCSPR * 1_000_000_000));

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      deployerKey.publicKey,
      NETWORK_NAME,
      1,
      1800000
    ),
    DeployUtil.ExecutableDeployItem.newTransfer(
      motes.toString(),
      CLPublicKey.fromHex(toAddress),
      undefined,
      Date.now()
    ),
    DeployUtil.standardPayment(100000000)
  );

  const signedDeploy = DeployUtil.signDeploy(deploy, deployerKey);
  const result = await client.deploy(signedDeploy);

  // Check if result is string (hash) or object
  const deployHash = typeof result === 'string' ? result : (result as any).deploy_hash;

  return { deployHash };
}
