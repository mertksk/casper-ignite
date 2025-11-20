#!/bin/bash
# Setup script for Casper Token Trading Platform testing

echo "🚀 Setting up Casper Token Trading Platform..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Run this script from the project root.${NC}"
    exit 1
fi

# Step 1: Download CEP-18 contract
echo -e "${YELLOW}📦 Step 1/4: Downloading CEP-18 contract...${NC}"
mkdir -p public/contracts

if [ -f "public/contracts/cep18.wasm" ]; then
    echo -e "${GREEN}✓ CEP-18 contract already exists${NC}"
else
    echo "Downloading from GitHub..."
    curl -L -o public/contracts/cep18.wasm "https://github.com/casper-ecosystem/cep18/releases/download/v1.2.0/cep18.wasm" 2>/dev/null

    if [ -f "public/contracts/cep18.wasm" ]; then
        size=$(wc -c < public/contracts/cep18.wasm)
        echo -e "${GREEN}✓ Downloaded CEP-18 contract (${size} bytes)${NC}"
    else
        echo -e "${RED}❌ Failed to download CEP-18 contract${NC}"
        echo "Please download manually from: https://github.com/casper-ecosystem/cep18/releases"
    fi
fi
echo ""

# Step 2: Check database connection
echo -e "${YELLOW}🗄️  Step 2/4: Checking database...${NC}"
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL client found${NC}"
else
    echo -e "${YELLOW}⚠️  PostgreSQL client not found. Make sure your database is running.${NC}"
fi
echo ""

# Step 3: Prisma setup
echo -e "${YELLOW}🔧 Step 3/4: Setting up Prisma...${NC}"
echo "Generating Prisma client..."
npm run prisma:generate --silent

echo ""
echo "Do you want to sync the database schema? (This will update your database)"
echo "Options:"
echo "  1) Push schema (preserves data, no migration history)"
echo "  2) Create migration (clean approach, requires migration reset if drift exists)"
echo "  3) Skip (I'll do it manually later)"
read -p "Enter choice (1-3): " db_choice

case $db_choice in
    1)
        echo "Pushing schema to database..."
        npx prisma db push --accept-data-loss
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Database schema synced${NC}"
        else
            echo -e "${RED}❌ Database sync failed${NC}"
        fi
        ;;
    2)
        echo "Creating migration..."
        npm run prisma:migrate -- --name initial_schema
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Migration created and applied${NC}"
        else
            echo -e "${RED}❌ Migration failed. You may need to run: npx prisma migrate reset${NC}"
        fi
        ;;
    3)
        echo -e "${YELLOW}⚠️  Skipped database setup. Run manually when ready.${NC}"
        ;;
    *)
        echo -e "${YELLOW}⚠️  Invalid choice. Skipped database setup.${NC}"
        ;;
esac
echo ""

# Step 4: Environment check
echo -e "${YELLOW}⚙️  Step 4/4: Checking environment...${NC}"

if [ -f ".env" ]; then
    echo -e "${GREEN}✓ .env file exists${NC}"

    # Check for required variables
    if grep -q "NEXT_PUBLIC_CHAIN_NAME=\"casper-test\"" .env; then
        echo -e "${GREEN}✓ Chain name set to testnet${NC}"
    else
        echo -e "${YELLOW}⚠️  Chain name not set to testnet${NC}"
    fi

    if grep -q "CSPR_RPC_URL_PRIMARY" .env; then
        echo -e "${GREEN}✓ RPC URL configured${NC}"
    else
        echo -e "${YELLOW}⚠️  RPC URL not configured${NC}"
    fi
else
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Creating from .env.example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ Created .env from example${NC}"
        echo -e "${YELLOW}⚠️  Please update DATABASE_URL and other settings in .env${NC}"
    else
        echo -e "${RED}❌ .env.example not found${NC}"
    fi
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✨ Setup Complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Install Casper Wallet extension:"
echo "   https://casperwallet.io/"
echo ""
echo "2. Switch wallet to Testnet:"
echo "   Settings → Network → Testnet"
echo ""
echo "3. Get testnet CSPR (need ~2100 for testing):"
echo "   https://testnet.cspr.live/tools/faucet"
echo ""
echo "4. Start development server:"
echo "   npm run dev"
echo ""
echo "5. Open your browser:"
echo "   http://localhost:3000"
echo ""
echo "📖 Full testing guide available in:"
echo "   TESTING_GUIDE.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
