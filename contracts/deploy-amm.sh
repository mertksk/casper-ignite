#!/bin/bash
# Bonding Curve AMM Contract - Casper Testnet Deployment Script
# ==============================================================

set -e

# Configuration
NODE_ADDRESS="https://node.testnet.casper.network/rpc"
CHAIN_NAME="casper-test"
KEYS_DIR="$(dirname "$0")/keys"
WASM_PATH="$(dirname "$0")/amm/target/wasm32-unknown-unknown/release/bonding_curve_amm.wasm"

# Payment amount (60 CSPR = 60,000,000,000 motes - AMM is slightly larger)
PAYMENT_AMOUNT=60000000000

# Get account hash from public key
PUBLIC_KEY=$(cat "$KEYS_DIR/public_key_hex")
ACCOUNT_HASH=$(casper-client account-address --public-key "$KEYS_DIR/public_key.pem" | tr -d '\n')

echo "============================================"
echo "Bonding Curve AMM Contract Deployment"
echo "============================================"
echo "Node: $NODE_ADDRESS"
echo "Chain: $CHAIN_NAME"
echo "Public Key: $PUBLIC_KEY"
echo "Account Hash: $ACCOUNT_HASH"
echo "WASM Path: $WASM_PATH"
echo "Payment: $PAYMENT_AMOUNT motes (60 CSPR)"
echo "============================================"
echo ""

# Check if WASM exists
if [ ! -f "$WASM_PATH" ]; then
    echo "ERROR: WASM file not found at $WASM_PATH"
    echo "Run: cd amm && cargo build --release --target wasm32-unknown-unknown"
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
echo "Deploying Bonding Curve AMM contract..."
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
echo ""
echo "After deployment, find 'bonding_curve_amm_hash' in named keys."
echo "Then initialize the AMM with:"
echo "casper-client put-transaction session \\"
echo "    --node-address $NODE_ADDRESS \\"
echo "    --chain-name $CHAIN_NAME \\"
echo "    --secret-key $KEYS_DIR/secret_key.pem \\"
echo "    --contract-hash 'hash-<CONTRACT_HASH>' \\"
echo "    --entry-point 'initialize' \\"
echo "    --session-arg 'initial_price:u512=\"100000000\"' \\"
echo "    --session-arg 'reserve_ratio:u512=\"100\"' \\"
echo "    --payment-amount 3000000000 \\"
echo "    --standard-payment true \\"
echo "    --gas-price-tolerance 1 \\"
echo "    --ttl '30min'"
