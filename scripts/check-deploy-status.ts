#!/usr/bin/env tsx
/**
 * Check the status of a specific deploy
 */

import { checkDeployStatus } from "../src/lib/casper";
import { config } from "dotenv";

config();

const deployHash = process.argv[2];

if (!deployHash) {
  console.error("Usage: npx tsx scripts/check-deploy-status.ts <deploy-hash>");
  process.exit(1);
}

async function main() {
  console.log(`🔍 Checking deploy status: ${deployHash}\n`);

  const status = await checkDeployStatus(deployHash);

  console.log("Status:", JSON.stringify(status, null, 2));

  if (status.executed) {
    if (status.success) {
      console.log("\n✅ Deploy executed successfully!");
    } else {
      console.log("\n❌ Deploy failed:", status.error);
    }
  } else {
    console.log("\n⏳ Deploy not yet executed (still pending)");
  }
}

main().catch(console.error);
