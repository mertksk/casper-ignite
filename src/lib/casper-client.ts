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
