# 🔧 Environment Variables Setup Guide

## Current Status of Your .env File

✅ **Already Configured:**
- Database URL (PostgreSQL)
- Redis URL
- Casper Network (testnet)
- Platform Fee Address
- Liquidity Pool Address
- Deployer Private Key (PEM format)

⚠️ **Missing (Required):**
- Deployer key in HEX format
- Platform Token Wallet keys
- RPC URL environment variable names

---

## Required Changes to Your .env

Add these lines to your existing `.env` file:

```bash
# =============================================================================
# ADD THESE TO YOUR EXISTING .env FILE
# =============================================================================

# -----------------------------------------------------------------------------
# 1. FIX RPC URL VARIABLE NAMES (Your code expects these exact names)
# -----------------------------------------------------------------------------
NEXT_PUBLIC_RPC_URL="https://node.testnet.casper.network/rpc"
RPC_FALLBACK_URL="https://node.testnet.casper.network/rpc"

# -----------------------------------------------------------------------------
# 2. DEPLOYER WALLET (HEX Format)
# You already have PEM, now need HEX format of the same key
# -----------------------------------------------------------------------------
# Convert your PEM key to HEX format using Casper SDK or tools
# This should be the SAME key as your CSPR_DEPLOYER_PRIVATE_KEY_PEM
CSPR_DEPLOYER_PRIVATE_KEY_HEX="your_hex_key_here_64_chars"
CSPR_DEPLOYER_KEY_ALGO="ed25519"

# -----------------------------------------------------------------------------
# 3. PLATFORM TOKEN WALLET (CRITICAL - This holds all project tokens)
# -----------------------------------------------------------------------------
# OPTION A: Use the same key as deployer (simpler for testing)
PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX="same_as_deployer_hex_key"
PLATFORM_TOKEN_WALLET_PUBLIC_KEY_HEX="0202cd4a869fd31185b63fcd005c226b14b8e9674724c2469c2cfa2456c1219ecf6c"
PLATFORM_TOKEN_WALLET_KEY_ALGO="ed25519"

# OPTION B: Use a different wallet (recommended for production)
# PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX="different_private_key_hex"
# PLATFORM_TOKEN_WALLET_PUBLIC_KEY_HEX="different_public_key_hex"
# PLATFORM_TOKEN_WALLET_KEY_ALGO="ed25519"

# -----------------------------------------------------------------------------
# 4. MONITORING & ALERTS (Optional but Recommended)
# -----------------------------------------------------------------------------
# Slack webhook for critical alerts
SLACK_WEBHOOK_URL=""

# Email alerts (optional)
EMAIL_ALERTS_ENABLED="false"
ADMIN_EMAIL_ADDRESSES=""

# -----------------------------------------------------------------------------
# 5. LOGGING (Optional)
# -----------------------------------------------------------------------------
LOG_LEVEL="info"
```

---

## How to Get the Required Keys

### 1. Convert PEM to HEX for Deployer Key

You already have this in your .env:
```
CSPR_DEPLOYER_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIOuGPQ95jfPwr9gVugrXmhwmGBizNnXTxjxDcjebGy/c\n-----END PRIVATE KEY-----\n"
```

**To convert PEM to HEX**, use one of these methods:

#### Method 1: Using Node.js Script
Create a file `scripts/convert-pem-to-hex.js`:
```javascript
const { PrivateKey, KeyAlgorithm } = require('casper-js-sdk');

const pemKey = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIOuGPQ95jfPwr9gVugrXmhwmGBizNnXTxjxDcjebGy/c
-----END PRIVATE KEY-----`;

const privateKey = PrivateKey.fromPem(pemKey, KeyAlgorithm.ED25519);
const hexKey = privateKey.toHex();
const publicKey = privateKey.publicKey.toHex();

console.log('Private Key (HEX):', hexKey);
console.log('Public Key (HEX):', publicKey);
```

Run: `node scripts/convert-pem-to-hex.js`

#### Method 2: Use Casper Client
If you have casper-client installed:
```bash
casper-client keygen /tmp/test
# This generates keys in multiple formats
```

### 2. Platform Token Wallet Options

#### OPTION A: Use Same Key as Deployer (Easier for Testing)
```bash
PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX="<same as CSPR_DEPLOYER_PRIVATE_KEY_HEX>"
PLATFORM_TOKEN_WALLET_PUBLIC_KEY_HEX="<your deployer public key in hex>"
```

#### OPTION B: Create New Wallet (Recommended for Production)
```bash
# Generate new keys
casper-client keygen /path/to/new/wallet

# Or use the conversion script above with a new PEM key
```

---

## Complete .env File Template

Here's what your **complete** `.env` should look like:

```bash
# =============================================================================
# CASPER RADAR - ENVIRONMENT VARIABLES
# =============================================================================

# Node Environment
NODE_ENV=development

# App Configuration
NEXT_PUBLIC_APP_NAME="Casper Ignite"
NEXT_PUBLIC_CHAIN_NAME="casper-test"

# -----------------------------------------------------------------------------
# CASPER RPC (IMPORTANT: Variable names must match exactly)
# -----------------------------------------------------------------------------
NEXT_PUBLIC_RPC_URL="https://node.testnet.casper.network/rpc"
RPC_FALLBACK_URL="https://node.testnet.casper.network/rpc"

# Legacy names (keep for backward compatibility)
CSPR_RPC_URL_PRIMARY="https://node.testnet.casper.network/rpc"
CSPR_RPC_URL_FALLBACK="https://node.testnet.casper.network/rpc"

# -----------------------------------------------------------------------------
# DATABASE
# -----------------------------------------------------------------------------
DATABASE_URL="postgresql://mertk:8csiS53MRPwOHtW0@51.91.243.73:5432/casper_radar"

# Cache (Redis)
REDIS_URL="redis://51.91.243.73:6379"

# -----------------------------------------------------------------------------
# PLATFORM DEPLOYER WALLET
# -----------------------------------------------------------------------------
# PEM format (existing)
CSPR_DEPLOYER_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIOuGPQ95jfPwr9gVugrXmhwmGBizNnXTxjxDcjebGy/c\n-----END PRIVATE KEY-----\n"
CSPR_DEPLOYER_PUBLIC_KEY=01252f367c8cfe14bf796a6ad298d9ad7a8d2eb22907e047b37e6bbb76d7b636b2

# HEX format (NEW - REQUIRED)
CSPR_DEPLOYER_PRIVATE_KEY_HEX="eba863d0f798df3f0afd815ba0ad79a1c261818b3367d3c63c43723799b2fddc"
CSPR_DEPLOYER_KEY_ALGO="ed25519"

# -----------------------------------------------------------------------------
# PLATFORM TOKEN WALLET (NEW - REQUIRED)
# This wallet holds all project tokens for trading
# -----------------------------------------------------------------------------
PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX="eba863d0f798df3f0afd815ba0ad79a1c261818b3367d3c63c43723799b2fddc"
PLATFORM_TOKEN_WALLET_PUBLIC_KEY_HEX="01252f367c8cfe14bf796a6ad298d9ad7a8d2eb22907e047b37e6bbb76d7b636b2"
PLATFORM_TOKEN_WALLET_KEY_ALGO="ed25519"

# -----------------------------------------------------------------------------
# PLATFORM PAYMENT ADDRESSES
# -----------------------------------------------------------------------------
PLATFORM_FEE_ADDRESS="0203390fd8857f8dc1aa44989111c69d71486e13ee6699199fa34da885fbdca62c9b"
LIQUIDITY_POOL_ADDRESS="0202cd4a869fd31185b63fcd005c226b14b8e9674724c2469c2cfa2456c1219ecf6c"

# Public versions (for frontend)
NEXT_PUBLIC_PLATFORM_FEE_ADDRESS="0203390fd8857f8dc1aa44989111c69d71486e13ee6699199fa34da885fbdca62c9b"
NEXT_PUBLIC_LIQUIDITY_POOL_ADDRESS="0202cd4a869fd31185b63fcd005c226b14b8e9674724c2469c2cfa2456c1219ecf6c"

# -----------------------------------------------------------------------------
# SECURITY / AUTH
# -----------------------------------------------------------------------------
JWT_SECRET="change_me"

# -----------------------------------------------------------------------------
# MONITORING & ALERTS (Optional)
# -----------------------------------------------------------------------------
SLACK_WEBHOOK_URL=""
EMAIL_ALERTS_ENABLED="false"
ADMIN_EMAIL_ADDRESSES=""
LOG_LEVEL="info"

# -----------------------------------------------------------------------------
# TESTING (Optional)
# -----------------------------------------------------------------------------
TEST_WALLET_PUBLIC_KEY=""
```

---

## Wallet Funding Requirements

Make sure these wallets are funded on Casper Testnet:

### 1. Deployer Wallet (CSPR_DEPLOYER_PRIVATE_KEY_HEX)
- **Purpose:** Pays gas for token deployments
- **Required Balance:** 500+ CSPR
- **Cost per Project:** ~250 CSPR
- **Get Testnet CSPR:** https://testnet.cspr.live/tools/faucet

### 2. Platform Token Wallet (PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX)
- **Purpose:** Holds all project tokens, sends tokens to buyers, sends CSPR to sellers
- **Required Balance:** 500+ CSPR (for gas)
- **Note:** This wallet will hold ALL project tokens
- **Get Testnet CSPR:** https://testnet.cspr.live/tools/faucet

### 3. Platform Fee Address (PLATFORM_FEE_ADDRESS)
- **Purpose:** Receives 20 CSPR platform fees
- **No funding required:** Receives payments from users

### 4. Liquidity Pool Address (LIQUIDITY_POOL_ADDRESS)
- **Purpose:** Receives 180 CSPR liquidity deposits
- **No funding required:** Receives payments from users

---

## Quick Setup Script

Create `scripts/setup-env.sh`:
```bash
#!/bin/bash

echo "🔧 Setting up environment variables..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    exit 1
fi

# Add missing variables
cat >> .env << 'EOF'

# Added by setup script
NEXT_PUBLIC_RPC_URL="https://node.testnet.casper.network/rpc"
RPC_FALLBACK_URL="https://node.testnet.casper.network/rpc"
CSPR_DEPLOYER_PRIVATE_KEY_HEX="YOUR_HEX_KEY_HERE"
CSPR_DEPLOYER_KEY_ALGO="ed25519"
PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX="YOUR_HEX_KEY_HERE"
PLATFORM_TOKEN_WALLET_PUBLIC_KEY_HEX="YOUR_PUBLIC_KEY_HERE"
PLATFORM_TOKEN_WALLET_KEY_ALGO="ed25519"
SLACK_WEBHOOK_URL=""
EMAIL_ALERTS_ENABLED="false"
LOG_LEVEL="info"
EOF

echo "✅ Environment variables template added!"
echo "⚠️  Please edit .env and replace YOUR_HEX_KEY_HERE with actual keys"
```

Run: `chmod +x scripts/setup-env.sh && ./scripts/setup-env.sh`

---

## Verification

After updating your `.env`, verify it works:

```bash
# Test that environment loads correctly
npm run dev

# Check health endpoint
curl http://localhost:3000/api/health

# Expected output:
# {
#   "status": "healthy",
#   "checks": {
#     "database": { "status": "healthy" },
#     ...
#   }
# }
```

---

## Common Issues

### Issue: "Private key not configured"
**Solution:** Add `CSPR_DEPLOYER_PRIVATE_KEY_HEX` and `PLATFORM_TOKEN_WALLET_PRIVATE_KEY_HEX`

### Issue: "RPC connection failed"
**Solution:** Verify `NEXT_PUBLIC_RPC_URL` is set correctly

### Issue: "Account not funded"
**Solution:** Fund your wallets at https://testnet.cspr.live/tools/faucet

### Issue: "Private key format invalid"
**Solution:** HEX keys should be 64 characters (no 0x prefix)

---

## Security Checklist

- [ ] `.env` file is in `.gitignore` ✅ (already done)
- [ ] Private keys are never committed to git
- [ ] Different keys for production vs development
- [ ] Wallets are funded on testnet
- [ ] Backup private keys securely (password manager, encrypted storage)

---

## Next Steps

1. ✅ Update your `.env` with the required variables
2. ✅ Convert PEM to HEX (use script above)
3. ✅ Fund deployer wallet (500+ CSPR)
4. ✅ Fund token wallet (500+ CSPR)
5. ✅ Test: `npm run dev`
6. ✅ Test: `curl http://localhost:3000/api/health`
7. ✅ Create a test project
8. ✅ Execute a test trade

You're now ready to run the platform! 🚀
