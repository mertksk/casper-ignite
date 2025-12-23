# Casper Ignite - Smart Contracts

This document describes all smart contracts deployed for the Casper Ignite token launchpad platform.

## Overview

Casper Ignite is a fully decentralized token launchpad on the Casper Network. The platform uses on-chain smart contracts for:

- **Token Trading** - Bonding curve AMM for instant buy/sell
- **Limit Orders** - On-chain order book with price-time priority
- **Project Launches** - Token creation with vesting schedules
- **Escrow** - Trustless CSPR escrow for pending orders

## Deployed Contracts (Testnet)

| Contract | Hash | Status |
|----------|------|--------|
| **Bonding Curve AMM** | `hash-3359fadfe107ac4c676a4a3b2caf59dc3c696fb4581f815752e5cf2295df31ea` | ✅ Active |
| **Launchpad Controller** | `hash-a6066e474c40ff85fd72a936c8992586b1d45a5113a5a97b0c44f4c11c96759a` | ✅ Active |
| **Token Vault** | `account-hash-ddc5ea65d526bcd1712e1dbc52102d6336806dc3675495b813a88f96935159fc` | ✅ Active |
| **Order Book** | *Deploying* | ⏳ Pending |

---

## 1. Bonding Curve AMM

**Location:** `contracts/amm/`

A linear bonding curve AMM for instant token trading without traditional liquidity pools.

### Formula

```
price(supply) = initialPrice + (slope × supply)
slope = initialPrice × reserveRatio / SCALE
```

### Entry Points

| Entry Point | Description | Access |
|-------------|-------------|--------|
| `initialize` | Set curve parameters (initial price, reserve ratio) | Admin |
| `buy` | Buy tokens with CSPR | Public |
| `sell` | Sell tokens for CSPR | Public |
| `get_price` | Query current token price | Public |
| `get_balance` | Query user's token balance | Public |
| `get_reserve` | Query CSPR reserve amount | Public |
| `get_supply` | Query total token supply | Public |
| `deposit_reserve` | Add CSPR to reserve | Admin |
| `admin_withdraw` | Withdraw excess CSPR | Admin |

### Configuration

- **Initial Price:** 0.1 CSPR per token
- **Reserve Ratio:** 1% (100 basis points)
- **Initial Reserve:** 50 CSPR

### Storage

- `admin` - Admin account hash
- `cspr_reserve` - URef to CSPR purse
- `total_supply` - Total tokens minted
- `initial_price` - Starting price in motes
- `reserve_ratio` - Curve steepness (basis points)
- `token_balances` - Dictionary of user balances

---

## 2. Launchpad Controller

**Location:** `contracts/launchpad/`

Manages project registration, token launches, and founder vesting schedules.

### Entry Points

| Entry Point | Description | Access |
|-------------|-------------|--------|
| `create_project` | Register a new project (pays platform fee) | Public |
| `launch_token` | Deploy token and setup vesting | Project Owner |
| `claim_vested` | Claim unlocked vested tokens | Beneficiary |
| `collect_fees` | Withdraw accumulated platform fees | Admin |
| `get_project` | Query project details | Public |
| `get_vesting` | Query vesting schedule | Public |
| `set_platform_fee` | Update platform fee | Admin |

### Vesting Schedule

- **Cliff Period:** 12 months (tokens locked)
- **Total Vesting:** 24 months (linear unlock after cliff)

### Storage

- `admin` - Admin account hash
- `fee_purse` - Platform fee collection purse
- `project_counter` - Number of projects created
- `platform_fee` - Fee in motes (default: 5%)
- `projects` - Dictionary of project data
- `vesting` - Dictionary of vesting schedules

---

## 3. Order Book

**Location:** `contracts/orderbook/`

On-chain limit order book with price-time priority matching.

### Entry Points

| Entry Point | Description | Access |
|-------------|-------------|--------|
| `place_buy_order` | Place buy limit order (escrows CSPR) | Public |
| `place_sell_order` | Place sell limit order (escrows tokens) | Public |
| `cancel_order` | Cancel an open order | Order Owner |
| `get_order` | Query order details | Public |
| `get_best_bid` | Get highest buy price | Public |
| `get_best_ask` | Get lowest sell price | Public |
| `deposit_tokens` | Deposit tokens for trading | Public |
| `withdraw_tokens` | Withdraw available tokens | Public |

### Order Structure

```rust
struct Order {
    maker: AccountHash,     // Order creator
    side: u8,               // 0 = Buy, 1 = Sell
    price: U512,            // Price in motes per token
    amount: U512,           // Token amount
    filled: U512,           // Amount already filled
    timestamp: u64,         // Block timestamp
    status: u8,             // 0=Open, 1=Filled, 2=Cancelled, 3=Partial
}
```

### Storage

- `admin` - Admin account hash
- `cspr_escrow` - Escrowed CSPR purse
- `order_counter` - Auto-incrementing order ID
- `best_bid` - Current highest buy price
- `best_ask` - Current lowest sell price
- `orders` - Dictionary of order data
- `user_orders` - Dictionary of user's order IDs
- `token_balances` - Dictionary of escrowed token balances

---

## 4. Token Vault

**Location:** `contracts/contract/`

Trustless escrow for CSPR in pending orders.

### Entry Points

| Entry Point | Description | Access |
|-------------|-------------|--------|
| `lock_cspr` | Lock CSPR for a buy order | Public |
| `unlock_cspr` | Release CSPR (trade execution) | Admin/OrderBook |
| `cancel_order` | Cancel order and refund | Order Owner |
| `set_order_book` | Set authorized order book | Admin |
| `get_locked_amount` | Query locked amount | Public |

### Storage

- `admin` - Admin account hash
- `order_book` - Authorized order book contract
- `cspr_purse` - Vault's CSPR holding purse
- `locked_cspr` - Dictionary of locked amounts per order
- `order_owners` - Dictionary of order ownership

---

## 5. Session Contracts

### Lock CSPR Session

**Location:** `contracts/session/`

Session WASM that transfers CSPR from a user's main purse to the Token Vault.

**Arguments:**
- `vault_contract_hash` - Target vault contract
- `order_id` - Unique order identifier
- `amount` - CSPR amount in motes

### AMM Buy Session

**Location:** `contracts/amm-session/`

Session WASM that handles the buy flow for the AMM, transferring CSPR and receiving tokens.

**Arguments:**
- `amm_contract_hash` - Target AMM contract
- `token_amount` - Tokens to buy
- `max_cost` - Maximum CSPR willing to pay

---

## Technology Stack

- **Language:** Rust (no_std)
- **Target:** wasm32-unknown-unknown
- **SDK:** casper-contract v5.1.1, casper-types v6.0.1
- **Toolchain:** nightly-2024-07-31

## Building Contracts

```bash
# Build all contracts
cd contracts/amm && cargo build --release --target wasm32-unknown-unknown
cd contracts/orderbook && cargo build --release --target wasm32-unknown-unknown
cd contracts/launchpad && cargo build --release --target wasm32-unknown-unknown

# WASM output locations
contracts/amm/target/wasm32-unknown-unknown/release/bonding_curve_amm.wasm
contracts/orderbook/target/wasm32-unknown-unknown/release/orderbook.wasm
contracts/launchpad/target/wasm32-unknown-unknown/release/launchpad.wasm
```

## Deployment Scripts

```bash
# Deploy AMM
node scripts/deploy-amm.mjs

# Initialize AMM
node scripts/initialize-amm.mjs

# Deposit initial reserve
node scripts/deposit-amm-reserve.mjs

# Deploy Order Book
node scripts/deploy-orderbook.mjs

# Deploy Launchpad
node scripts/deploy-launchpad.mjs

# Get contract hashes
node scripts/get-amm-hash.mjs
node scripts/get-orderbook-hash.mjs
node scripts/get-launchpad-hash.mjs
```

## Frontend Integration

Each contract has a corresponding TypeScript client:

| Contract | Client | API Routes |
|----------|--------|------------|
| AMM | `src/lib/amm-client.ts` | `/api/amm/*` |
| Order Book | `src/lib/orderbook-client.ts` | `/api/orderbook/*` |
| Launchpad | `src/lib/launchpad-client.ts` | `/api/launchpad/*` |
| Vault | `src/lib/vault-client.ts` | `/api/vault/*` |

## Security Considerations

1. **Admin Functions** - Critical operations require admin authorization
2. **Slippage Protection** - AMM trades include max cost/min proceeds parameters
3. **Escrow Model** - Funds locked in contract, not held by platform
4. **Vesting Cliff** - Tokens locked for 12 months before any release
5. **Order Ownership** - Only order creator can cancel their orders

## Network Configuration

### Testnet
- Chain: `casper-test`
- RPC: `https://node.testnet.casper.network/rpc`
- Explorer: `https://testnet.cspr.live`

### Mainnet (Future)
- Chain: `casper`
- RPC: `https://node.casper-rpc.io/rpc`
- Explorer: `https://cspr.live`
