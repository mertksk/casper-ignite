#!/usr/bin/env node
/**
 * Deploy Bonding Curve AMM Contract to Casper Testnet
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// Use require for casper-js-sdk (CommonJS)
const sdk = require("casper-js-sdk");
const {
  Args,
  CLValue,
  Deploy,
  DeployHeader,
  Duration,
  ExecutableDeployItem,
  ModuleBytes,
  PrivateKey,
  PublicKey,
  Timestamp,
} = sdk;

// Configuration
const NODE_URL = process.env.CSPR_RPC_URL_PRIMARY || "https://node.testnet.casper.network/rpc";
const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || "casper-test";
const WASM_PATH = path.join(__dirname, "..", "contracts/amm/target/wasm32-unknown-unknown/release/bonding_curve_amm.wasm");
const PAYMENT_AMOUNT = "150000000000"; // 150 CSPR

async function main() {
  console.log("========================================");
  console.log("Deploying Bonding Curve AMM Contract");
  console.log("========================================");
  console.log("Node:", NODE_URL);
  console.log("Chain:", CHAIN_NAME);
  console.log("");

  // Check WASM exists
  if (!fs.existsSync(WASM_PATH)) {
    console.error("Error: AMM WASM not found at", WASM_PATH);
    process.exit(1);
  }

  // Get deployer key
  const privateKeyHex = process.env.CSPR_DEPLOYER_PRIVATE_KEY_HEX;
  if (!privateKeyHex) {
    console.error("Error: CSPR_DEPLOYER_PRIVATE_KEY_HEX not set");
    process.exit(1);
  }

  // Create keypair from hex (ed25519)
  // PrivateKey.fromHex takes (hex, algorithm) where algorithm 1 = ED25519
  const privateKey = PrivateKey.fromHex(privateKeyHex, 1);
  const publicKey = privateKey.publicKey;

  console.log("Deployer:", publicKey.toHex());
  console.log("");

  // Get admin account hash
  const adminAccountHash = publicKey.accountHash();
  console.log("Admin Account Hash:", adminAccountHash.toHex());

  // Read WASM
  const wasmBytes = new Uint8Array(fs.readFileSync(WASM_PATH));
  console.log("WASM Size:", (wasmBytes.length / 1024).toFixed(2), "KB");
  console.log("");

  // Build runtime args - admin is AccountHash (32 bytes)
  const runtimeArgs = Args.fromMap({
    admin: CLValue.newCLByteArray(adminAccountHash.toBytes()),
  });

  // Build session
  const session = new ExecutableDeployItem();
  session.moduleBytes = new ModuleBytes(wasmBytes, runtimeArgs);

  // Build payment
  const payment = ExecutableDeployItem.standardPayment(PAYMENT_AMOUNT);

  // Build deploy header
  const header = new DeployHeader(
    CHAIN_NAME,
    [],
    1, // gas price
    new Timestamp(new Date()),
    new Duration(1800000), // 30 min TTL
    publicKey
  );

  // Create deploy
  const deploy = Deploy.makeDeploy(header, payment, session);

  // Sign deploy (mutates in place)
  deploy.sign(privateKey);

  console.log("Deploy Hash:", deploy.hash.toHex());
  console.log("");

  // Submit deploy
  console.log("Submitting deploy...");

  try {
    const response = await fetch(NODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "account_put_deploy",
        params: {
          deploy: Deploy.toJSON(deploy),
        },
      }),
    });

    const result = await response.json();

    if (result.error) {
      console.error("Deploy failed:", result.error);
      process.exit(1);
    }

    console.log("Deploy submitted successfully!");
    console.log("Result:", JSON.stringify(result, null, 2));
    console.log("");
    console.log("View on explorer:");
    console.log(`https://testnet.cspr.live/deploy/${deploy.hash.toHex()}`);
    console.log("");
    console.log("========================================");
    console.log("Next Steps:");
    console.log("========================================");
    console.log("1. Wait for deploy to complete (1-2 minutes)");
    console.log("2. Run: node scripts/get-amm-hash.mjs");
    console.log("3. Add AMM_CONTRACT_HASH to .env");
    console.log("4. Run: node scripts/initialize-amm.mjs");
  } catch (error) {
    console.error("Deploy failed:", error.message || error);
    process.exit(1);
  }
}

main().catch(console.error);
