/**
 * Launchpad Client - Frontend integration for Launchpad Controller
 * Provides project creation, token launch, and vesting functionality.
 */

"use client";

import {
  Args,
  CLValue,
  ContractHash,
  Deploy,
  DeployHeader,
  Duration,
  ExecutableDeployItem,
  Hash,
  PublicKey,
  Timestamp,
  StoredContractByHash,
} from "casper-js-sdk";
import { getCasperWalletProvider } from "./casperWallet";

// ============================================================================
// Types
// ============================================================================

export interface LaunchpadStatus {
  configured: boolean;
  contractHash?: string;
  platformFeeBps?: number;
  projectCount?: number;
  network?: string;
}

export interface ProjectInfo {
  id: string;
  name: string;
  symbol: string;
  owner: string;
  tokenContractHash?: string;
  status: "pending" | "launched" | "completed";
  createdAt: number;
  launchedAt?: number;
}

export interface VestingInfo {
  projectId: string;
  beneficiary: string;
  totalAmount: string;
  claimedAmount: string;
  cliffTimestamp: number;
  vestingEndTimestamp: number;
  startTimestamp: number;
}

export interface CreateProjectResult {
  success: boolean;
  deployHash: string;
  projectId?: string;
  message?: string;
  error?: string;
}

export interface LaunchResult {
  success: boolean;
  deployHash: string;
  message?: string;
  error?: string;
}

export interface ClaimResult {
  success: boolean;
  deployHash: string;
  amountClaimed?: string;
  message?: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TTL_MS = 30 * 60 * 1000;
const DEFAULT_GAS_PRICE = 1;
const CREATE_PROJECT_GAS = "10000000000"; // 10 CSPR
const LAUNCH_TOKEN_GAS = "15000000000"; // 15 CSPR
const CLAIM_VESTED_GAS = "5000000000"; // 5 CSPR

const getChainName = () => {
  if (typeof window !== "undefined") {
    return (window as unknown as { __NEXT_DATA__?: { props?: { pageProps?: { chainName?: string } } } }).__NEXT_DATA__?.props?.pageProps?.chainName || "casper-test";
  }
  return "casper-test";
};

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get Launchpad contract status
 */
export async function getLaunchpadStatus(): Promise<LaunchpadStatus> {
  const response = await fetch("/api/launchpad/status");
  if (!response.ok) {
    throw new Error(`Failed to get Launchpad status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get project info by ID
 */
export async function getProjectInfo(projectId: string): Promise<ProjectInfo> {
  const response = await fetch(`/api/launchpad/project/${encodeURIComponent(projectId)}`);
  if (!response.ok) {
    throw new Error(`Failed to get project info: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get vesting info for a beneficiary on a project
 */
export async function getVestingInfo(projectId: string, beneficiary: string): Promise<VestingInfo> {
  const response = await fetch(`/api/launchpad/vesting/${encodeURIComponent(projectId)}/${encodeURIComponent(beneficiary)}`);
  if (!response.ok) {
    throw new Error(`Failed to get vesting info: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get all projects (paginated)
 */
export async function getProjects(page: number = 1, limit: number = 20): Promise<{ projects: ProjectInfo[]; total: number }> {
  const response = await fetch(`/api/launchpad/projects?page=${page}&limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to get projects: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// Contract Functions
// ============================================================================

/**
 * Create a new project on the launchpad
 */
export async function createProject(params: {
  name: string;
  symbol: string;
  senderPublicKey: string;
  platformFeeCSPR: number; // Fee to pay for project creation
}): Promise<CreateProjectResult> {
  const { name, symbol, senderPublicKey, platformFeeCSPR } = params;

  const status = await getLaunchpadStatus();
  if (!status.configured || !status.contractHash) {
    throw new Error("Launchpad contract not configured");
  }

  const cleanHash = status.contractHash.replace("hash-", "");
  const contractHashBytes = new Uint8Array(
    (cleanHash.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const contractHash = new ContractHash(new Hash(contractHashBytes), "contract-");

  const accountKey = PublicKey.fromHex(senderPublicKey);

  const runtimeArgs = Args.fromMap({
    name: CLValue.newCLString(name),
    symbol: CLValue.newCLString(symbol),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "create_project",
    runtimeArgs
  );

  // Payment includes platform fee
  const totalPayment = BigInt(CREATE_PROJECT_GAS) + BigInt(Math.round(platformFeeCSPR * 1_000_000_000));
  const payment = ExecutableDeployItem.standardPayment(totalPayment.toString());

  const header = new DeployHeader(
    getChainName(),
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date(Date.now() - 20000)),
    new Duration(DEFAULT_TTL_MS),
    accountKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);
  const deployJson = Deploy.toJSON(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy");
  }

  // Get Casper Wallet provider
  const wallet = getCasperWalletProvider();
  if (!wallet) {
    throw new Error("Casper Wallet not available");
  }

  // Sign the deploy
  const signResult = await wallet.sign(
    JSON.stringify(deployJson),
    senderPublicKey
  );

  if (signResult.cancelled) {
    return {
      success: false,
      deployHash: "",
      error: signResult.message || "User cancelled signing",
    };
  }

  // Submit the signed deploy
  const submitResponse = await fetch("/api/launchpad/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployJson,
      signatureHex: signResult.signatureHex,
      signerPublicKey: senderPublicKey,
      action: "create_project",
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to submit project creation");
  }

  const submitResult = await submitResponse.json();

  return {
    success: true,
    deployHash: submitResult.deployHash || deploy.hash.toHex(),
    message: "Project creation submitted successfully",
  };
}

/**
 * Launch a token with vesting schedule
 */
export async function launchToken(params: {
  projectId: string;
  tokenContractHash: string; // The CEP-18 token contract
  founderAmount: string; // Amount allocated to founder with vesting
  senderPublicKey: string;
}): Promise<LaunchResult> {
  const { projectId, tokenContractHash, founderAmount, senderPublicKey } = params;

  const status = await getLaunchpadStatus();
  if (!status.configured || !status.contractHash) {
    throw new Error("Launchpad contract not configured");
  }

  const cleanHash = status.contractHash.replace("hash-", "");
  const contractHashBytes = new Uint8Array(
    (cleanHash.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const contractHash = new ContractHash(new Hash(contractHashBytes), "contract-");

  const cleanTokenHash = tokenContractHash.replace("hash-", "");
  const tokenHashBytes = new Uint8Array(
    (cleanTokenHash.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
  );

  const accountKey = PublicKey.fromHex(senderPublicKey);

  const runtimeArgs = Args.fromMap({
    project_id: CLValue.newCLString(projectId),
    token_contract: CLValue.newCLByteArray(tokenHashBytes),
    founder_amount: CLValue.newCLUInt512(founderAmount),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "launch_token",
    runtimeArgs
  );

  const payment = ExecutableDeployItem.standardPayment(LAUNCH_TOKEN_GAS);

  const header = new DeployHeader(
    getChainName(),
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date(Date.now() - 20000)),
    new Duration(DEFAULT_TTL_MS),
    accountKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);
  const deployJson = Deploy.toJSON(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy");
  }

  const wallet = getCasperWalletProvider();
  if (!wallet) {
    throw new Error("Casper Wallet not available");
  }

  const signResult = await wallet.sign(
    JSON.stringify(deployJson),
    senderPublicKey
  );

  if (signResult.cancelled) {
    return {
      success: false,
      deployHash: "",
      error: signResult.message || "User cancelled signing",
    };
  }

  const submitResponse = await fetch("/api/launchpad/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployJson,
      signatureHex: signResult.signatureHex,
      signerPublicKey: senderPublicKey,
      action: "launch_token",
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to submit token launch");
  }

  const submitResult = await submitResponse.json();

  return {
    success: true,
    deployHash: submitResult.deployHash || deploy.hash.toHex(),
    message: "Token launch submitted successfully",
  };
}

/**
 * Claim vested tokens
 */
export async function claimVestedTokens(params: {
  projectId: string;
  senderPublicKey: string;
}): Promise<ClaimResult> {
  const { projectId, senderPublicKey } = params;

  const status = await getLaunchpadStatus();
  if (!status.configured || !status.contractHash) {
    throw new Error("Launchpad contract not configured");
  }

  const cleanHash = status.contractHash.replace("hash-", "");
  const contractHashBytes = new Uint8Array(
    (cleanHash.match(/.{2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  const contractHash = new ContractHash(new Hash(contractHashBytes), "contract-");

  const accountKey = PublicKey.fromHex(senderPublicKey);

  const runtimeArgs = Args.fromMap({
    project_id: CLValue.newCLString(projectId),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "claim_vested",
    runtimeArgs
  );

  const payment = ExecutableDeployItem.standardPayment(CLAIM_VESTED_GAS);

  const header = new DeployHeader(
    getChainName(),
    [],
    DEFAULT_GAS_PRICE,
    new Timestamp(new Date(Date.now() - 20000)),
    new Duration(DEFAULT_TTL_MS),
    accountKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);
  const deployJson = Deploy.toJSON(deploy);

  if (!deployJson) {
    throw new Error("Failed to serialize deploy");
  }

  const wallet = getCasperWalletProvider();
  if (!wallet) {
    throw new Error("Casper Wallet not available");
  }

  const signResult = await wallet.sign(
    JSON.stringify(deployJson),
    senderPublicKey
  );

  if (signResult.cancelled) {
    return {
      success: false,
      deployHash: "",
      error: signResult.message || "User cancelled signing",
    };
  }

  const submitResponse = await fetch("/api/launchpad/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      deployJson,
      signatureHex: signResult.signatureHex,
      signerPublicKey: senderPublicKey,
      action: "claim_vested",
    }),
  });

  if (!submitResponse.ok) {
    const errorData = await submitResponse.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to submit vesting claim");
  }

  const submitResult = await submitResponse.json();

  return {
    success: true,
    deployHash: submitResult.deployHash || deploy.hash.toHex(),
    message: "Vesting claim submitted successfully",
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate claimable amount based on vesting schedule
 */
export function calculateClaimableAmount(vesting: VestingInfo): string {
  const now = Date.now();

  // Before cliff, nothing is claimable
  if (now < vesting.cliffTimestamp) {
    return "0";
  }

  // After vesting end, all remaining is claimable
  if (now >= vesting.vestingEndTimestamp) {
    const total = BigInt(vesting.totalAmount);
    const claimed = BigInt(vesting.claimedAmount);
    return (total - claimed).toString();
  }

  // Linear vesting calculation
  const vestingDuration = vesting.vestingEndTimestamp - vesting.startTimestamp;
  const elapsed = now - vesting.startTimestamp;
  const vestedRatio = elapsed / vestingDuration;

  const total = BigInt(vesting.totalAmount);
  const vested = BigInt(Math.floor(Number(total) * vestedRatio));
  const claimed = BigInt(vesting.claimedAmount);

  const claimable = vested > claimed ? vested - claimed : BigInt(0);
  return claimable.toString();
}

/**
 * Format timestamp to readable date
 */
export function formatVestingDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Calculate vesting progress percentage
 */
export function calculateVestingProgress(vesting: VestingInfo): number {
  const now = Date.now();

  if (now < vesting.startTimestamp) return 0;
  if (now >= vesting.vestingEndTimestamp) return 100;

  const elapsed = now - vesting.startTimestamp;
  const total = vesting.vestingEndTimestamp - vesting.startTimestamp;

  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}
