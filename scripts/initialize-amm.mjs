#!/usr/bin/env node
/**
 * Initialize the Bonding Curve AMM Contract
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
  PrivateKey,
  StoredContractByHash,
  Timestamp,
} = sdk;

// Configuration
const NODE_URL = process.env.CSPR_RPC_URL_PRIMARY || "https://node.testnet.casper.network/rpc";
const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || "casper-test";
const AMM_CONTRACT_HASH = process.env.AMM_CONTRACT_HASH;
const PAYMENT_AMOUNT = "5000000000"; // 5 CSPR for gas

// AMM Parameters
const INITIAL_PRICE_MOTES = "100000000"; // 0.1 CSPR per token
const RESERVE_RATIO = "100"; // 1% slope (100 basis points)

async function main() {
  console.log("========================================");
  console.log("Initializing Bonding Curve AMM");
  console.log("========================================");
  console.log("Node:", NODE_URL);
  console.log("Chain:", CHAIN_NAME);
  console.log("Contract:", AMM_CONTRACT_HASH);
  console.log("");
  console.log("Parameters:");
  console.log("  Initial Price:", INITIAL_PRICE_MOTES, "motes (", Number(INITIAL_PRICE_MOTES) / 1e9, "CSPR)");
  console.log("  Reserve Ratio:", RESERVE_RATIO, "basis points (", Number(RESERVE_RATIO) / 100, "%)");
  console.log("");

  if (!AMM_CONTRACT_HASH) {
    console.error("Error: AMM_CONTRACT_HASH not set in .env");
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

  console.log("Caller:", publicKey.toHex());
  console.log("");

  // Build runtime args
  const runtimeArgs = Args.fromMap({
    initial_price: CLValue.newCLUInt512(INITIAL_PRICE_MOTES),
    reserve_ratio: CLValue.newCLUInt512(RESERVE_RATIO),
  });

  // Extract contract hash bytes (remove "hash-" prefix)
  const hashHex = AMM_CONTRACT_HASH.replace("hash-", "");
  const contractHashBytes = Uint8Array.from(
    hashHex.match(/.{2}/g).map(byte => parseInt(byte, 16))
  );

  // Build session calling the contract entry point
  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHashBytes,
    "initialize",
    runtimeArgs
  );

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
  console.log("Submitting initialize transaction...");

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
      console.error("Initialize failed:", result.error);
      process.exit(1);
    }

    console.log("Initialize submitted successfully!");
    console.log("Result:", JSON.stringify(result, null, 2));
    console.log("");
    console.log("View on explorer:");
    console.log(`https://testnet.cspr.live/deploy/${deploy.hash.toHex()}`);
    console.log("");
    console.log("========================================");
    console.log("AMM is now initialized and ready to use!");
    console.log("========================================");
    console.log("");
    console.log("The bonding curve is configured with:");
    console.log("  - Starting price: 0.1 CSPR per token");
    console.log("  - Price increases 1% for each token in circulation");
    console.log("");
    console.log("Users can now buy/sell tokens through the AMM!");
  } catch (error) {
    console.error("Initialize failed:", error.message || error);
    process.exit(1);
  }
}

main().catch(console.error);
