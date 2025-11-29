#!/bin/bash
# Deploy Bonding Curve AMM Contract to Casper Testnet

set -e

# Load environment variables
source .env

# Configuration
NODE_ADDRESS="https://node.testnet.casper.network/rpc"
CHAIN_NAME="casper-test"
WASM_PATH="contracts/amm/target/wasm32-unknown-unknown/release/bonding_curve_amm.wasm"
PAYMENT_AMOUNT="150000000000"  # 150 CSPR for deployment

# Check if WASM exists
if [ ! -f "$WASM_PATH" ]; then
    echo "Error: AMM WASM not found at $WASM_PATH"
    exit 1
fi

# Get deployer public key from private key
DEPLOYER_PUBLIC_KEY="$CSPR_DEPLOYER_PUBLIC_KEY"
DEPLOYER_SECRET_KEY_HEX="$CSPR_DEPLOYER_PRIVATE_KEY_HEX"

if [ -z "$DEPLOYER_PUBLIC_KEY" ]; then
    echo "Error: CSPR_DEPLOYER_PUBLIC_KEY not set in .env"
    exit 1
fi

echo "========================================"
echo "Deploying Bonding Curve AMM Contract"
echo "========================================"
echo "Node: $NODE_ADDRESS"
echo "Chain: $CHAIN_NAME"
echo "Deployer: $DEPLOYER_PUBLIC_KEY"
echo "WASM: $WASM_PATH"
echo "Payment: $(echo "scale=2; $PAYMENT_AMOUNT / 1000000000" | bc) CSPR"
echo ""

# Create temporary secret key file
SECRET_KEY_FILE=$(mktemp)
echo "-----BEGIN PRIVATE KEY-----" > "$SECRET_KEY_FILE"
# Convert hex to base64 for ed25519
echo "$DEPLOYER_SECRET_KEY_HEX" | xxd -r -p | base64 | fold -w 64 >> "$SECRET_KEY_FILE"
echo "-----END PRIVATE KEY-----" >> "$SECRET_KEY_FILE"

# Get admin account hash from public key
# Remove the 01 prefix (ed25519 indicator) and hash
ADMIN_ACCOUNT_HASH=$(echo -n "00${DEPLOYER_PUBLIC_KEY:2}" | xxd -r -p | openssl dgst -sha256 -binary | xxd -p)

echo "Admin Account Hash: account-hash-$ADMIN_ACCOUNT_HASH"
echo ""

# Deploy the contract
echo "Deploying contract..."
DEPLOY_RESULT=$(casper-client put-deploy \
    --node-address "$NODE_ADDRESS" \
    --chain-name "$CHAIN_NAME" \
    --secret-key "$SECRET_KEY_FILE" \
    --payment-amount "$PAYMENT_AMOUNT" \
    --session-path "$WASM_PATH" \
    --session-arg "admin:account_hash='account-hash-$ADMIN_ACCOUNT_HASH'" \
    2>&1)

# Clean up temp file
rm -f "$SECRET_KEY_FILE"

echo "$DEPLOY_RESULT"

# Extract deploy hash
DEPLOY_HASH=$(echo "$DEPLOY_RESULT" | grep -o '"deploy_hash": "[^"]*"' | cut -d'"' -f4)

if [ -z "$DEPLOY_HASH" ]; then
    echo "Error: Failed to get deploy hash"
    exit 1
fi

echo ""
echo "========================================"
echo "Deploy submitted successfully!"
echo "========================================"
echo "Deploy Hash: $DEPLOY_HASH"
echo ""
echo "View on explorer:"
echo "https://testnet.cspr.live/deploy/$DEPLOY_HASH"
echo ""
echo "Waiting for deploy to be processed..."
echo "(This may take 1-2 minutes)"
echo ""

# Wait for deploy to be processed
sleep 30

# Check deploy status
echo "Checking deploy status..."
casper-client get-deploy \
    --node-address "$NODE_ADDRESS" \
    "$DEPLOY_HASH" | head -50

echo ""
echo "========================================"
echo "Next Steps:"
echo "========================================"
echo "1. Wait for deploy to complete (check explorer)"
echo "2. Query the contract hash:"
echo "   casper-client query-global-state \\"
echo "     --node-address $NODE_ADDRESS \\"
echo "     --key account-hash-$ADMIN_ACCOUNT_HASH \\"
echo "     -q 'bonding_curve_amm_hash'"
echo ""
echo "3. Add to .env:"
echo "   AMM_CONTRACT_HASH=\"hash-...\""
echo ""
