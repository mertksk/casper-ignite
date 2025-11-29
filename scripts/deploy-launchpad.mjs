#!/usr/bin/env node
/**
 * Deploy Launchpad Controller Contract to Casper Testnet
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

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
  Timestamp,
} = sdk;

// Configuration
const NODE_URL = process.env.CSPR_RPC_URL_PRIMARY || "https://node.testnet.casper.network/rpc";
const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || "casper-test";
const WASM_PATH = path.join(__dirname, "..", "contracts/launchpad/target/wasm32-unknown-unknown/release/launchpad.wasm");
const PAYMENT_AMOUNT = "150000000000"; // 150 CSPR for deployment

async function main() {
  console.log("========================================");
  console.log("Deploying Launchpad Controller Contract");
  console.log("========================================");
  console.log("Node:", NODE_URL);
  console.log("Chain:", CHAIN_NAME);
  console.log("");

  if (!fs.existsSync(WASM_PATH)) {
    console.error("Error: Launchpad WASM not found at", WASM_PATH);
    process.exit(1);
  }

  const privateKeyHex = process.env.CSPR_DEPLOYER_PRIVATE_KEY_HEX;
  if (!privateKeyHex) {
    console.error("Error: CSPR_DEPLOYER_PRIVATE_KEY_HEX not set");
    process.exit(1);
  }

  const privateKey = PrivateKey.fromHex(privateKeyHex, 1);
  const publicKey = privateKey.publicKey;

  console.log("Deployer:", publicKey.toHex());
  console.log("");

  const adminAccountHash = publicKey.accountHash();
  console.log("Admin Account Hash:", adminAccountHash.toHex());

  const wasmBytes = new Uint8Array(fs.readFileSync(WASM_PATH));
  console.log("WASM Size:", (wasmBytes.length / 1024).toFixed(2), "KB");
  console.log("");

  // Platform fee: 5% (500 basis points)
  const platformFeeBps = 500;
  console.log("Platform Fee:", platformFeeBps / 100, "%");

  const runtimeArgs = Args.fromMap({
    admin: CLValue.newCLByteArray(adminAccountHash.toBytes()),
    platform_fee_bps: CLValue.newCLUint64(BigInt(platformFeeBps)),
  });

  const session = new ExecutableDeployItem();
  session.moduleBytes = new ModuleBytes(wasmBytes, runtimeArgs);

  const payment = ExecutableDeployItem.standardPayment(PAYMENT_AMOUNT);

  const header = new DeployHeader(
    CHAIN_NAME,
    [],
    1,
    new Timestamp(new Date()),
    new Duration(1800000),
    publicKey
  );

  const deploy = Deploy.makeDeploy(header, payment, session);
  deploy.sign(privateKey);

  console.log("Deploy Hash:", deploy.hash.toHex());
  console.log("");
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
    console.log("2. Run: node scripts/get-launchpad-hash.mjs");
    console.log("3. Add LAUNCHPAD_CONTRACT_HASH to .env");
  } catch (error) {
    console.error("Deploy failed:", error.message || error);
    process.exit(1);
  }
}

main().catch(console.error);
