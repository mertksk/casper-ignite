#!/usr/bin/env node
/**
 * Get Launchpad Contract Hash from deployer account
 */

import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const dotenv = require("dotenv");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const NODE_URL = process.env.CSPR_RPC_URL_PRIMARY || "https://node.testnet.casper.network/rpc";
const DEPLOYER_PUBLIC_KEY = process.env.CSPR_DEPLOYER_PUBLIC_KEY;

async function main() {
  console.log("Fetching Launchpad contract hash...");
  console.log("Node:", NODE_URL);
  console.log("");

  if (!DEPLOYER_PUBLIC_KEY) {
    console.error("Error: CSPR_DEPLOYER_PUBLIC_KEY not set");
    process.exit(1);
  }

  const accountResponse = await fetch(NODE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "state_get_account_info",
      params: {
        public_key: DEPLOYER_PUBLIC_KEY,
        block_identifier: null,
      },
    }),
  });

  const accountData = await accountResponse.json();

  if (accountData.error) {
    console.error("Error fetching account:", accountData.error);
    process.exit(1);
  }

  const namedKeys = accountData.result?.account?.named_keys || [];

  console.log("Named Keys in deployer account:");
  for (const key of namedKeys) {
    console.log(`  ${key.name}: ${key.key}`);
  }
  console.log("");

  const launchpadHashKey = namedKeys.find(k => k.name === "launchpad_hash");

  if (launchpadHashKey) {
    console.log("========================================");
    console.log("Launchpad Contract Found!");
    console.log("========================================");
    console.log("Contract Hash:", launchpadHashKey.key);
    console.log("");
    console.log("Add this to your .env file:");
    console.log(`LAUNCHPAD_CONTRACT_HASH="${launchpadHashKey.key}"`);
    console.log("");
  } else {
    console.log("Launchpad contract hash not found yet.");
    console.log("The deploy may still be processing. Try again in a minute.");
  }
}

main().catch(console.error);
