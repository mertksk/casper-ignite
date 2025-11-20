# 🚀 Quick Start Guide

Welcome to the Casper Token Trading Platform! This guide will get you up and running in under 10 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Redis (optional, for caching)
- Git

## Setup in 3 Steps

### Step 1: Quick Setup Script

We've created an automated setup script to handle most of the configuration:

```bash
# Make sure you're in the project root
cd /Users/mertk/Documents/initalstart/web

# Run the setup script
./scripts/setup-test-env.sh
```

This script will:
- ✅ Download the CEP-18 contract WASM file
- ✅ Check your database connection
- ✅ Generate Prisma client
- ✅ Optionally sync database schema
- ✅ Verify environment configuration

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Start Development Server

```bash
npm run dev
```

Open http://localhost:3000 in your browser!

---

## What You Can Do Now

### 1. 🔗 Connect Wallet
- Install Casper Wallet from https://casperwallet.io/
- Switch to **Testnet** in wallet settings
- Connect your wallet on the homepage

### 2. 💰 Get Test CSPR
Visit https://testnet.cspr.live/tools/faucet and request:
- **2100 CSPR** for full testing (payment + trades + gas)

### 3. 📊 Test Order Book Trading
- Navigate to any project page
- Place buy/sell orders
- Watch automatic matching in action
- See trades execute in real-time

---

## Project Structure

```
web/
├── src/
│   ├── app/                          # Next.js app router pages
│   │   ├── api/                      # API routes
│   │   │   ├── projects/[id]/
│   │   │   │   ├── orders/           # Order creation & order book
│   │   │   │   └── trades/           # Trade history
│   │   │   ├── trades/[id]/execute/  # Trade execution
│   │   │   ├── payments/             # CSPR transfers
│   │   │   └── deploys/[hash]/status # Deploy monitoring
│   │   └── projects/[id]/            # Project detail page
│   ├── components/
│   │   ├── trading/                  # Trading UI components
│   │   │   ├── TradingInterface.tsx  # Main trading interface
│   │   │   └── TradeExecutionModal.tsx # Blockchain execution
│   │   ├── payments/                 # Payment flow components
│   │   │   └── ProjectPaymentFlow.tsx # 2000 CSPR payment wizard
│   │   └── wallet/                   # Wallet integration
│   │       └── casper-wallet-panel.tsx
│   ├── hooks/
│   │   └── useCasperWallet.ts        # Wallet hook with signing
│   ├── lib/
│   │   ├── casper.ts                 # Blockchain functions
│   │   ├── casperWallet.ts           # Wallet provider
│   │   └── db.ts                     # Prisma client
│   └── server/
│       └── services/
│           ├── order-matching-service.ts  # Binance-style matching
│           ├── project-service.ts         # Project CRUD
│           └── bonding-curve-service.ts   # Pricing (alternative)
├── prisma/
│   └── schema.prisma                 # Database schema
├── public/
│   └── contracts/
│       └── cep18.wasm                # CEP-18 token contract
├── IMPLEMENTATION_PROGRESS.md        # Detailed implementation docs
├── TESTING_GUIDE.md                  # Comprehensive testing guide
└── scripts/
    └── setup-test-env.sh             # Automated setup script
```

---

## Key Features

### ✅ Backend (Complete)
- **Order Matching Engine:** Price-time priority algorithm (like Binance)
- **Order Book:** Aggregated bid/ask with spread calculation
- **Partial Fills:** Orders can be filled across multiple trades
- **Trade Tracking:** Complete history with blockchain hashes
- **CSPR Payments:** Platform fee (600) + Liquidity pool (1400)
- **Token Transfers:** CEP-18 token execution on Casper blockchain

### ✅ Frontend (Complete)
- **Wallet Integration:** Casper Wallet connection with signing
- **Trading Interface:** Order book + order placement + trade history
- **Payment Flow:** Step-by-step payment wizard with confirmations
- **Trade Execution:** Blockchain transaction signing and monitoring
- **Real-time Updates:** Auto-refresh order book and trades

### ⏳ Blockchain Integration (Partial)
- ✅ Deploy creation functions
- ✅ Wallet signing integration
- ✅ Status polling
- ⏳ Real token deployment (commented out, needs WASM)
- ⏳ Payment verification (hashes stored but not verified)

---

## Environment Variables

Make sure these are set in your `.env` file:

```bash
# Network
NEXT_PUBLIC_CHAIN_NAME="casper-test"
CSPR_RPC_URL_PRIMARY="https://node.testnet.casper.network/rpc"
CSPR_RPC_URL_FALLBACK="https://node.testnet.casper.network/rpc"

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/casper_radar"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# App
NEXT_PUBLIC_APP_NAME="Casper Ignite"
NODE_ENV="development"
```

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Production build
npm run start            # Start production server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npx prisma db push       # Sync schema (no migration)
npx prisma studio        # Open database GUI

# Testing
npm run test             # Run tests
npm run lint             # Check code quality
```

---

## Testing the Platform

See **TESTING_GUIDE.md** for:
- Step-by-step testing scenarios
- Order matching tests
- Payment flow testing
- Blockchain transaction execution
- Troubleshooting common issues

Quick test:
```bash
# 1. Start dev server
npm run dev

# 2. Open browser
open http://localhost:3000

# 3. Connect Casper Wallet

# 4. Navigate to any project and place orders!
```

---

## Architecture Highlights

### Order Matching Algorithm
- **Price-Time Priority:** Best price gets matched first, then oldest order
- **Automatic Matching:** Runs after every order creation
- **Efficient:** O(n) complexity per matching session
- **Safe:** Database transactions ensure consistency

### Blockchain Integration
- **Client-Side Signing:** Private keys never leave the wallet
- **Unsigned Deploys:** Server creates, client signs
- **Confirmation Polling:** Automatic status checking
- **Error Handling:** Retry logic and timeout management

### Database Schema
- **ProjectOrder:** Orders with partial fill tracking
- **Trade:** Matched trades with blockchain hashes
- **Indexes:** Optimized for order book queries
- **Relations:** Proper foreign keys and cascades

---

## Next Steps

1. **Test Order Matching:**
   - Place buy and sell orders
   - Watch automatic matches
   - Check trade history

2. **Test Payments (with testnet CSPR):**
   - Create a project
   - Complete payment flow
   - Verify on blockchain

3. **Deploy Real Token:**
   - Uncomment code in `src/lib/casper.ts`
   - Test CEP-18 deployment
   - Transfer tokens between wallets

4. **Production Preparation:**
   - Switch to mainnet URLs
   - Update platform fee addresses
   - Enable payment verification
   - Set up monitoring

---

## Resources

- **Casper Docs:** https://docs.casper.network
- **CEP-18 Standard:** https://github.com/casper-ecosystem/cep18
- **Testnet Explorer:** https://testnet.cspr.live
- **Testnet Faucet:** https://testnet.cspr.live/tools/faucet
- **Casper Wallet:** https://casperwallet.io

---

## Need Help?

1. Check **TESTING_GUIDE.md** for common issues
2. Check **IMPLEMENTATION_PROGRESS.md** for implementation details
3. Review browser console for errors
4. Check backend logs in terminal
5. Join Casper Discord: https://discord.gg/casperblockchain

---

## What's Been Built

✅ **Complete Features:**
- Order book matching engine (Binance-style)
- Trading interface with real-time updates
- Wallet connection and signing
- Payment flow wizard
- Trade execution modal
- Database schema and migrations
- API endpoints for all operations
- Blockchain integration utilities

⏳ **To Complete:**
- Real CEP-18 token deployment
- Payment verification on-chain
- Background job for trade confirmation
- WebSocket for real-time updates
- Production deployment

---

**Ready to trade tokens on Casper!** 🎉

Start with: `./scripts/setup-test-env.sh`
