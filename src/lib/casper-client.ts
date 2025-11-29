"use client";

import {
  Args,
  CLValue,
  Deploy,
  DeployHeader,
  Duration,
  ExecutableDeployItem,
  ModuleBytes,
  PublicKey,
  Timestamp,
  makeCsprTransferDeploy,
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
const TOKEN_DEPLOY_PAYMENT = "250000000000"; // 250 CSPR

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
function buildCep18RuntimeArgs(input: TokenDeployInput): Args {
  const decimals = input.decimals ?? 9;
  const totalSupplyWithDecimals = (
    BigInt(input.totalSupply) * BigInt(10) ** BigInt(decimals)
  ).toString();

  return Args.fromMap({
    name: CLValue.newCLString(input.projectName),
    symbol: CLValue.newCLString(input.symbol),
    decimals: CLValue.newCLUint8(decimals),
    total_supply: CLValue.newCLUInt256(totalSupplyWithDecimals),
  });
}

/**
 * Build an unsigned CEP-18 token deployment for wallet signing.
 * This is the client-side version that fetches WASM from the public directory.
 */
export async function buildClientTokenDeploy(input: TokenDeployInput) {
  const wasmBytes = await fetchCep18Wasm();
  const accountKey = PublicKey.fromHex(input.creatorPublicKey);
  const runtimeArgs = buildCep18RuntimeArgs(input);

  const session = new ExecutableDeployItem();
  session.moduleBytes = new ModuleBytes(wasmBytes, runtimeArgs);

  const payment = ExecutableDeployItem.standardPayment(TOKEN_DEPLOY_PAYMENT);

  const header = new DeployHeader(
    publicRuntime.chainName,
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date(Date.now() - 20000)), // 20s buffer for clock skew
    new Duration(DEFAULT_TTL_MS),
    accountKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);
  const deployJson = Deploy.toJSON(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy to JSON");
  }

  return {
    deploy,
    deployJson,
    deployHash: deploy.hash.toHex(),
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
  const accountKey = PublicKey.fromHex(senderPublicKey);

  // Build runtime args for the session contract
  // The vault contract hash needs to be passed as a ContractHash (32 bytes)
  const cleanHash = vaultContractHash.replace("contract-", "").replace("hash-", "");
  const contractHashBytes = new Uint8Array(
    (cleanHash.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
  );

  const runtimeArgs = Args.fromMap({
    vault_contract_hash: CLValue.newCLByteArray(contractHashBytes),
    order_id: CLValue.newCLString(orderId),
    amount: CLValue.newCLUInt512(amountMotes),
  });

  const session = new ExecutableDeployItem();
  session.moduleBytes = new ModuleBytes(wasmBytes, runtimeArgs);

  const payment = ExecutableDeployItem.standardPayment(paymentAmount);

  const header = new DeployHeader(
    chainName,
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date(Date.now() - 20000)), // 20s buffer for clock skew
    new Duration(DEFAULT_TTL_MS),
    accountKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);
  const deployJson = Deploy.toJSON(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize lock_cspr deploy to JSON");
  }

  return {
    deploy,
    deployJson,
    deployHash: deploy.hash.toHex(),
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

  const deploy = makeCsprTransferDeploy({
    senderPublicKeyHex: fromPublicKey,
    recipientPublicKeyHex: toPublicKey,
    transferAmount: amount,
    chainName,
    paymentAmount,
  });

  const deployJson = Deploy.toJSON(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy to JSON");
  }

  return {
    deploy,
    deployJson,
    deployHash: deploy.hash.toHex(),
  };
}
