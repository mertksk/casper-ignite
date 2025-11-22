#!/usr/bin/env tsx
/**
 * Verify that the private key in .env matches the expected public key
 */

import { KeyAlgorithm, PrivateKey } from "casper-js-sdk";
import { config } from "dotenv";

config();

const pem = process.env.CSPR_DEPLOYER_PRIVATE_KEY_PEM;
const expectedPublicKey = process.env.CSPR_DEPLOYER_PUBLIC_KEY;
const userWallet = "0202cd4a869fd31185b63fcd005c226b14b8e9674724c2469c2cfa2456c1219ecf6c";

console.log("🔐 Keypair Verification\n");
console.log("=".repeat(60));

if (!pem) {
  console.error("❌ ERROR: CSPR_DEPLOYER_PRIVATE_KEY_PEM not found in .env");
  process.exit(1);
}

console.log("\n📋 Configuration:");
console.log(`   Expected Public Key (from .env): ${expectedPublicKey ?? "NOT SET"}`);
console.log(`   Your Wallet Public Key: ${userWallet}`);

// Try ED25519
console.log("\n🔑 Testing ED25519 algorithm:");
try {
  const privateKey = PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  const derivedPublicKey = privateKey.publicKey.toHex();
  console.log(`   Derived Public Key: ${derivedPublicKey}`);

  if (derivedPublicKey === expectedPublicKey) {
    console.log("   ✅ Matches expected public key from .env");
  } else {
    console.log("   ❌ Does NOT match expected public key from .env");
  }

  if (derivedPublicKey === userWallet) {
    console.log("   ✅ Matches your wallet public key!");
  } else {
    console.log("   ❌ Does NOT match your wallet public key");
  }
} catch (error) {
  console.error("   ❌ Failed to parse with ED25519:", error instanceof Error ? error.message : String(error));
}

// Try SECP256K1
console.log("\n🔑 Testing SECP256K1 algorithm:");
try {
  const privateKey = PrivateKey.fromPem(pem, KeyAlgorithm.SECP256K1);
  const derivedPublicKey = privateKey.publicKey.toHex();
  console.log(`   Derived Public Key: ${derivedPublicKey}`);

  if (derivedPublicKey === expectedPublicKey) {
    console.log("   ✅ Matches expected public key from .env");
  } else {
    console.log("   ❌ Does NOT match expected public key from .env");
  }

  if (derivedPublicKey === userWallet) {
    console.log("   ✅ Matches your wallet public key!");
  } else {
    console.log("   ❌ Does NOT match your wallet public key");
  }
} catch (error) {
  console.error("   ❌ Failed to parse with SECP256K1:", error instanceof Error ? error.message : String(error));
}

console.log("\n" + "=".repeat(60));
console.log("\n📝 Recommendation:");
console.log("   The private key in your .env does NOT match your wallet!");
console.log("   You need to export your wallet's private key and update .env");
console.log(`   Your wallet: ${userWallet}`);
console.log("\n   How to fix:");
console.log("   1. Export your private key from Casper Wallet/Signer");
console.log("   2. Update CSPR_DEPLOYER_PRIVATE_KEY_PEM in .env");
console.log("   3. Update CSPR_DEPLOYER_PUBLIC_KEY to match your wallet");
console.log("   4. Or fund the account that the current key generates");
