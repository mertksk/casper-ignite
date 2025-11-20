# Testnet Deployment Guide

This guide walks you through deploying and testing the Casper Ignite platform on Casper testnet.

## Prerequisites

- Casper Wallet browser extension installed
- Testnet CSPR tokens (obtainable from faucet)
- Node.js 18+ and npm installed
- PostgreSQL database running

## 1. Environment Configuration

Update your `.env` file with testnet configuration:

```bash
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_NAME=Casper Ignite
NEXT_PUBLIC_CHAIN_NAME=casper-test

# Casper Network - Testnet
CSPR_RPC_URL_PRIMARY=https://rpc.testnet.casperlabs.io/rpc
CSPR_RPC_URL_FALLBACK=https://casper-node.tor.us/rpc

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/casper_ignite_testnet

# Platform Wallet Addresses (REPLACE WITH YOUR TESTNET WALLETS)
PLATFORM_FEE_ADDRESS=0202a0c94e3f2e9e9f8c0a0a8f8e9d8c7b6a5b4c3d2e1f0a0b1c2d3e4f5a6b7c8d9e
LIQUIDITY_POOL_ADDRESS=0203b1d05f4g3h2i1j0k9l8m7n6o5p4q3r2s1t0u9v8w7x6y5z4a3b2c1d0e9f8g7h

# Optional
REDIS_URL=redis://localhost:6379
SMTP_URL=smtp://localhost:1025
```

### Getting Testnet Wallet Addresses

1. Open Casper Wallet extension
2. Switch to Testnet network
3. Create or select account for platform fees
4. Copy public key (starts with `02...`)
5. Create or select account for liquidity pool
6. Copy public key
7. Update `PLATFORM_FEE_ADDRESS` and `LIQUIDITY_POOL_ADDRESS` in `.env`

### Getting Testnet CSPR

1. Visit https://testnet.cspr.live/tools/faucet
2. Enter your wallet address
3. Request testnet CSPR (usually 1000 CSPR per request)
4. Wait for confirmation (~2 minutes)

## 2. Database Setup

```bash
# Reset database and apply migrations
npm run prisma:migrate

# Verify schema
npx prisma db pull
npx prisma generate
```

## 3. Start Development Server

```bash
npm run dev
```

Server will start at http://localhost:3000

## 4. Testing Flow

### Test 1: Wallet Connection

1. Navigate to http://localhost:3000
2. Click "Connect Wallet" button
3. Casper Wallet popup should appear
4. Select account and connect
5. Verify wallet address displays correctly

Expected: Wallet connects within 2-3 seconds

### Test 2: Project Creation with Payment

1. Click "Create Project" button
2. Fill in project details:
   - Title: "Test Token Project"
   - Description: "Testing token deployment on Casper testnet"
   - Token Symbol: "TEST"
   - Token Supply: 1000000
   - Ownership Percent: 10
   - Category: DEFI
   - Roadmap: "Q1: Launch, Q2: Marketing, Q3: Partnerships..."
   - Funding Goal: 5000
3. Click "Next" to payment flow
4. **Payment Step 1: Platform Fee (600 CSPR)**
   - Click "Pay Platform Fee"
   - Casper Wallet popup appears with 600 CSPR transfer
   - Review transaction details
   - Click "Sign" in wallet
   - Wait for confirmation (~2 minutes)
5. **Payment Step 2: Liquidity Pool (1400 CSPR)**
   - Click "Pay Liquidity Pool"
   - Casper Wallet popup appears with 1400 CSPR transfer
   - Review transaction details
   - Click "Sign" in wallet
   - Wait for confirmation (~2 minutes)
6. Both deploy hashes should display
7. Click "Complete Project Creation"
8. **Token Deployment**
   - Review token deployment details (150 CSPR gas fee)
   - Click "Sign" in Casper Wallet
   - Wait for confirmation (~2-3 minutes)
9. Project should appear in project list

Expected: Total cost ~2150 CSPR (2000 + 150 gas), 3 blockchain transactions

### Test 3: Token Trading - Place Buy Order

1. Navigate to project detail page
2. In trading section, select "BUY" tab
3. Enter order details:
   - Amount: 100 TEST
   - Price: 0.5 CSPR per token
4. Click "Place Buy Order"
5. Review transaction (no blockchain tx needed for order placement)
6. Order should appear in "Open Orders" section

Expected: Order appears immediately, status "OPEN"

### Test 4: Token Trading - Place Sell Order & Match

1. Connect with different wallet (or same for testing)
2. Same project detail page
3. Select "SELL" tab
4. Enter order details:
   - Amount: 50 TEST
   - Price: 0.5 CSPR per token (same or lower than buy price)
5. Click "Place Sell Order"
6. **Automatic Matching**
   - System detects matching prices
   - Creates Trade record
   - Trade appears in "Recent Trades"
7. Click "Execute Trade" button on the trade
8. **Trade Execution Modal**
   - Review trade details (50 TEST at 0.5 CSPR)
   - Click "Execute on Blockchain"
   - Casper Wallet popup with CEP-18 token transfer
   - Sign transaction
   - Wait for confirmation
9. Buy order status changes to "PARTIALLY_FILLED" (50/100 filled)
10. Sell order status changes to "FILLED" (50/50 filled)
11. Trade status changes to "CONFIRMED"

Expected: Token transfer on blockchain, order statuses update correctly

### Test 5: Order Book Display

1. Refresh project page
2. Verify Order Book section shows:
   - **Buy Orders**: Highest price first
   - **Sell Orders**: Lowest price first
   - Remaining amounts after fills
3. Check "Recent Trades" section
4. Verify your orders in "My Orders" section

Expected: Real-time order book updates, correct sorting

## 5. Verification Checklist

- [ ] Wallet connects successfully
- [ ] Platform fee payment (600 CSPR) confirms on blockchain
- [ ] Liquidity pool payment (1400 CSPR) confirms on blockchain
- [ ] Token deployment succeeds (check https://testnet.cspr.live)
- [ ] Project appears in database with correct token details
- [ ] Buy orders can be placed
- [ ] Sell orders can be placed
- [ ] Orders match automatically when prices align
- [ ] Matched trades appear in Recent Trades
- [ ] Trade execution creates blockchain transaction
- [ ] Token transfer completes successfully
- [ ] Order statuses update (OPEN → PARTIALLY_FILLED → FILLED)
- [ ] Trade statuses update (PENDING → EXECUTING → CONFIRMED)

## 6. Blockchain Verification

### View Deploy on Casper Explorer

1. Copy deploy hash from application
2. Visit https://testnet.cspr.live
3. Paste deploy hash in search bar
4. Verify:
   - Deploy status: "Executed"
   - Result: "Success"
   - Gas cost
   - Timestamp

### Verify Token Contract

1. After project creation, copy contract hash from project details
2. Visit https://testnet.cspr.live
3. Search for contract hash
4. Verify:
   - Contract type: "CEP-18"
   - Token symbol matches your input
   - Total supply correct

### Verify Token Transfers

1. After trade execution, copy transfer deploy hash
2. Search on testnet explorer
3. Verify:
   - Entry point: "transfer"
   - Recipient address correct
   - Amount correct

## 7. Common Issues & Troubleshooting

### Issue: Wallet doesn't connect

**Symptoms**: "Casper Wallet extension not detected" message persists

**Solutions**:
- Ensure Casper Wallet extension is installed and enabled
- Refresh the page
- Check browser console for errors
- Try disconnecting and reconnecting in wallet extension
- Make sure you're on testnet in the wallet

### Issue: Payment fails with "insufficient funds"

**Symptoms**: Transaction rejected by wallet

**Solutions**:
- Check wallet balance (need at least 2200 CSPR)
- Visit faucet to get more testnet CSPR
- Wait for previous faucet request to complete
- Verify you're on testnet network

### Issue: Deploy confirmation timeout

**Symptoms**: "Deploy confirmation timeout" error after 2 minutes

**Solutions**:
- Check testnet RPC status (https://testnet.cspr.live)
- Copy deploy hash and check manually on explorer
- If deploy succeeded, note the hash and contact support
- Try with different RPC URL in `.env`

### Issue: Token deployment fails

**Symptoms**: Deploy executes but shows error on explorer

**Solutions**:
- Verify WASM file exists at `public/contracts/cep18.wasm`
- Check file size (should be ~195KB)
- Ensure sufficient gas (150 CSPR)
- Review runtime arguments in deploy

### Issue: Orders don't match

**Symptoms**: Buy and sell orders exist but no trade created

**Solutions**:
- Verify prices overlap (buy price >= sell price)
- Check order status (must be OPEN or PARTIALLY_FILLED)
- Check project ID matches
- Review server logs for matching errors
- Manually trigger: `POST /api/projects/{id}/match-orders`

### Issue: Trade execution fails

**Symptoms**: Trade status stuck in EXECUTING

**Solutions**:
- Check seller has sufficient token balance
- Verify contract hash is correct
- Check deploy on explorer for execution errors
- Ensure both parties connected correct wallets
- Review blockchain logs

### Issue: CSP errors in console

**Symptoms**: Content Security Policy violations

**Solutions**:
- Verify middleware CSP includes `unsafe-inline unsafe-eval`
- Clear browser cache
- Disable other extensions that might conflict
- Check middleware.ts configuration

### Issue: Database migration errors

**Symptoms**: Prisma schema drift warnings

**Solutions**:
```bash
# Reset database (development only!)
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes" npx prisma migrate reset --force

# Or create new migration
npx prisma migrate dev --name fix_schema

# Generate client
npx prisma generate
```

## 8. Development Mode vs Production Mode

### Development Mode (NODE_ENV=development)

- Payment verification is **optional**
- Can create projects without valid payment hashes
- Useful for testing UI/UX without blockchain transactions
- Platform addresses can be placeholders
- Faster iteration during development

### Production Mode (NODE_ENV=production)

- Payment verification is **required**
- Must provide valid platformFeeHash and liquidityPoolHash
- Both deploys must be confirmed on blockchain
- Platform addresses must be real wallet addresses
- All blockchain operations required

Toggle in `.env`:
```bash
NODE_ENV=development  # Skip payment verification
NODE_ENV=production   # Enforce payment verification
```

## 9. API Endpoints Reference

### Project Creation
```bash
POST /api/projects
Content-Type: application/json

{
  "title": "string",
  "description": "string",
  "tokenSymbol": "string",
  "tokenSupply": number,
  "ownershipPercent": number,
  "creatorAddress": "string",
  "category": "DEFI | GAMING | NFT | ...",
  "roadmap": "string",
  "fundingGoal": number,
  "platformFeeHash": "string (optional in dev)",
  "liquidityPoolHash": "string (optional in dev)"
}
```

### Create Payment Deploy
```bash
POST /api/payments/create-transfer
Content-Type: application/json

{
  "fromPublicKey": "string",
  "purpose": "platform_fee | liquidity_pool"
}

Response:
{
  "deployJson": {...},
  "deployHash": "string",
  "amount": number,
  "from": "string",
  "to": "string"
}
```

### Place Order
```bash
POST /api/projects/{projectId}/orders
Content-Type: application/json

{
  "wallet": "string",
  "side": "BUY | SELL",
  "tokenAmount": number,
  "pricePerToken": number
}
```

### Get Order Book
```bash
GET /api/projects/{projectId}/orders

Response:
{
  "buyOrders": [...],
  "sellOrders": [...],
  "spread": number
}
```

### Execute Trade
```bash
POST /api/trades/{tradeId}/execute
Content-Type: application/json

{
  "signedDeployJson": {...}
}
```

### Check Deploy Status
```bash
GET /api/deploys/{deployHash}/status

Response:
{
  "executed": boolean,
  "success": boolean,
  "errorMessage": "string | null"
}
```

## 10. Performance Monitoring

### Key Metrics to Watch

1. **Order Matching Latency**: Should complete within 500ms
2. **Deploy Confirmation Time**: Typically 90-180 seconds on testnet
3. **Order Book Query Time**: Should be under 200ms
4. **Token Transfer Gas Cost**: ~2-3 CSPR on testnet

### Database Queries

```sql
-- Check order statuses
SELECT status, COUNT(*) FROM "ProjectOrder" GROUP BY status;

-- Recent trades
SELECT * FROM "Trade" ORDER BY "createdAt" DESC LIMIT 10;

-- Failed trades
SELECT * FROM "Trade" WHERE status = 'FAILED';

-- Projects with tokens
SELECT id, title, "tokenSymbol", "contractHash" FROM "Project" WHERE "contractHash" IS NOT NULL;
```

## 11. Next Steps

After successful testnet deployment:

1. **Gather Feedback**: Test with real users on testnet
2. **Monitor Metrics**: Track order matching performance
3. **Security Audit**: Review payment verification logic
4. **Mainnet Preparation**:
   - Update RPC URLs to mainnet
   - Use real CSPR for platform wallets
   - Enable production mode
   - Set up monitoring and alerts
5. **Documentation**: Create user guides for end users

## 12. Support Resources

- Casper Docs: https://docs.casper.network
- Testnet Explorer: https://testnet.cspr.live
- CEP-18 Standard: https://github.com/casper-ecosystem/cep18
- Casper Wallet: https://github.com/make-software/casper-wallet
- Faucet: https://testnet.cspr.live/tools/faucet

## 13. Emergency Procedures

### If Platform Wallet Compromised

1. Immediately rotate wallet addresses
2. Update `PLATFORM_FEE_ADDRESS` and `LIQUIDITY_POOL_ADDRESS` in `.env`
3. Redeploy application
4. Notify users of address change
5. Monitor for unauthorized transactions

### If Database Corrupted

1. Stop application server
2. Restore from latest backup
3. Verify schema integrity
4. Run `npx prisma db pull` to sync schema
5. Restart application
6. Verify order book data

### If RPC Node Down

1. Update `CSPR_RPC_URL_PRIMARY` to fallback
2. Monitor https://testnet.cspr.live for status
3. Notify users of potential delays
4. Queue pending transactions for retry
