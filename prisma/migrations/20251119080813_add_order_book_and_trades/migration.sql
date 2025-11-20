-- CreateEnum
CREATE TYPE "ProjectTokenStatus" AS ENUM ('PENDING', 'DEPLOYED', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'EXECUTING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "MarketLevel" AS ENUM ('PRE_MARKET', 'APPROVED');

-- CreateEnum
CREATE TYPE "ProjectCategory" AS ENUM ('DEFI', 'GAMING', 'NFT', 'DAO', 'INFRASTRUCTURE', 'METAVERSE', 'SOCIAL', 'MARKETPLACE', 'TOOLS', 'OTHER');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenSupply" INTEGER NOT NULL,
    "ownershipPercent" DOUBLE PRECISION NOT NULL,
    "creatorAddress" TEXT NOT NULL,
    "tokenContractHash" TEXT,
    "tokenStatus" "ProjectTokenStatus" NOT NULL DEFAULT 'PENDING',
    "marketLevel" "MarketLevel" NOT NULL DEFAULT 'PRE_MARKET',
    "category" "ProjectCategory" NOT NULL,
    "roadmap" TEXT NOT NULL,
    "fundingGoal" DOUBLE PRECISION NOT NULL,
    "platformFeeHash" TEXT,
    "liquidityPoolHash" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMetric" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "currentPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "liquidityUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalInvestors" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProjectMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "tokenAmount" DOUBLE PRECISION NOT NULL,
    "pricePerToken" DOUBLE PRECISION NOT NULL,
    "filledAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BondingCurve" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "initialPrice" DOUBLE PRECISION NOT NULL,
    "reserveRatio" DOUBLE PRECISION NOT NULL,
    "currentSupply" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reserveBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BondingCurve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketCapHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "marketCap" DOUBLE PRECISION NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketCapHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceHistory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interval" TEXT NOT NULL,

    CONSTRAINT "PriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_title_key" ON "Project"("title");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMetric_projectId_key" ON "ProjectMetric"("projectId");

-- CreateIndex
CREATE INDEX "ProjectOrder_projectId_status_side_pricePerToken_idx" ON "ProjectOrder"("projectId", "status", "side", "pricePerToken");

-- CreateIndex
CREATE INDEX "ProjectOrder_projectId_createdAt_idx" ON "ProjectOrder"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectOrder_wallet_status_idx" ON "ProjectOrder"("wallet", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BondingCurve_projectId_key" ON "BondingCurve"("projectId");

-- CreateIndex
CREATE INDEX "MarketCapHistory_projectId_recordedAt_idx" ON "MarketCapHistory"("projectId", "recordedAt");

-- CreateIndex
CREATE INDEX "PriceHistory_projectId_timestamp_idx" ON "PriceHistory"("projectId", "timestamp");

-- CreateIndex
CREATE INDEX "PriceHistory_projectId_interval_timestamp_idx" ON "PriceHistory"("projectId", "interval", "timestamp");

-- CreateIndex
CREATE INDEX "Trade_projectId_createdAt_idx" ON "Trade"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_buyerWallet_createdAt_idx" ON "Trade"("buyerWallet", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_sellerWallet_createdAt_idx" ON "Trade"("sellerWallet", "createdAt");

-- CreateIndex
CREATE INDEX "Trade_status_idx" ON "Trade"("status");

-- CreateIndex
CREATE INDEX "Trade_blockchainHash_idx" ON "Trade"("blockchainHash");

-- AddForeignKey
ALTER TABLE "ProjectMetric" ADD CONSTRAINT "ProjectMetric_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectOrder" ADD CONSTRAINT "ProjectOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BondingCurve" ADD CONSTRAINT "BondingCurve_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketCapHistory" ADD CONSTRAINT "MarketCapHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_buyOrderId_fkey" FOREIGN KEY ("buyOrderId") REFERENCES "ProjectOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_sellOrderId_fkey" FOREIGN KEY ("sellOrderId") REFERENCES "ProjectOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
