# Token Trading Platform - Testing Guide

## 🚀 Quick Start Checklist

Before testing, complete these setup steps:

### 1. Database Migration

**If you have an existing database:**
```bash
# Option A: Push schema changes (no migration history)
npx prisma db push

# Option B: Reset and create fresh migration (⚠️ loses all data)
npx prisma migrate reset
npx prisma migrate dev --name initial_schema
```

**If starting fresh:**
```bash
npm run prisma:migrate
```

### 2. Download CEP-18 Contract

```bash
cd public/contracts
curl -L -o cep18.wasm "https://github.com/casper-ecosystem/cep18/releases/download/v1.2.0/cep18.wasm"
cd ../..
```

Verify the file:
```bash
ls -lh public/contracts/cep18.wasm
# Should be ~100-200 KB
```

### 3. Environment Setup

Make sure your `.env` file has:
```bash
# Network
NEXT_PUBLIC_CHAIN_NAME="casper-test"
CSPR_RPC_URL_PRIMARY="https://node.testnet.casper.network/rpc"
CSPR_RPC_URL_FALLBACK="https://node.testnet.casper.network/rpc"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/casper_radar"

# Redis (if running locally)
REDIS_URL="redis://localhost:6379"
```

### 4. Install Casper Wallet

Download and install from: https://casperwallet.io/

**Switch to Testnet:**
1. Open Casper Wallet extension
2. Click settings (gear icon)
3. Select "Testnet" network
4. Save

### 5. Get Testnet CSPR

Visit: https://testnet.cspr.live/tools/faucet

Request **at least 2100 CSPR** for testing:
- 600 CSPR: Platform fee
- 1400 CSPR: Liquidity pool
- ~100 CSPR: Gas fees for multiple transactions

---

## 🧪 Test Scenarios

### Scenario 1: Order Book Trading (No Blockchain)

This tests the matching engine without actual blockchain transactions.

**Step 1: Create a Project**
```bash
# Start dev server
npm run dev
```

1. Navigate to http://localhost:3000
2. Click "Create Project"
3. Fill in project details:
   - Title: "Test Token Trading"
   - Symbol: "TEST"
   - Supply: 100000
   - Ownership: 10%
   - Category: DeFi
   - Description: "Testing order book matching"
   - Roadmap: "Phase 1: Testing, Phase 2: More testing"
   - Funding Goal: 1000 CSPR
4. Submit (payment step will fail - that's OK for now)

**Alternative: Use API directly**
```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Token Trading",
    "description": "Testing order book matching engine",
    "tokenSymbol": "TEST",
    "tokenSupply": 100000,
    "ownershipPercent": 10,
    "creatorAddress": "0202a0c94e3f2e9e9f8c0a0a8f8e9d8c7b6a5b4c3d2e1f0a0b1c2d3e4f5a6b7c8d9e",
    "category": "DEFI",
    "roadmap": "Phase 1: Testing\nPhase 2: Launch",
    "fundingGoal": 1000
  }'
```

**Step 2: Place Orders**

Open the project page and place orders using the trading interface:

**User A (Seller):**
- Connect wallet
- Side: SELL
- Amount: 1000 TEST
- Price: 0.50 CSPR
- Submit

**User B (Buyer):**
- Connect wallet
- Side: BUY
- Amount: 500 TEST
- Price: 0.52 CSPR
- Submit

**Expected Result:**
- ✅ Automatic match happens (buy price > sell price)
- ✅ Trade created: 500 TEST @ 0.50 CSPR (seller's price wins)
- ✅ Sell order becomes PARTIALLY_FILLED (500/1000)
- ✅ Buy order becomes FILLED (500/500)
- ✅ Current price updates to 0.50 CSPR

**Verify in Order Book:**
- Asks: 500 TEST @ 0.50 CSPR (remaining from seller)
- Bids: Empty (buyer order filled)

**Verify in Recent Trades:**
- Latest trade shows: 500 TEST @ 0.50 CSPR

---

### Scenario 2: Multiple Order Matching

Test the matching algorithm with multiple orders.

**Setup Orders:**

```javascript
// Place these via UI or API
const orders = [
  // Sellers
  { wallet: "Alice", side: "SELL", amount: 1000, price: 0.55 },
  { wallet: "Bob", side: "SELL", amount: 500, price: 0.50 },
  { wallet: "Carol", side: "SELL", amount: 2000, price: 0.60 },

  // Buyers
  { wallet: "Dave", side: "BUY", amount: 1500, price: 0.52 },
  { wallet: "Eve", side: "BUY", amount: 800, price: 0.51 },
];
```

**Expected Matches:**
1. Dave (BUY 1500 @ 0.52) matches Bob (SELL 500 @ 0.50)
   - Trade: 500 TEST @ 0.50
   - Dave's order: PARTIALLY_FILLED (500/1500)
   - Bob's order: FILLED (500/500)

2. Dave's remaining (BUY 1000 @ 0.52) matches Alice (SELL 1000 @ 0.55)?
   - ❌ No match (0.52 < 0.55)

3. Eve (BUY 800 @ 0.51) matches Bob?
   - ❌ Bob already filled

**Final Order Book:**
- Asks: 1000 @ 0.55, 2000 @ 0.60
- Bids: 1000 @ 0.52, 800 @ 0.51

**Verify Price-Time Priority:**
Place two sell orders at same price:
```javascript
{ wallet: "Alice", side: "SELL", amount: 500, price: 0.50 }, // First
{ wallet: "Bob", side: "SELL", amount: 500, price: 0.50 },   // Second
```

Then place buy order:
```javascript
{ wallet: "Dave", side: "BUY", amount: 600, price: 0.51 }
```

**Expected:**
- Alice's order (older) gets filled first: 500 TEST
- Bob's order gets partially filled: 100 TEST
- Dave's order: FILLED (600/600)

---

### Scenario 3: Order Cancellation

**Step 1: Place an order**
```javascript
{ wallet: "Alice", side: "SELL", amount: 1000, price: 0.55, status: "OPEN" }
```

**Step 2: Cancel it**
- Go to "Your Orders" section
- Click "Cancel" button
- Confirm cancellation

**Expected Result:**
- Order status changes to CANCELLED
- Order removed from order book
- Cannot be matched anymore

**Try to cancel a filled order:**
- Place and match an order
- Try to cancel the filled order
- ❌ Should fail with "Order cannot be cancelled"

---

### Scenario 4: Payment Flow (2000 CSPR)

⚠️ **Requires testnet CSPR in wallet**

**Step 1: Start Project Creation**
1. Navigate to "Create Project"
2. Fill in project details
3. Click "Create Project"

**Step 2: Payment Flow Begins**
- Connect Casper Wallet
- Step 1/3: Pay 600 CSPR platform fee
  - Click "Pay Platform Fee"
  - Casper Wallet opens → Sign transaction
  - Wait ~60 seconds for confirmation
  - ✅ Green checkmark appears

- Step 2/3: Pay 1400 CSPR liquidity pool
  - Click "Pay Liquidity Pool"
  - Casper Wallet opens → Sign transaction
  - Wait ~60 seconds for confirmation
  - ✅ Green checkmark appears

- Step 3/3: Complete
  - Both payment hashes displayed
  - Project creation enabled

**Verify on Blockchain:**
```bash
# Check deploy status
curl -X POST https://node.testnet.casper.network/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "info_get_deploy",
    "params": { "deploy_hash": "YOUR_DEPLOY_HASH" },
    "id": 1
  }'
```

**Troubleshooting:**
- **"Insufficient funds"**: Need more testnet CSPR
- **"Deploy timeout"**: Testnet might be slow, wait longer
- **"Deploy failed"**: Check gas price, check wallet balance

---

### Scenario 5: Trade Execution (Token Transfer)

⚠️ **Requires deployed CEP-18 token contract**

**Prerequisites:**
- Project with `tokenContractHash` (deployed token)
- Matched trade with status=PENDING
- Seller must have tokens in wallet

**Step 1: Execute Trade**
1. Navigate to project page
2. Find pending trade in "Recent Trades"
3. Click "Execute" button
4. Trade Execution Modal opens

**Step 2: Review Details**
- Token amount
- Price per token
- Total value in CSPR
- From: Seller address
- To: Buyer address

**Step 3: Sign Transaction**
- Click "Sign & Execute Trade"
- Casper Wallet opens with CEP-18 transfer
- Review transaction details
- Sign transaction

**Step 4: Wait for Confirmation**
- Status: EXECUTING
- Transaction hash displayed
- Poll every 5 seconds
- Wait up to 2 minutes

**Step 5: Success**
- Status: CONFIRMED
- Tokens transferred on blockchain
- Trade history updated
- User balances updated

**Verify Token Transfer:**
```bash
# Check buyer's balance
curl -X POST https://node.testnet.casper.network/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "state_get_dictionary_item",
    "params": {
      "state_root_hash": "STATE_ROOT_HASH",
      "dictionary_identifier": {
        "ContractNamedKey": {
          "key": "balances",
          "contract_named_key": "CONTRACT_HASH"
        }
      },
      "dictionary_item_key": "BUYER_PUBLIC_KEY"
    },
    "id": 1
  }'
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Wallet Won't Connect

**Symptoms:**
- "Casper Wallet eklentisi tespit edilmedi"
- Loading forever

**Solutions:**
1. Install Casper Wallet extension
2. Switch to testnet in wallet settings
3. Refresh page (Ctrl+R or Cmd+R)
4. Check browser console for CSP errors

**Debug:**
```javascript
// In browser console
window.CasperWalletProvider
// Should return: function
```

---

### Issue 2: CSP Errors

**Symptoms:**
- "Refused to execute inline script"
- "Refused to evaluate a string as JavaScript"

**Solution:**
Already fixed in `src/middleware.ts` - make sure dev server restarted after changes.

---

### Issue 3: Orders Not Matching

**Symptoms:**
- Orders stay OPEN despite crossing prices
- No trades created

**Debug Checklist:**
1. ✅ Both orders for same project?
2. ✅ Buy price >= Sell price?
3. ✅ Orders have status OPEN or PARTIALLY_FILLED?
4. ✅ Check backend logs for errors

**Test directly:**
```bash
# Check order book
curl http://localhost:3000/api/projects/PROJECT_ID/orders

# Check matching service
# Add console.logs in order-matching-service.ts matchOrders()
```

---

### Issue 4: Deploy Confirmation Timeout

**Symptoms:**
- Payment stuck at "Confirming Transaction"
- Timeout after 2 minutes

**Solutions:**
1. **Check testnet status:** https://testnet.cspr.live/
2. **Verify deploy submitted:**
   ```bash
   curl http://localhost:3000/api/deploys/DEPLOY_HASH/status
   ```
3. **Increase timeout** in component if testnet is slow
4. **Check RPC connectivity** in `src/lib/casper.ts`

---

### Issue 5: Database Migration Drift

**Symptoms:**
- "Drift detected" error
- Schema not in sync

**Solutions:**

**Option A: Push changes (keeps data):**
```bash
npx prisma db push
npm run prisma:generate
```

**Option B: Reset database (loses data):**
```bash
npx prisma migrate reset
npm run prisma:migrate
```

**Option C: Manual migration:**
```sql
-- Add new enums
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED');
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'EXECUTING', 'CONFIRMED', 'FAILED');

-- Update ProjectOrder table
ALTER TABLE "ProjectOrder"
  ADD COLUMN "filledAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create Trade table
CREATE TABLE "Trade" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "buyOrderId" TEXT NOT NULL,
  "sellOrderId" TEXT NOT NULL,
  "buyerWallet" TEXT NOT NULL,
  "sellerWallet" TEXT NOT NULL,
  "tokenAmount" DOUBLE PRECISION NOT NULL,
  "pricePerToken" DOUBLE PRECISION NOT NULL,
  "totalValue" DOUBLE PRECISION NOT NULL,
  "blockchainHash" TEXT,
  "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "executedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Trade_buyOrderId_fkey" FOREIGN KEY ("buyOrderId") REFERENCES "ProjectOrder"("id"),
  CONSTRAINT "Trade_sellOrderId_fkey" FOREIGN KEY ("sellOrderId") REFERENCES "ProjectOrder"("id")
);

-- Create indexes
CREATE INDEX "ProjectOrder_projectId_status_side_pricePerToken_idx" ON "ProjectOrder"("projectId", "status", "side", "pricePerToken");
CREATE INDEX "ProjectOrder_wallet_status_idx" ON "ProjectOrder"("wallet", "status");
CREATE INDEX "Trade_projectId_createdAt_idx" ON "Trade"("projectId", "createdAt");
CREATE INDEX "Trade_buyerWallet_createdAt_idx" ON "Trade"("buyerWallet", "createdAt");
CREATE INDEX "Trade_sellerWallet_createdAt_idx" ON "Trade"("sellerWallet", "createdAt");
CREATE INDEX "Trade_status_idx" ON "Trade"("status");
CREATE INDEX "Trade_blockchainHash_idx" ON "Trade"("blockchainHash");
```

---

## 📊 Expected Test Results

### Matching Algorithm Performance

**Test with 1000 orders:**
- Should complete in < 100ms
- All valid matches found
- No duplicate trades
- Correct partial fills

### Order Book Display

**After multiple orders:**
- Bids sorted by price DESC, time ASC
- Asks sorted by price ASC, time ASC
- Spread calculated correctly
- Aggregation by price level works

### Trade Execution

**Success Rate:**
- Payment confirmation: ~95% (testnet delays)
- Token transfer: ~98% (if contract deployed)
- Average time: 60-90 seconds per transaction

---

## 🔍 Manual Testing Script

Run this to test the full flow programmatically:

```javascript
// test-order-book.js
const projectId = 'YOUR_PROJECT_ID';
const baseUrl = 'http://localhost:3000';

async function createOrder(wallet, side, amount, price) {
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet, side, tokenAmount: amount, pricePerToken: price })
  });
  return res.json();
}

async function getOrderBook() {
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/orders`);
  return res.json();
}

async function getTrades() {
  const res = await fetch(`${baseUrl}/api/projects/${projectId}/trades`);
  return res.json();
}

// Test scenario
async function runTest() {
  console.log('Creating sell orders...');
  await createOrder('alice', 'SELL', 1000, 0.50);
  await createOrder('bob', 'SELL', 500, 0.55);

  console.log('Creating buy order (should match)...');
  await createOrder('dave', 'BUY', 600, 0.52);

  console.log('\nOrder Book:');
  const orderBook = await getOrderBook();
  console.log(JSON.stringify(orderBook, null, 2));

  console.log('\nRecent Trades:');
  const trades = await getTrades();
  console.log(JSON.stringify(trades, null, 2));
}

runTest();
```

Run with:
```bash
node test-order-book.js
```

---

## ✅ Final Checklist

Before deploying to production:

- [ ] CEP-18 contract deployed on mainnet
- [ ] Platform fee & liquidity addresses updated
- [ ] Payment verification enabled
- [ ] Real token deployment uncommented
- [ ] Trade confirmation polling working
- [ ] WebSocket/SSE for real-time updates
- [ ] Rate limiting configured
- [ ] Error monitoring setup (Sentry)
- [ ] Database backups configured
- [ ] RPC fallback endpoints tested

---

## 📞 Support

- Casper Network: https://discord.gg/casperblockchain
- CEP-18 Issues: https://github.com/casper-ecosystem/cep18/issues
- Testnet Explorer: https://testnet.cspr.live/

---

**Last Updated:** November 19, 2025
**Testing Status:** Backend ✅ | Frontend ✅ | Blockchain Integration ⏳
