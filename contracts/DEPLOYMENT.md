# Token Vault Contract Deployment Guide

## Prerequisites

1. **Casper Wallet Browser Extension** - Install from [Chrome Web Store](https://chromewebstore.google.com/detail/casper-wallet/abkahkcbhngaebpcgfmhkoioedceoigp)

2. **Testnet CSPR** - Get from the faucet (instructions below)

## Generated Keys

Keys have been generated in `/contracts/keys/`:
- `public_key.pem` - Public key in PEM format
- `public_key_hex` - Public key in hex format
- `secret_key.pem` - **Keep this secure!** Secret key for signing transactions

**Your Public Key:** `01865eaccbda477b0ef6c1880381c96f5b65009ebf8d16f349dcdb4c3c692bc42e`

**Your Account Hash:** `account-hash-ddc5ea65d526bcd1712e1dbc52102d6336806dc3675495b813a88f96935159fc`

## Step 1: Import Key to Casper Wallet

1. Open Casper Wallet extension
2. Click "Import Account"
3. Select "From Secret Key File"
4. Upload `contracts/keys/secret_key.pem`
5. Name the account (e.g., "Token Vault Deployer")

## Step 2: Request Testnet CSPR

1. Go to [Casper Testnet Faucet](https://testnet.cspr.live/tools/faucet)
2. Connect with your imported account
3. Click "Request tokens"
4. Wait for the transaction to complete (~1-2 minutes)

> Note: Tokens can only be requested once per account. If you need more, email casper-testnet@make.services

## Step 3: Deploy the Contract

### Option A: Using the Deployment Script (Recommended)

```bash
cd contracts
./deploy-testnet.sh
```

### Option B: Manual Deployment

```bash
casper-client put-transaction session \
    --node-address https://node.testnet.casper.network/rpc \
    --chain-name casper-test \
    --secret-key ./keys/secret_key.pem \
    --wasm-path ./contract/target/wasm32-unknown-unknown/release/contract.wasm \
    --payment-amount 50000000000 \
    --gas-price-tolerance 1 \
    --session-arg "admin:account_hash='account-hash-ddc5ea65d526bcd1712e1dbc52102d6336806dc3675495b813a88f96935159fc'" \
    --install-upgrade \
    --ttl "30min"
```

## Step 4: Verify Deployment

After deployment, check the transaction status:

```bash
casper-client get-transaction \
    --node-address https://node.testnet.casper.network/rpc \
    --transaction-hash <TRANSACTION_HASH>
```

Query your account's named keys to see the deployed contract:

```bash
casper-client query-global-state \
    --node-address https://node.testnet.casper.network/rpc \
    --key 'account-hash-ddc5ea65d526bcd1712e1dbc52102d6336806dc3675495b813a88f96935159fc' \
    --query-path ''
```

## Contract Entry Points

Once deployed, the contract provides these entry points:

| Entry Point | Description | Callable By |
|-------------|-------------|-------------|
| `lock_cspr` | Lock CSPR for a buy order | Anyone |
| `unlock_cspr` | Release CSPR to recipient | Admin or Order Book |
| `cancel_order` | Cancel order and refund CSPR | Order Owner only |
| `set_order_book` | Set authorized order book contract | Admin only |
| `get_locked_amount` | Query locked amount for an order | Anyone |

## Contract Named Keys

After deployment, your account will have these named keys:
- `admin` - Admin account hash (URef)
- `cspr_purse` - Purse holding locked CSPR (URef)
- `order_book` - Authorized order book contract (URef)
- `locked_cspr` - Dictionary of locked amounts per order
- `order_owners` - Dictionary of order owners

## Interacting with the Contract

### Lock CSPR for an Order

```bash
# First, create a payment purse with the amount you want to lock
# Then call lock_cspr with:
casper-client put-transaction session \
    --node-address https://node.testnet.casper.network/rpc \
    --chain-name casper-test \
    --secret-key ./keys/secret_key.pem \
    --session-hash <CONTRACT_HASH> \
    --session-entry-point lock_cspr \
    --session-arg "order_id:string='order-001'" \
    --session-arg "amount:u512='1000000000'" \
    --session-arg "payment_purse:uref='<PURSE_UREF>'" \
    --payment-amount 5000000000 \
    --gas-price-tolerance 1
```

### Cancel an Order

```bash
casper-client put-transaction session \
    --node-address https://node.testnet.casper.network/rpc \
    --chain-name casper-test \
    --secret-key ./keys/secret_key.pem \
    --session-hash <CONTRACT_HASH> \
    --session-entry-point cancel_order \
    --session-arg "order_id:string='order-001'" \
    --payment-amount 5000000000 \
    --gas-price-tolerance 1
```

## Troubleshooting

### "Purse not found" error
Your account hasn't been funded yet. Request testnet CSPR from the faucet.

### "out of gas" error
Increase the `--payment-amount` value.

### "not authorized" error
Make sure you're using the correct account (admin for admin-only functions).

## Security Notes

- **Never commit `secret_key.pem` to git!** It's already in `.gitignore`
- The admin account has full control over the contract
- Only the order owner can cancel their own orders
- Only admin or order_book can unlock CSPR (for trade execution)
