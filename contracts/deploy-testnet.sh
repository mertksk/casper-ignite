#!/bin/bash
# Token Vault Contract - Casper Testnet Deployment Script
# =========================================================

set -e

# Configuration
NODE_ADDRESS="https://node.testnet.casper.network/rpc"
CHAIN_NAME="casper-test"
KEYS_DIR="$(dirname "$0")/keys"
WASM_PATH="$(dirname "$0")/contract/target/wasm32-unknown-unknown/release/contract.wasm"

# Payment amount (50 CSPR = 50,000,000,000 motes)
PAYMENT_AMOUNT=50000000000

# Get account hash from public key
PUBLIC_KEY=$(cat "$KEYS_DIR/public_key_hex")
ACCOUNT_HASH=$(casper-client account-address --public-key "$KEYS_DIR/public_key.pem" | tr -d '\n')

echo "============================================"
echo "Token Vault Contract Deployment"
echo "============================================"
echo "Node: $NODE_ADDRESS"
echo "Chain: $CHAIN_NAME"
echo "Public Key: $PUBLIC_KEY"
echo "Account Hash: $ACCOUNT_HASH"
echo "WASM Path: $WASM_PATH"
echo "Payment: $PAYMENT_AMOUNT motes (50 CSPR)"
echo "============================================"
echo ""

# Check if WASM exists
if [ ! -f "$WASM_PATH" ]; then
    echo "ERROR: WASM file not found at $WASM_PATH"
    echo "Run: cd contract && cargo build --release --target wasm32-unknown-unknown"
    exit 1
fi

# Check account balance
echo "Checking account balance..."
BALANCE_RESULT=$(casper-client query-balance \
    --node-address "$NODE_ADDRESS" \
    --purse-identifier "$ACCOUNT_HASH" 2>&1) || true

if echo "$BALANCE_RESULT" | grep -q "Purse not found"; then
    echo ""
    echo "============================================"
    echo "ACCOUNT NOT FUNDED"
    echo "============================================"
    echo "Your account needs testnet CSPR before deployment."
    echo ""
    echo "1. Go to: https://testnet.cspr.live/tools/faucet"
    echo "2. Enter your public key: $PUBLIC_KEY"
    echo "3. Request testnet CSPR"
    echo "4. Wait for the transfer to complete (1-2 minutes)"
    echo "5. Run this script again"
    echo ""
    exit 1
fi

echo "Balance: $BALANCE_RESULT"
echo ""

# Deploy the contract
echo "Deploying Token Vault contract..."
echo ""

casper-client put-transaction session \
    --node-address "$NODE_ADDRESS" \
    --chain-name "$CHAIN_NAME" \
    --secret-key "$KEYS_DIR/secret_key.pem" \
    --wasm-path "$WASM_PATH" \
    --payment-amount "$PAYMENT_AMOUNT" \
    --standard-payment true \
    --gas-price-tolerance 1 \
    --session-arg "admin:account_hash='$ACCOUNT_HASH'" \
    --install-upgrade \
    --ttl "30min"

echo ""
echo "============================================"
echo "Deployment submitted!"
echo "============================================"
echo ""
echo "To check deployment status, run:"
echo "casper-client get-transaction --node-address $NODE_ADDRESS --transaction-hash <HASH>"
echo ""
echo "To query your account's named keys after deployment:"
echo "casper-client query-global-state --node-address $NODE_ADDRESS --key '$ACCOUNT_HASH' --query-path ''"
