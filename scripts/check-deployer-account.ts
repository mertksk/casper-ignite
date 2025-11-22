#!/usr/bin/env tsx
/**
 * Debug script to check the deployer account status on Casper network.
 * This helps diagnose issues with unfunded accounts or RPC connectivity.
 *
 * Usage: npx tsx scripts/check-deployer-account.ts
 */

import { HttpHandler, KeyAlgorithm, PrivateKey, PublicKey, RpcClient } from "casper-js-sdk";
import { config } from "dotenv";

config();

const RPC_URL = process.env.CSPR_RPC_URL_PRIMARY ?? process.env.NEXT_PUBLIC_CSPR_RPC_URL;
const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME;

function loadDeployerKey(): PublicKey | null {
  const pem = process.env.CSPR_DEPLOYER_PRIVATE_KEY_PEM;
  const hex = process.env.CSPR_DEPLOYER_PRIVATE_KEY_HEX;
  const algo = (process.env.CSPR_DEPLOYER_KEY_ALGO ?? "ed25519").toLowerCase();
  const algorithm = algo === "secp256k1" ? KeyAlgorithm.SECP256K1 : KeyAlgorithm.ED25519;

  if (pem) {
    return PrivateKey.fromPem(pem, algorithm).publicKey;
  }
  if (hex) {
    return PrivateKey.fromHex(hex, algorithm).publicKey;
  }
  return null;
}

function motesToCSPR(motes: string | bigint): string {
  const motesBig = typeof motes === "bigint" ? motes : BigInt(motes);
  return (Number(motesBig) / 1_000_000_000).toFixed(9);
}

async function main() {
  console.log("🔍 Casper Deployer Account Diagnostics\n");
  console.log("=" .repeat(60));

  // Check environment configuration
  console.log("\n📋 Configuration:");
  console.log(`   RPC URL: ${RPC_URL ?? "❌ NOT SET"}`);
  console.log(`   Chain Name: ${CHAIN_NAME ?? "❌ NOT SET"}`);

  if (!RPC_URL) {
    console.error("\n❌ ERROR: CSPR_RPC_URL_PRIMARY or NEXT_PUBLIC_CSPR_RPC_URL not set in .env");
    process.exit(1);
  }

  if (!CHAIN_NAME) {
    console.error("\n❌ ERROR: NEXT_PUBLIC_CHAIN_NAME not set in .env");
    process.exit(1);
  }

  // Load deployer key
  const deployerPublicKey = loadDeployerKey();
  if (!deployerPublicKey) {
    console.error("\n❌ ERROR: Deployer private key not found in environment");
    console.error("   Set CSPR_DEPLOYER_PRIVATE_KEY_PEM or CSPR_DEPLOYER_PRIVATE_KEY_HEX");
    process.exit(1);
  }

  const publicKeyHex = deployerPublicKey.toHex();
  const accountHash = deployerPublicKey.accountHash().toHex();

  console.log("\n🔑 Deployer Account:");
  console.log(`   Public Key: ${publicKeyHex}`);
  console.log(`   Account Hash: ${accountHash}`);

  // Test RPC connectivity
  console.log("\n🌐 Testing RPC Connection...");
  const client = new RpcClient(new HttpHandler(RPC_URL, "fetch"));

  try {
    const status = await client.getStatus();
    const rpcChainName = status.chainSpecName ?? (status as any).chainspec_name ?? (status as any).chain_spec_name;
    const blockHeight = (status as any).lastAddedBlockInfo?.height ?? (status as any).last_added_block_info?.height ?? "unknown";

    console.log(`   ✅ RPC is responsive`);
    console.log(`   Chain: ${rpcChainName}`);
    console.log(`   Latest Block: ${blockHeight}`);

    if (rpcChainName !== CHAIN_NAME) {
      console.log(`\n⚠️  WARNING: Chain name mismatch!`);
      console.log(`   Expected: ${CHAIN_NAME}`);
      console.log(`   Actual: ${rpcChainName}`);
      console.log(`   Update NEXT_PUBLIC_CHAIN_NAME to "${rpcChainName}" in .env`);
    }
  } catch (error) {
    console.error(`   ❌ RPC connection failed:`, error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Check account status
  console.log("\n💰 Checking Account Status...");
  const key = `account-hash-${accountHash}`;

  try {
    const result = await client.queryLatestGlobalState(key, []);
    const account = (result as any).Account ?? (result as any).storedValue?.Account ?? (result as any).stored_value?.Account;

    if (!account) {
      console.log("   ❌ Account not found on-chain");
      console.log("\n📝 Next Steps:");
      console.log("   1. The account has never received any CSPR");
      console.log("   2. Fund the account via the Testnet Faucet:");
      console.log(`      https://testnet.cspr.live/tools/faucet`);
      console.log(`   3. Enter your public key: ${publicKeyHex}`);
      console.log("   4. Request at least 200 CSPR for contract deployment");
      process.exit(0);
    }

    console.log("   ✅ Account exists on-chain");
    const mainPurse = account.mainPurse;

    // Get balance
    const balanceResult = await client.queryLatestBalance(mainPurse);
    const balanceMotes = BigInt(balanceResult.toString());
    const balanceCSPR = motesToCSPR(balanceMotes);

    console.log(`   Main Purse: ${mainPurse}`);
    console.log(`   Balance: ${balanceCSPR} CSPR`);

    // Check if sufficient for deployment
    const requiredMotes = BigInt("150000000000"); // 150 CSPR
    const requiredCSPR = motesToCSPR(requiredMotes);

    if (balanceMotes < requiredMotes) {
      console.log(`\n⚠️  Insufficient balance for contract deployment`);
      console.log(`   Required: ${requiredCSPR} CSPR`);
      console.log(`   Current: ${balanceCSPR} CSPR`);
      console.log(`   Deficit: ${motesToCSPR(requiredMotes - balanceMotes)} CSPR`);
      console.log("\n📝 Next Steps:");
      console.log("   Fund the account via the Testnet Faucet:");
      console.log(`   https://testnet.cspr.live/tools/faucet`);
      console.log(`   Public Key: ${publicKeyHex}`);
    } else {
      console.log(`   ✅ Sufficient balance for deployment (requires ~${requiredCSPR} CSPR)`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ Diagnostics complete");

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { statusCode?: number; code?: number })?.statusCode ??
                      (error as { statusCode?: number; code?: number })?.code;

    if (
      errorCode === -32003 ||
      errorMsg.includes("Query failed") ||
      errorMsg.includes("Account not found") ||
      errorMsg.includes("Value not found") ||
      errorMsg.includes("Missing key")
    ) {
      console.log("   ❌ Account not found on-chain (never funded)");
      console.log("\n📝 Next Steps:");
      console.log("   1. Fund the account via the Testnet Faucet:");
      console.log(`      https://testnet.cspr.live/tools/faucet`);
      console.log(`   2. Enter your public key: ${publicKeyHex}`);
      console.log("   3. Request at least 200 CSPR for contract deployment");
      console.log("   4. Wait 1-2 minutes for the transaction to complete");
      console.log("   5. Run this script again to verify funding");
    } else {
      console.error("   ❌ Error checking account:", errorMsg);
      if (errorCode) {
        console.error(`   Error Code: ${errorCode}`);
      }
    }

    console.log("\n" + "=".repeat(60));
  }
}

main().catch((error) => {
  console.error("\n💥 Fatal error:", error);
  process.exit(1);
});
