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
const TOKEN_DEPLOY_PAYMENT = "250000000000"; // 250 CSPR in motes (CEP-18 deployment needs ~200+ CSPR)
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

/**
 * Verify that the configured chain name matches the RPC endpoint.
 * This helps catch configuration mismatches early.
 */
async function verifyChainName(): Promise<void> {
  try {
    const status = await withRpcFallback((client) => client.getStatus());
    const statusRaw = status as unknown as { chainspec_name?: string; chain_spec_name?: string };
    const rpcChainName = status.chainSpecName ?? statusRaw.chainspec_name ?? statusRaw.chain_spec_name;

    if (rpcChainName && rpcChainName !== NETWORK_NAME) {
      console.warn(
        `[CHAIN NAME MISMATCH] Configuration chain name "${NETWORK_NAME}" does not match RPC chain name "${rpcChainName}". ` +
        `This will cause deploys to be rejected. Update NEXT_PUBLIC_CHAIN_NAME in your .env file to "${rpcChainName}".`
      );
    } else {
      console.log(`[CHAIN VERIFIED] Chain name "${NETWORK_NAME}" matches RPC endpoint.`);
    }
  } catch (error) {
    console.warn("[CHAIN VERIFICATION FAILED] Could not verify chain name:", error instanceof Error ? error.message : String(error));
  }
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

function buildUnsignedTokenDeploy(input: DeployInput, deployerPublicKey?: PublicKey) {
  const wasmBytes = readCep18Wasm();
  // Use deployerPublicKey if provided (server-side), otherwise use creator's key (client-side)
  const accountKey = deployerPublicKey ?? PublicKey.fromHex(input.creatorPublicKey);
  const runtimeArgs = buildCep18RuntimeArgs(input);

  const session = new ExecutableDeployItem();
  session.moduleBytes = new ModuleBytes(wasmBytes, runtimeArgs);

  const payment = ExecutableDeployItem.standardPayment(TOKEN_DEPLOY_PAYMENT);

  const header = new DeployHeader(
    NETWORK_NAME,
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date(Date.now() - 20000)), // 20s buffer for clock skew
    new Duration(DEFAULT_TTL_MS),
    accountKey  // Use the account that will sign the deploy
  );

  const deploy = Deploy.makeDeploy(header, payment, session);

  return {
    deploy,
    deployJson: Deploy.toJSON(deploy),
    deployHash: deploy.hash.toHex(),
    creatorKey: accountKey,
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
 * Check if the deployer account has enough funds.
 * Throws a detailed error if the account is empty (unfunded) or has insufficient balance.
 */
async function checkDeployerBalance(publicKeyHex: string, requiredMotes: string) {
  try {
    const accountHash = PublicKey.fromHex(publicKeyHex).accountHash().toHex();
    const key = `account-hash-${accountHash}`;

    // Use the simpler queryLatestGlobalState which handles root hash internally
    const result = await withRpcFallback((c) =>
      c.queryLatestGlobalState(key, [])
    );

    const resultRaw = result as unknown as {
      Account?: unknown;
      storedValue?: { account?: unknown };
      stored_value?: { account?: unknown };
    };

    // Try different case variations (account vs Account)
    const account = resultRaw.Account ??
                    resultRaw.storedValue?.account ??
                    resultRaw.stored_value?.account ??
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (resultRaw as any).storedValue?.Account ??
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (resultRaw as any).stored_value?.Account;

    if (!account) {
      // If we get a result but no account object, it might mean account doesn't exist
      throw new Error("Account structure not found in query result.");
    }

    const accountData = account as { mainPurse: string };
    const mainPurse = accountData.mainPurse;

    if (!mainPurse) {
      throw new Error("Main purse not found in account data");
    }

    // Query the balance using a direct RPC call instead of the SDK method
    // The SDK's queryLatestBalance has serialization issues with PurseIdentifier
    const rpcUrl = appConfig.rpcUrls.primary;
    const balanceResponse = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "query_balance",
        params: { purse_identifier: { main_purse_under_public_key: publicKeyHex } },
        id: 1
      })
    });

    const balanceData = await balanceResponse.json();

    if (balanceData.error) {
      throw new Error(`Balance query failed: ${balanceData.error.message ?? JSON.stringify(balanceData.error)}`);
    }

    if (!balanceData.result?.balance) {
      throw new Error("Balance not found in RPC response");
    }

    const balanceMotes = BigInt(balanceData.result.balance);
    const required = BigInt(requiredMotes);

    console.log(`[Balance Check] Account ${publicKeyHex} has ${motesToCSPR(balanceMotes)} CSPR (required: ${motesToCSPR(required)} CSPR)`);

    if (balanceMotes < required) {
      throw new Error(
        `Insufficient funds. Address: ${publicKeyHex}\n` +
        `Required: ${motesToCSPR(required)} CSPR\n` +
        `Current: ${motesToCSPR(balanceMotes)} CSPR\n` +
        `Please fund this address via the Testnet Faucet: https://testnet.cspr.live/tools/faucet`
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const errorRaw = error as unknown as { statusCode?: number; code?: number };
    const errorCode = errorRaw.statusCode ?? errorRaw.code;

    // Error code -32003 means "Query failed" which typically indicates account doesn't exist
    // Explicitly handle query failures and account not found errors
    if (
      errorCode === -32003 ||
      msg.includes("Query failed") ||
      msg.includes("Account not found") ||
      msg.includes("Value not found") ||
      msg.includes("Missing key") ||
      msg.includes("Account structure not found")
    ) {
      throw new Error(
        `❌ DEPLOYER ACCOUNT NOT FUNDED\n\n` +
        `The deployer wallet has never received funds on Casper Testnet.\n\n` +
        `Public Key: ${publicKeyHex}\n` +
        `Required: ${motesToCSPR(requiredMotes)} CSPR (minimum)\n\n` +
        `📝 To fix this:\n` +
        `1. Visit the Casper Testnet Faucet: https://testnet.cspr.live/tools/faucet\n` +
        `2. Enter the public key above\n` +
        `3. Request at least 200 CSPR\n` +
        `4. Wait for the transaction to complete (~1-2 minutes)\n` +
        `5. Try deploying again`
      );
    }

    // For other unexpected errors, log warning but ALLOW flow to proceed.
    // This prevents blocking valid deployments due to balance check bugs.
    console.warn(`[Balance Check Skipped] Could not verify balance for ${publicKeyHex} due to error: ${msg}. Proceeding with deployment...`);
  }
}

/**
 * Validate deploy before sending to RPC to catch common errors early.
 */
function validateDeploy(deploy: Deploy, signerPublicKeyHex: string) {
  const errors: string[] = [];

  // Check approvals array exists and has at least one entry
  if (!deploy.approvals || deploy.approvals.length === 0) {
    errors.push("Deploy has no approvals - signature may not have been added correctly");
  }

  // Verify the signer's public key matches one of the approvals
  if (deploy.approvals && deploy.approvals.length > 0) {
    const signerMatches = deploy.approvals.some(
      (approval) => approval.signer.toHex() === signerPublicKeyHex
    );
    if (!signerMatches) {
      errors.push(`Signer public key ${signerPublicKeyHex} does not match any approval signatures`);
    }
  }

  // Check deploy hash exists
  if (!deploy.hash) {
    errors.push("Deploy hash is missing");
  }

  // Check header exists and has required fields
  if (!deploy.header) {
    errors.push("Deploy header is missing");
  } else {
    if (!deploy.header.chainName) {
      errors.push("Chain name is missing from deploy header");
    }
    if (!deploy.header.account) {
      errors.push("Account public key is missing from deploy header");
    }
  }

  return errors;
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
  const signer = loadServerSigner();

  if (!signer) {
    throw new Error(
      "Server-side deployer key not configured. Set CSPR_DEPLOYER_PRIVATE_KEY_PEM or CSPR_DEPLOYER_PRIVATE_KEY_HEX (optionally CSPR_DEPLOYER_KEY_ALGO) to sign and submit deploys."
    );
  }

  // Get signer's public key - this must match the deploy header account
  const signerPublicKey = signer.publicKey;
  const signerPublicKeyHex = signerPublicKey.toHex();

  // Build deploy with the server's public key as the account (not the user's)
  const unsigned = buildUnsignedTokenDeploy(input, signerPublicKey);

  // Sign the deploy
  unsigned.deploy.sign(signer);

  // Validate deploy structure before sending
  const validationErrors = validateDeploy(unsigned.deploy, signerPublicKeyHex);
  if (validationErrors.length > 0) {
    console.error("[DEPLOY VALIDATION FAILED]", {
      errors: validationErrors,
      deployHash: unsigned.deploy.hash.toHex(),
      signerPublicKey: signerPublicKeyHex,
      approvalsCount: unsigned.deploy.approvals?.length ?? 0,
    });
    throw new Error(
      `Deploy validation failed:\n${validationErrors.join("\n")}\n\n` +
      `This indicates a problem with deploy construction or signing.`
    );
  }

  // Verify chain name matches RPC (logs warning if mismatch)
  await verifyChainName();

  // Log deploy details for debugging
  console.log("[DEPLOY DEBUG]", {
    deployHash: unsigned.deploy.hash.toHex(),
    chainName: unsigned.deploy.header.chainName,
    signerPublicKey: signerPublicKeyHex,
    accountPublicKey: unsigned.deploy.header.account?.toHex() ?? "unknown",
    approvalsCount: unsigned.deploy.approvals.length,
    approvals: unsigned.deploy.approvals.map(a => ({
      signer: a.signer.toHex(),
      signatureHex: a.signature.toHex?.() ?? "unknown",
    })),
    paymentAmount: TOKEN_DEPLOY_PAYMENT,
    timestamp: unsigned.deploy.header.timestamp?.toString() ?? "unknown",
    ttl: unsigned.deploy.header.ttl?.toString() ?? "unknown",
  });

  // Check balance (may log warning but won't throw unless account is confirmed unfunded)
  await checkDeployerBalance(signerPublicKeyHex, TOKEN_DEPLOY_PAYMENT);

  // Send deploy to RPC
  try {
    await withRpcFallback((client) => client.putDeploy(unsigned.deploy));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorRaw = error as unknown as { statusCode?: number; code?: number };
    const errorCode = errorRaw.statusCode ?? errorRaw.code;

    // Provide helpful error messages based on common issues
    let helpfulMessage = `Failed to submit deploy to Casper RPC: ${errorMsg}`;

    if (errorCode === -32008 || errorMsg.includes("Invalid Deploy")) {
      helpfulMessage += "\n\n" +
        "Error Code -32008 (Invalid Deploy) typically means:\n" +
        "1. The deployer account may be unfunded - get testnet funds from https://testnet.cspr.live/tools/faucet\n" +
        "2. The deploy signature is invalid or missing\n" +
        "3. The chain name doesn't match the network\n" +
        "4. The deploy structure is malformed\n\n" +
        `Deployer address: ${signerPublicKeyHex}\n` +
        `Chain name: ${unsigned.deploy.header.chainName}\n` +
        `RPC endpoint: ${appConfig.rpcUrls.primary}`;
    }

    // Log full deploy JSON for debugging
    console.error("[DEPLOY SUBMISSION FAILED]", {
      error: errorMsg,
      errorCode,
      deployJson: Deploy.toJSON(unsigned.deploy),
    });

    throw new Error(helpfulMessage);
  }

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
 * Verify CSPR payment deploy
 * Checks that a deploy transfers the correct amount to the correct recipient
 */
export async function verifyCSPRPayment(params: {
  deployHash: string;
  expectedAmount: number; // CSPR amount
  expectedRecipient: string; // Public key hex
  senderPublicKey: string; // Public key hex
}): Promise<{
  valid: boolean;
  error?: string;
  actualAmount?: number;
}> {
  const { deployHash, expectedAmount, expectedRecipient, senderPublicKey } = params;
  const cleanHash = normalizeHash(deployHash);

  try {
    const result = await withRpcFallback((client) => client.getDeploy(cleanHash));

    // Check deploy exists and executed successfully
    const execution =
      result.executionResultsV1?.[0] ?? result.rawJSON?.execution_results?.[0];

    if (!execution) {
      return { valid: false, error: "Deploy not yet executed" };
    }

    const successResult = execution.result?.success ?? execution.result?.Success;
    if (!successResult) {
      return { valid: false, error: "Deploy failed on blockchain" };
    }

    // Get deploy details
    const deploy = result.deploy ?? result.rawJSON?.deploy;
    if (!deploy) {
      return { valid: false, error: "Deploy data not found" };
    }

    // Verify sender
    const deployAccount = deploy.header?.account;
    const deployAccountHex = deployAccount?.toHex?.() ?? (deployAccount as unknown as string);

    if (deployAccountHex !== senderPublicKey) {
      return {
        valid: false,
        error: `Sender mismatch. Expected ${senderPublicKey}, got ${deployAccountHex}`,
      };
    }

    // Parse transfer args to get amount and recipient
    const session = deploy.session as unknown as {
      transfer?: { args?: Array<{ name: string; value: unknown }> };
    };
    const transfer = session?.transfer;

    if (!transfer) {
      return { valid: false, error: "Not a transfer deploy" };
    }

    // Get transfer amount (in motes)
    const transferArgs = transfer.args;
    const amountArg = transferArgs?.find((arg) =>
      ["amount", "Amount"].includes(arg.name)
    );

    if (!amountArg) {
      return { valid: false, error: "Transfer amount not found in deploy" };
    }

    const amountValue = amountArg.value as unknown as { parsed?: string } | string;
    const amountStr = typeof amountValue === "string" ? amountValue : (amountValue as { parsed: string }).parsed;
    const amountMotes = BigInt(amountStr);
    const actualAmountCSPR = motesToCSPR(amountMotes);

    // Get recipient
    const targetArg = transferArgs?.find((arg) =>
      ["target", "Target"].includes(arg.name)
    );

    if (!targetArg) {
      return { valid: false, error: "Transfer recipient not found in deploy" };
    }

    const targetValue = targetArg.value as unknown as { parsed?: { PublicKey?: string } } | string;
    const targetPublicKey =
      typeof targetValue === "string"
        ? targetValue
        : (targetValue as { parsed: { PublicKey: string } }).parsed?.PublicKey;

    // Normalize recipient (might be in different formats)
    const recipientHex =
      typeof targetPublicKey === "string" ? targetPublicKey : String(targetPublicKey);

    if (recipientHex !== expectedRecipient) {
      return {
        valid: false,
        error: `Recipient mismatch. Expected ${expectedRecipient}, got ${recipientHex}`,
        actualAmount: actualAmountCSPR,
      };
    }

    // Verify amount (allow 1% tolerance for gas/rounding)
    const tolerance = expectedAmount * 0.01;
    if (
      actualAmountCSPR < expectedAmount - tolerance ||
      actualAmountCSPR > expectedAmount + tolerance
    ) {
      return {
        valid: false,
        error: `Amount mismatch. Expected ${expectedAmount} CSPR, got ${actualAmountCSPR} CSPR`,
        actualAmount: actualAmountCSPR,
      };
    }

    return { valid: true, actualAmount: actualAmountCSPR };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Unknown error verifying payment",
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

/**
 * Load platform token wallet signer from environment variables
 */
function loadPlatformTokenWalletSigner(): PrivateKey | null {
  const privateKeyHex = appConfig.platformTokenWallet.privateKeyHex;
  const keyAlgo = appConfig.platformTokenWallet.keyAlgo;

  if (!privateKeyHex) {
    console.warn("[Platform Token Wallet] No private key configured");
    return null;
  }

  try {
    const algorithm = keyAlgo === "secp256k1" ? KeyAlgorithm.SECP256K1 : KeyAlgorithm.ED25519;
    return PrivateKey.fromHex(privateKeyHex, algorithm);
  } catch (error) {
    console.error("[Platform Token Wallet] Failed to load private key:", error);
    return null;
  }
}

/**
 * Send token transfer from platform wallet to user
 * Used for buy transactions where platform sends tokens to buyer
 */
export async function sendTokenTransfer(params: {
  projectId: string;
  tokenContractHash: string;
  toAddress: string;
  tokenAmount: number;
}): Promise<{ deployHash: string }> {
  const { tokenContractHash, toAddress, tokenAmount } = params;

  // Load platform wallet signer
  const signer = loadPlatformTokenWalletSigner();
  if (!signer) {
    throw new Error(
      "Platform token wallet not configured. Set PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX to send token transfers."
    );
  }

  const signerPublicKey = signer.publicKey;
  const signerPublicKeyHex = signerPublicKey.toHex();

  // Convert token amount to smallest unit (9 decimals)
  const tokenAmountInMotes = (tokenAmount * 1_000_000_000).toString();

  // Normalize contract hash
  const normalizedHash = normalizeHash(tokenContractHash);

  // Build CEP-18 transfer deploy
  const deploy = makeCep18TransferDeploy({
    contractPackageHash: normalizedHash,
    senderPublicKeyHex: signerPublicKeyHex,
    recipientPublicKeyHex: toAddress,
    transferAmount: tokenAmountInMotes,
    paymentAmount: TOKEN_TRANSFER_PAYMENT,
    chainName: NETWORK_NAME,
    gasPrice: DEFAULT_GAS_PRICE,
    ttl: DEFAULT_TTL_MS,
  });

  // Sign the deploy
  deploy.sign(signer);

  // Log deploy details
  console.log("[Token Transfer Deploy]", {
    deployHash: deploy.hash.toHex(),
    from: signerPublicKeyHex,
    to: toAddress,
    tokenAmount,
    contractHash: normalizedHash,
  });

  // Verify chain name
  await verifyChainName();

  // Send deploy to RPC
  try {
    await withRpcFallback((client) => client.putDeploy(deploy));
    console.log(`[Token Transfer] Deploy sent successfully: ${deploy.hash.toHex()}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Token Transfer] Failed to send deploy:`, errorMsg);
    throw new Error(`Failed to send token transfer: ${errorMsg}`);
  }

  return {
    deployHash: deploy.hash.toHex(),
  };
}

/**
 * Send CSPR transfer from platform wallet to user
 * Used for sell transactions where platform sends CSPR to seller
 */
export async function sendCSPRTransfer(params: {
  toAddress: string;
  amountCSPR: number;
}): Promise<{ deployHash: string }> {
  const { toAddress, amountCSPR } = params;

  // Load platform wallet signer
  const signer = loadPlatformTokenWalletSigner();
  if (!signer) {
    throw new Error(
      "Platform token wallet not configured. Set PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX to send CSPR transfers."
    );
  }

  const signerPublicKey = signer.publicKey;
  const signerPublicKeyHex = signerPublicKey.toHex();

  // Convert CSPR to motes
  const amountInMotes = csprToMotes(amountCSPR);

  // Build CSPR transfer deploy
  const deploy = makeCsprTransferDeploy({
    senderPublicKeyHex: signerPublicKeyHex,
    recipientPublicKeyHex: toAddress,
    transferAmount: amountInMotes.toString(),
    chainName: NETWORK_NAME,
    paymentAmount: TRANSFER_PAYMENT,
    gasPrice: DEFAULT_GAS_PRICE,
    ttl: DEFAULT_TTL_MS,
  });

  // Sign the deploy
  deploy.sign(signer);

  // Log deploy details
  console.log("[CSPR Transfer Deploy]", {
    deployHash: deploy.hash.toHex(),
    from: signerPublicKeyHex,
    to: toAddress,
    amountCSPR,
    amountMotes: amountInMotes.toString(),
  });

  // Verify chain name
  await verifyChainName();

  // Send deploy to RPC
  try {
    await withRpcFallback((client) => client.putDeploy(deploy));
    console.log(`[CSPR Transfer] Deploy sent successfully: ${deploy.hash.toHex()}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[CSPR Transfer] Failed to send deploy:`, errorMsg);
    throw new Error(`Failed to send CSPR transfer: ${errorMsg}`);
  }

  return {
    deployHash: deploy.hash.toHex(),
  };
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
