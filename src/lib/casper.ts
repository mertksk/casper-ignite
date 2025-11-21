import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import {
  Args,
  CLValue,
  Deploy,
  DeployHeader,
  Duration,
  ExecutableDeployItem,
  HttpHandler,
  KeyAlgorithm,
  ModuleBytes,
  PrivateKey,
  PublicKey,
  RpcClient,
  Timestamp,
  makeCep18TransferDeploy,
  makeCsprTransferDeploy,
} from "casper-js-sdk";
import { appConfig } from "./config";

type DeployInput = {
  projectName: string;
  symbol: string;
  totalSupply: number;
  creatorPublicKey: string;
  decimals?: number;
};

const NETWORK_NAME = appConfig.NEXT_PUBLIC_CHAIN_NAME;
const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_GAS_PRICE = 1;
const TOKEN_DEPLOY_PAYMENT = "150000000000"; // 150 CSPR in motes
const TRANSFER_PAYMENT = "100000000"; // 0.1 CSPR in motes
const TOKEN_TRANSFER_PAYMENT = "3000000000"; // 3 CSPR in motes for CEP-18 transfers

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

function normalizeHash(hash: string): string {
  return hash.startsWith("hash-") ? hash.slice(5) : hash;
}

function readCep18Wasm(): Uint8Array {
  const wasmPath = join(process.cwd(), "public", "contracts", "cep18.wasm");
  try {
    const bytes = new Uint8Array(readFileSync(wasmPath));
    verifyWasmChecksum(bytes);
    return bytes;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    throw new Error(
      `CEP-18 WASM not found at public/contracts/cep18.wasm. Download it from https://github.com/casper-ecosystem/cep18/releases and retry. (${reason})`
    );
  }
}

function buildCep18RuntimeArgs(input: DeployInput): Args {
  const decimals = validateTokenParams(input);
  const supplyWithDecimals = (
    BigInt(input.totalSupply) *
    BigInt(10) ** BigInt(decimals)
  ).toString();

  return Args.fromMap({
    name: CLValue.newCLString(input.projectName),
    symbol: CLValue.newCLString(input.symbol),
    decimals: CLValue.newCLUint8(decimals),
    total_supply: CLValue.newCLUInt256(supplyWithDecimals),
  });
}

function buildUnsignedTokenDeploy(input: DeployInput) {
  const wasmBytes = readCep18Wasm();
  const creatorKey = PublicKey.fromHex(input.creatorPublicKey);
  const runtimeArgs = buildCep18RuntimeArgs(input);

  const session = new ExecutableDeployItem();
  session.moduleBytes = new ModuleBytes(wasmBytes, runtimeArgs);

  const payment = ExecutableDeployItem.standardPayment(TOKEN_DEPLOY_PAYMENT);

  const header = new DeployHeader(
    NETWORK_NAME,
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date()),
    new Duration(DEFAULT_TTL_MS),
    creatorKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);

  return {
    deploy,
    deployJson: Deploy.toJSON(deploy),
    deployHash: deploy.hash.toHex(),
    creatorKey,
    runtimeArgs,
    name: input.projectName,
    symbol: input.symbol,
    totalSupply: input.totalSupply,
    decimals: input.decimals ?? 9,
  };
}

function loadServerSigner(): PrivateKey | null {
  const pem = process.env.CSPR_DEPLOYER_PRIVATE_KEY_PEM;
  const hex = process.env.CSPR_DEPLOYER_PRIVATE_KEY_HEX;
  const algo = (process.env.CSPR_DEPLOYER_KEY_ALGO ?? "ed25519").toLowerCase();
  const algorithm = algo === "secp256k1" ? KeyAlgorithm.SECP256K1 : KeyAlgorithm.ED25519;

  if (pem) {
    return PrivateKey.fromPem(pem, algorithm);
  }
  if (hex) {
    return PrivateKey.fromHex(hex, algorithm);
  }
  return null;
}

/**
 * Deploy a CEP-18 token contract on the configured network.
 * Requires a server-side signer (CSPR_DEPLOYER_PRIVATE_KEY_* environment variables).
 */
export async function deployProjectToken(input: DeployInput): Promise<{
  contractHash: string;
  contractPackageHash?: string;
  deployHash: string;
}> {
  const unsigned = buildUnsignedTokenDeploy(input);
  const signer = loadServerSigner();

  if (!signer) {
    throw new Error(
      "Server-side deployer key not configured. Set CSPR_DEPLOYER_PRIVATE_KEY_PEM or CSPR_DEPLOYER_PRIVATE_KEY_HEX (optionally CSPR_DEPLOYER_KEY_ALGO) to sign and submit deploys."
    );
  }

  unsigned.deploy.sign(signer);

  await withRpcFallback((client) => client.putDeploy(unsigned.deploy));

  const deployHash = unsigned.deploy.hash.toHex();
  const waitResult = await waitForDeploy(deployHash, 300_000);

  if (!waitResult.executed || !waitResult.success) {
    throw new Error(waitResult.error ?? "Token deployment failed on-chain");
  }

  const hashes = await getContractHashesFromDeploy(deployHash);
  if (!hashes.contractHash) {
    throw new Error("Deploy executed but contract hash could not be determined");
  }

  console.info("[DEPLOY] CEP-18 deployed", {
    deployHash,
    contractHash: hashes.contractHash,
    contractPackageHash: hashes.contractPackageHash,
    symbol: input.symbol,
    totalSupply: input.totalSupply,
  });

  return {
    contractHash: hashes.contractHash,
    contractPackageHash: hashes.contractPackageHash ?? undefined,
    deployHash,
  };
}

/**
 * Create an unsigned CEP-18 deployment (for wallet signing).
 */
export function createTokenDeployParams(input: DeployInput) {
  return buildUnsignedTokenDeploy(input);
}

/**
 * Check deploy status on the blockchain.
 */
export async function checkDeployStatus(deployHash: string): Promise<{
  executed: boolean;
  success: boolean;
  error?: string;
  result?: unknown;
}> {
  const cleanHash = normalizeHash(deployHash);

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
      return { executed: true, success: true, result: execution };
    }

    if (failureResult) {
      const errorMsg =
        failureResult.errorMessage ??
        failureResult.error_message ??
        JSON.stringify(failureResult);
      return { executed: true, success: false, error: errorMsg, result: execution };
    }

    return { executed: false, success: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      executed: false,
      success: false,
      error: message,
    };
  }
}

/**
 * Get contract and package hashes from a successful deploy (best-effort parse).
 */
export async function getContractHashesFromDeploy(
  deployHash: string
): Promise<{ contractHash: string | null; contractPackageHash: string | null }> {
  const cleanHash = normalizeHash(deployHash);

  try {
    const result = await withRpcFallback((client) => client.getDeploy(cleanHash));
    const execution =
      result.executionResultsV1?.[0] ?? result.rawJSON?.execution_results?.[0];

    if (!execution) return { contractHash: null, contractPackageHash: null };

    const transforms =
      execution.result?.success?.effect?.transforms ??
      execution.result?.Success?.effect?.transforms ??
      execution.result?.success?.effects ??
      execution.result?.Success?.effects ??
      execution.result?.effect?.transforms ??
      [];

    const contractCandidates: string[] = [];
    const packageCandidates: string[] = [];

    for (const entry of transforms) {
      const key =
        typeof entry.key === "string"
          ? entry.key
          : entry.key?.toPrefixedString?.() ?? entry.key?.toString?.();

      if (key && key.startsWith("hash-") && key.includes("contractpackage")) {
        packageCandidates.push(key);
      } else if (key && key.startsWith("hash-") && key.includes("contract")) {
        contractCandidates.push(key);
      }

      const transform = entry.transform ?? entry.kind ?? entry;
      const transformationData = transform?.transformationData ?? transform;

      if (transform?.isWriteContract?.() || transform?.isTransformation?.("WriteContract")) {
        if (key) {
          contractCandidates.push(key);
        }
      }

      if (transform?.isWriteContractPackage?.() || transform?.isTransformation?.("WriteContractPackage")) {
        if (key) {
          packageCandidates.push(key);
        }
      }

      if (transformationData && typeof transformationData === "object") {
        const writeContract =
          transformationData.WriteContract ??
          transformationData.writeContract ??
          transformationData.contract;
        const writePackage =
          transformationData.WriteContractPackage ?? transformationData.contractPackage;

        const maybeHash =
          (writeContract && (writeContract.hash ?? writeContract)) ||
          (writePackage && (writePackage.hash ?? writePackage));

        if (typeof maybeHash === "string") {
          const fullHash = maybeHash.startsWith("hash-") ? maybeHash : `hash-${maybeHash}`;
          if (writePackage) {
            packageCandidates.push(fullHash);
          } else {
            contractCandidates.push(fullHash);
          }
        }
      }
    }

    return {
      contractHash: contractCandidates.find((hash) => hash.startsWith("hash-")) ?? null,
      contractPackageHash: packageCandidates.find((hash) => hash.startsWith("hash-")) ?? null,
    };
  } catch {
    return { contractHash: null, contractPackageHash: null };
  }
}

/**
 * Create CSPR transfer deploy parameters (unsigned).
 */
export function createCSPRTransferParams(
  fromPublicKey: string,
  toPublicKey: string,
  amountCspr: string | number
) {
  const transferAmount = csprToMotes(Number(amountCspr)).toString();

  const deploy = makeCsprTransferDeploy({
    senderPublicKeyHex: fromPublicKey,
    recipientPublicKeyHex: toPublicKey,
    transferAmount,
    chainName: NETWORK_NAME,
    paymentAmount: TRANSFER_PAYMENT,
    gasPrice: DEFAULT_GAS_PRICE,
    ttl: DEFAULT_TTL_MS,
  });

  return {
    deployJson: Deploy.toJSON(deploy),
    deployHash: deploy.hash.toHex(),
  };
}

/**
 * Create CEP-18 token transfer deploy parameters (unsigned).
 */
export function createTokenTransferParams(
  tokenContractHash: string,
  fromPublicKey: string,
  toPublicKey: string,
  amount: string,
  paymentAmount: string = TOKEN_TRANSFER_PAYMENT
) {
  const contractPackageHash = normalizeHash(tokenContractHash);

  const deploy = makeCep18TransferDeploy({
    contractPackageHash,
    senderPublicKeyHex: fromPublicKey,
    recipientPublicKeyHex: toPublicKey,
    transferAmount: amount,
    paymentAmount,
    chainName: NETWORK_NAME,
    gasPrice: DEFAULT_GAS_PRICE,
    ttl: DEFAULT_TTL_MS,
  });

  return {
    deployJson: Deploy.toJSON(deploy),
    deployHash: deploy.hash.toHex(),
  };
}

/**
 * Wait for deploy to complete (polls RPC).
 */
export async function waitForDeploy(
  deployHash: string,
  timeoutMs: number = 300_000
): Promise<{ executed: boolean; success: boolean; error?: string }> {
  const cleanHash = normalizeHash(deployHash);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await checkDeployStatus(cleanHash);
    if (status.executed) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  return { executed: false, success: false, error: "Deploy timeout exceeded" };
}

/**
 * Get token balance (CEP-18 dictionary lookup via balances dictionary).
 */
export async function getTokenBalance(
  tokenPackageOrContractHash: string,
  accountPublicKey: string
): Promise<string> {
  const cleanHash = normalizeHash(tokenPackageOrContractHash);
  const accountHashHex = PublicKey.fromHex(accountPublicKey).accountHash().toHex();
  const dictionaryKey = `account-hash-${accountHashHex}`;

  try {
    const result = await withRpcFallback((client) =>
      client.queryLatestGlobalState(`hash-${cleanHash}`, ["balances", dictionaryKey])
    );

    const rawStoredValue =
      (result as { storedValue?: unknown; stored_value?: unknown; rawJSON?: unknown }).storedValue ??
      (result as { storedValue?: unknown; stored_value?: unknown; rawJSON?: unknown }).stored_value ??
      (result as { storedValue?: unknown; stored_value?: unknown; rawJSON?: { stored_value?: unknown } }).rawJSON
        ?.stored_value;

    const value =
      (rawStoredValue as { clValue?: unknown; CLValue?: unknown })?.clValue ??
      (rawStoredValue as { clValue?: unknown; CLValue?: unknown })?.CLValue;

    const parsedValue = (value as { parsed?: unknown })?.parsed;
    if (!value || !parsedValue) {
      return "0";
    }

    if (typeof parsedValue === "string") return parsedValue;
    if ((parsedValue as { u256?: unknown })?.u256) return (parsedValue as { u256: string }).u256.toString();
    if ((parsedValue as { u128?: unknown })?.u128) return (parsedValue as { u128: string }).u128.toString();
    return String(parsedValue);
  } catch (error) {
    console.error("Error getting token balance:", error);
    return "0";
  }
}

/**
 * Convert motes to CSPR.
 */
export function motesToCSPR(motes: number | string | bigint): number {
  const motesBig = typeof motes === "bigint" ? motes : BigInt(motes.toString());
  return Number(motesBig) / 1_000_000_000;
}

/**
 * Convert CSPR to motes.
 */
export function csprToMotes(cspr: number | string): bigint {
  const csprNumber = typeof cspr === "string" ? Number(cspr) : cspr;
  return BigInt(Math.round(csprNumber * 1_000_000_000));
}

function validateTokenParams(input: DeployInput): number {
  if (!input.projectName || input.projectName.trim().length < 3) {
    throw new Error("Project name must be at least 3 characters.");
  }
  if (!/^[A-Z0-9]{3,8}$/.test(input.symbol)) {
    throw new Error("Symbol must be 3-8 uppercase letters/numbers.");
  }
  if (input.totalSupply <= 0) {
    throw new Error("Total supply must be positive.");
  }
  const decimals = input.decimals ?? 9;
  if (decimals < 0 || decimals > 18) {
    throw new Error("Decimals must be between 0 and 18.");
  }
  return decimals;
}

function verifyWasmChecksum(bytes: Uint8Array) {
  const expected = process.env.CEP18_WASM_SHA256?.trim();
  if (!expected) return;
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== expected) {
    throw new Error(
      `CEP-18 WASM checksum mismatch. Expected ${expected}, computed ${digest}. Refresh the wasm file.`
    );
  }
}
