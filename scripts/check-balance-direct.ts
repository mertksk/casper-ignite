#!/usr/bin/env tsx
/**
 * Direct RPC call to check account balance - more detailed diagnostics
 */

import { HttpHandler, PublicKey, RpcClient } from "casper-js-sdk";
import { config } from "dotenv";

config();

const RPC_URL = process.env.CSPR_RPC_URL_PRIMARY ?? process.env.NEXT_PUBLIC_CSPR_RPC_URL;
const publicKeyHex = "01252f367c8cfe14bf796a6ad298d9ad7a8d2eb22907e047b37e6bbb76d7b636b2";

async function main() {
  console.log("🔍 Direct Balance Check\n");
  console.log("=" .repeat(60));
  console.log(`\n📋 Checking account: ${publicKeyHex}`);
  console.log(`   RPC: ${RPC_URL}\n`);

  if (!RPC_URL) {
    console.error("❌ RPC URL not configured");
    process.exit(1);
  }

  const client = new RpcClient(new HttpHandler(RPC_URL, "fetch"));
  const publicKey = PublicKey.fromHex(publicKeyHex);
  const accountHash = publicKey.accountHash().toHex();

  console.log(`   Account Hash: ${accountHash}\n`);

  // Try method 1: queryLatestGlobalState
  console.log("🔍 Method 1: queryLatestGlobalState");
  try {
    const key = `account-hash-${accountHash}`;
    const result = await client.queryLatestGlobalState(key, []);
    console.log("   Raw result:", JSON.stringify(result, null, 2));

    const account = (result as any).Account ?? (result as any).storedValue?.Account ?? (result as any).stored_value?.Account;

    if (account) {
      console.log("   ✅ Account found!");
      const mainPurse = account.mainPurse;
      console.log(`   Main Purse: ${mainPurse}`);

      // Try to get balance
      try {
        const balanceResult = await client.queryLatestBalance(mainPurse as any);
        const balanceMotes = BigInt(balanceResult.toString());
        const balanceCSPR = Number(balanceMotes) / 1_000_000_000;
        console.log(`   Balance: ${balanceCSPR.toFixed(9)} CSPR`);
      } catch (balError) {
        console.error("   ❌ Error getting balance:", balError);
      }
    } else {
      console.log("   ❌ Account not found in result");
    }
  } catch (error) {
    console.error("   ❌ Error:", error instanceof Error ? error.message : String(error));
  }

  // Try method 2: Direct RPC call
  console.log("\n🔍 Method 2: Direct state_get_account_info RPC call");
  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "state_get_account_info",
        params: {
          public_key: publicKeyHex
        },
        id: 1
      })
    });

    const data = await response.json();
    console.log("   Raw response:", JSON.stringify(data, null, 2));

    if (data.result?.account) {
      console.log("   ✅ Account found!");
      const mainPurse = data.result.account.main_purse;
      console.log(`   Main Purse: ${mainPurse}`);

      // Get balance
      const balanceResponse = await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "state_get_balance",
          params: {
            state_root_hash: data.result.merkle_proof,
            purse_uref: mainPurse
          },
          id: 2
        })
      });

      const balanceData = await balanceResponse.json();
      if (balanceData.result?.balance_value) {
        const balanceMotes = BigInt(balanceData.result.balance_value);
        const balanceCSPR = Number(balanceMotes) / 1_000_000_000;
        console.log(`   Balance: ${balanceCSPR.toFixed(9)} CSPR`);
      }
    } else if (data.error) {
      console.log("   ❌ RPC Error:", data.error.message);
    } else {
      console.log("   ❌ Account not found");
    }
  } catch (error) {
    console.error("   ❌ Error:", error instanceof Error ? error.message : String(error));
  }

  console.log("\n" + "=".repeat(60));
}

main().catch(console.error);
