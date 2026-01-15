"use client";

import {
  DeployUtil,
  CLValueBuilder,
  RuntimeArgs,
  CLPublicKey,
  CLByteArray
} from "casper-js-sdk";
import { publicRuntime } from "./client-config";

type TokenDeployInput = {
  projectName: string;
  symbol: string;
  totalSupply: number;
  creatorPublicKey: string;
  decimals?: number;
};

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_GAS_PRICE = 1;
// 250 CSPR in motes
const TOKEN_DEPLOY_PAYMENT = 250_000_000_000;

/**
 * Fetch CEP-18 WASM from public directory
 */
async function fetchCep18Wasm(): Promise<Uint8Array> {
  const response = await fetch("/contracts/cep18.wasm");
  if (!response.ok) {
    throw new Error(
      "Failed to fetch CEP-18 WASM. Ensure cep18.wasm is in public/contracts/ directory."
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Build CEP-18 runtime arguments
 */
function buildCep18RuntimeArgs(input: TokenDeployInput): RuntimeArgs {
  const decimals = input.decimals ?? 9;
  const totalSupplyWithDecimals = (
    BigInt(input.totalSupply) * BigInt(Math.pow(10, decimals))
  ).toString();

  return RuntimeArgs.fromMap({
    name: CLValueBuilder.string(input.projectName),
    symbol: CLValueBuilder.string(input.symbol),
    decimals: CLValueBuilder.u8(decimals),
    total_supply: CLValueBuilder.u256(totalSupplyWithDecimals),
    events_mode: CLValueBuilder.u8(1),
    enable_mint_burn: CLValueBuilder.u8(0)
  });
}

/**
 * Build an unsigned CEP-18 token deployment for wallet signing.
 * This is the client-side version that fetches WASM from the public directory.
 */
export async function buildClientTokenDeploy(input: TokenDeployInput) {
  const wasmBytes = await fetchCep18Wasm();
  const accountKey = CLPublicKey.fromHex(input.creatorPublicKey);
  const runtimeArgs = buildCep18RuntimeArgs(input);

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      accountKey,
      publicRuntime.chainName,
      DEFAULT_GAS_PRICE,
      DEFAULT_TTL_MS
    ),
    DeployUtil.ExecutableDeployItem.newModuleBytes(wasmBytes, runtimeArgs),
    DeployUtil.standardPayment(TOKEN_DEPLOY_PAYMENT)
  );

  const deployJson = DeployUtil.deployToJson(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy to JSON");
  }

  return {
    deploy,
    deployJson,
    deployHash: Buffer.from(deploy.hash).toString("hex"),
    creatorKey: accountKey,
    runtimeArgs,
    name: input.projectName,
    symbol: input.symbol,
    totalSupply: input.totalSupply,
    decimals: input.decimals ?? 9,
  };
}

/**
 * Fetch lock_cspr session WASM from public directory
 */
async function fetchLockCsprWasm(): Promise<Uint8Array> {
  const response = await fetch("/wasm/lock_cspr_session.wasm");
  if (!response.ok) {
    throw new Error(
      "Failed to fetch lock_cspr session WASM. Ensure lock_cspr_session.wasm is in public/wasm/ directory."
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Build a lock_cspr session deploy for locking CSPR in the vault.
 * The session code transfers CSPR from the caller's main purse to the vault contract.
 */
export async function buildLockCsprDeploy(params: {
  senderPublicKey: string;
  vaultContractHash: string; // The contract hash of the token vault (without "hash-" prefix)
  orderId: string;
  amountMotes: string; // Amount in motes to lock
  chainName?: string;
  paymentAmount?: string;
}) {
  const {
    senderPublicKey,
    vaultContractHash,
    orderId,
    amountMotes,
    chainName = publicRuntime.chainName,
    paymentAmount = "3000000000", // 3 CSPR for gas (session code + transfer)
  } = params;

  const wasmBytes = await fetchLockCsprWasm();
  const accountKey = CLPublicKey.fromHex(senderPublicKey);

  // Build runtime args for the session contract
  // The vault contract hash needs to be passed as a ContractHash (32 bytes)
  const cleanHash = vaultContractHash.replace("contract-", "").replace("hash-", "");
  const contractHashBytes = new Uint8Array(
    (cleanHash.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
  );

  const runtimeArgs = RuntimeArgs.fromMap({
    vault_contract_hash: new CLByteArray(contractHashBytes),
    order_id: CLValueBuilder.string(orderId),
    amount: CLValueBuilder.u512(amountMotes),
  });

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      accountKey,
      chainName,
      DEFAULT_GAS_PRICE,
      DEFAULT_TTL_MS
    ),
    DeployUtil.ExecutableDeployItem.newModuleBytes(wasmBytes, runtimeArgs),
    DeployUtil.standardPayment(parseInt(paymentAmount))
  );

  const deployJson = DeployUtil.deployToJson(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize lock_cspr deploy to JSON");
  }

  return {
    deploy,
    deployJson,
    deployHash: Buffer.from(deploy.hash).toString("hex"),
    orderId,
    amountMotes,
    vaultContractHash,
  };
}

/**
 * Build a simple CSPR transfer deploy for wallet signing
 */
export function buildTransferDeploy(params: {
  fromPublicKey: string;
  toPublicKey: string;
  amount: string; // in motes
  chainName?: string;
  paymentAmount?: string;
}) {
  const {
    fromPublicKey,
    toPublicKey,
    amount,
    chainName = publicRuntime.chainName,
    paymentAmount = "100000000", // 0.1 CSPR default
  } = params;

  const senderKey = CLPublicKey.fromHex(fromPublicKey);
  const recipientKey = CLPublicKey.fromHex(toPublicKey);

  const deploy = DeployUtil.makeDeploy(
    new DeployUtil.DeployParams(
      senderKey,
      chainName,
      DEFAULT_GAS_PRICE,
      DEFAULT_TTL_MS
    ),
    DeployUtil.ExecutableDeployItem.newTransfer(
      parseInt(amount),
      recipientKey,
      undefined,
      Date.now() // Transfer ID
    ),
    DeployUtil.standardPayment(parseInt(paymentAmount))
  );

  const deployJson = DeployUtil.deployToJson(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy to JSON");
  }

  return {
    deploy,
    deployJson,
    deployHash: Buffer.from(deploy.hash).toString("hex"),
  };
}

/**
 * Send a signed deploy to the network via the backend proxy.
 * This handles adding the signature to the deploy if not already present.
 */
export async function sendSignedDeploy(
  deployJson: unknown,
  signatureHex: string,
  publicKeyHex: string
): Promise<string> {
  // Ensure we have a working JSON object
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deployObj: any;

  if (typeof deployJson === 'string') {
    try {
      deployObj = JSON.parse(deployJson);
    } catch {
      throw new Error("Invalid deploy JSON string");
    }
  } else if (typeof deployJson === 'object' && deployJson !== null) {
    deployObj = deployJson;
  } else {
    throw new Error("Invalid deploy JSON");
  }

  // SDK v2 structure check - unwrap if wrapped in { deploy: ... }
  if (deployObj && typeof deployObj === 'object' && 'deploy' in deployObj) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deployObj = (deployObj as any).deploy;
  }

  // Ensure approvals array exists
  if (!Array.isArray(deployObj.approvals)) {
    deployObj.approvals = [];
  }

  // Check if approval from this signer already exists
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hasApproval = deployObj.approvals.some(
    (a: any) => a.signer?.toLowerCase() === publicKeyHex.toLowerCase()
  );

  if (!hasApproval) {
    // Add the approval
    deployObj.approvals.push({
      signer: publicKeyHex,
      signature: signatureHex
    });
  }

  // Send to proxy
  const response = await fetch("/api/proxy/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deploy: deployObj,
      signatureHex
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit deploy");
  }

  const result = await response.json();
  return result.deployHash;
}
