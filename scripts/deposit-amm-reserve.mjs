#!/usr/bin/env node
/**
 * Deposit CSPR reserve to the AMM
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
const AMM_CONTRACT_HASH = process.env.AMM_CONTRACT_HASH;
const DEPOSIT_WASM = path.join(__dirname, "..", "public/wasm/amm_deposit_session.wasm");
const PAYMENT_AMOUNT = "10000000000"; // 10 CSPR for gas

// Amount to deposit (50 CSPR initial reserve)
const DEPOSIT_AMOUNT = "50000000000"; // 50 CSPR in motes

async function main() {
  console.log("========================================");
  console.log("Depositing CSPR Reserve to AMM");
  console.log("========================================");
  console.log("Node:", NODE_URL);
  console.log("Chain:", CHAIN_NAME);
  console.log("Contract:", AMM_CONTRACT_HASH);
  console.log("Deposit Amount:", Number(DEPOSIT_AMOUNT) / 1e9, "CSPR");
  console.log("");

  if (!AMM_CONTRACT_HASH) {
    console.error("Error: AMM_CONTRACT_HASH not set in .env");
    process.exit(1);
  }

  if (!fs.existsSync(DEPOSIT_WASM)) {
    console.error("Error: Deposit WASM not found at", DEPOSIT_WASM);
    process.exit(1);
  }

  // Get deployer key
  const privateKeyHex = process.env.CSPR_DEPLOYER_PRIVATE_KEY_HEX;
  if (!privateKeyHex) {
    console.error("Error: CSPR_DEPLOYER_PRIVATE_KEY_HEX not set");
    process.exit(1);
  }

  const privateKey = PrivateKey.fromHex(privateKeyHex, 1);
  const publicKey = privateKey.publicKey;

  console.log("Depositor:", publicKey.toHex());
  console.log("");

  // Read WASM
  const wasmBytes = new Uint8Array(fs.readFileSync(DEPOSIT_WASM));
  console.log("WASM Size:", (wasmBytes.length / 1024).toFixed(2), "KB");

  // Convert contract hash to bytes
  const hashHex = AMM_CONTRACT_HASH.replace("hash-", "");
  const contractHashBytes = Uint8Array.from(
    hashHex.match(/.{2}/g).map(byte => parseInt(byte, 16))
  );

  // Build runtime args
  const runtimeArgs = Args.fromMap({
    amm_contract_hash: CLValue.newCLByteArray(contractHashBytes),
    amount: CLValue.newCLUInt512(DEPOSIT_AMOUNT),
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
    1,
    new Timestamp(new Date()),
    new Duration(1800000),
    publicKey
  );

  // Create and sign deploy
  const deploy = Deploy.makeDeploy(header, payment, session);
  deploy.sign(privateKey);

  console.log("Deploy Hash:", deploy.hash.toHex());
  console.log("");
  console.log("Submitting deposit transaction...");

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
      console.error("Deposit failed:", result.error);
      process.exit(1);
    }

    console.log("Deposit submitted successfully!");
    console.log("Result:", JSON.stringify(result, null, 2));
    console.log("");
    console.log("View on explorer:");
    console.log(`https://testnet.cspr.live/deploy/${deploy.hash.toHex()}`);
    console.log("");
    console.log("========================================");
    console.log("AMM now has 50 CSPR in reserve!");
    console.log("========================================");
  } catch (error) {
    console.error("Deposit failed:", error.message || error);
    process.exit(1);
  }
}

main().catch(console.error);
