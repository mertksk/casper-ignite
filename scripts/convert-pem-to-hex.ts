/**
 * Convert PEM Private Key to HEX format
 *
 * This script converts your existing PEM-formatted private key
 * to the HEX format required by the platform.
 *
 * Usage: npx tsx scripts/convert-pem-to-hex.ts
 */

import { PrivateKey, KeyAlgorithm } from "casper-js-sdk";
import { config } from "dotenv";

config();

function convertPemToHex() {
  console.log("🔑 Converting PEM Private Key to HEX format...\n");

  // Read PEM key from environment
  const pemKey = process.env.CSPR_DEPLOYER_PRIVATE_KEY_PEM;

  if (!pemKey) {
    console.error("❌ Error: CSPR_DEPLOYER_PRIVATE_KEY_PEM not found in .env file");
    console.log("\nMake sure your .env file contains:");
    console.log('CSPR_DEPLOYER_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
    process.exit(1);
  }

  try {
    // Convert PEM to PrivateKey object
    const privateKey = PrivateKey.fromPem(pemKey, KeyAlgorithm.ED25519);

    // Get HEX representations
    // Access the raw private key bytes from the internal structure
    const privateKeyBytes = (privateKey as any).priv.key;
    const privateKeyHex = Buffer.from(privateKeyBytes).toString("hex");
    const publicKeyHex = privateKey.publicKey.toHex();
    const accountHash = privateKey.publicKey.accountHash();
    const publicKeyFormatted = accountHash.toPrefixedString();

    console.log("✅ Conversion Successful!\n");
    console.log("=".repeat(80));
    console.log("PRIVATE KEY (HEX) - Keep this SECRET!");
    console.log("=".repeat(80));
    console.log(privateKeyHex);
    console.log();

    console.log("=".repeat(80));
    console.log("PUBLIC KEY (HEX)");
    console.log("=".repeat(80));
    console.log(publicKeyHex);
    console.log();

    console.log("=".repeat(80));
    console.log("ACCOUNT HASH");
    console.log("=".repeat(80));
    console.log(publicKeyFormatted);
    console.log();

    console.log("📝 Add these to your .env file:\n");
    console.log("# Deployer Wallet (HEX format)");
    console.log(`CSPR_DEPLOYER_PRIVATE_KEY_HEX="${privateKeyHex}"`);
    console.log(`CSPR_DEPLOYER_KEY_ALGO="ed25519"`);
    console.log();
    console.log("# Platform Token Wallet (can use same key for testing)");
    console.log(`PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX="${privateKeyHex}"`);
    console.log(`PLATFORM_TOKEN_WALLET_PUBLIC_KEY_HEX="${publicKeyHex}"`);
    console.log(`PLATFORM_TOKEN_WALLET_KEY_ALGO="ed25519"`);
    console.log();

    console.log("⚠️  IMPORTANT SECURITY NOTES:");
    console.log("1. Never commit these keys to git");
    console.log("2. Never share private keys with anyone");
    console.log("3. Store keys securely (password manager, encrypted storage)");
    console.log("4. Use different keys for production vs development");
    console.log();

    // Verify the wallet has funds
    console.log("💰 Next Steps:");
    console.log("1. Add the above lines to your .env file");
    console.log(`2. Fund this wallet on testnet: https://testnet.cspr.live/account/${publicKeyFormatted}`);
    console.log("3. Recommended: 500+ CSPR for deployer wallet");
    console.log("4. Run 'npm run dev' to start the server");
    console.log();

  } catch (error) {
    console.error("❌ Error converting PEM key:");
    console.error(error instanceof Error ? error.message : String(error));
    console.log("\nPossible issues:");
    console.log("- PEM key format is invalid");
    console.log("- Key algorithm mismatch (try secp256k1 instead of ed25519)");
    console.log("- Missing newline characters (\\n) in PEM string");
    process.exit(1);
  }
}

// Run the conversion
convertPemToHex();
