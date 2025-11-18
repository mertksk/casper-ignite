/* eslint-disable no-console */
import "dotenv/config";
import { PrismaClient, OrderSide, ProjectTokenStatus, ProjectCategory, MarketLevel } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

const sampleProjects = [
  {
    title: "Aurora Mobility Pods",
    description:
      "A venture that tokenizes autonomous micro-mobility vehicles on the Casper network and offers revenue sharing.",
    tokenSymbol: "AURPOD",
    tokenSupply: 1_000_000,
    ownershipPercent: 12.5,
    creatorAddress: "0200aurora001",
    marketCap: 2_500_000,
    category: ProjectCategory.INFRASTRUCTURE,
    roadmap: "Q1 2025: Prototype testing\nQ2 2025: Pilot region launch\nQ3 2025: Expansion to 10 cities\nQ4 2025: Autonomous driving integration",
    fundingGoal: 500_000,
    marketLevel: MarketLevel.APPROVED,
  },
  {
    title: "Helios Vertical Farms",
    description:
      "Traceable supply chain and investment token model for urban vertical farming solutions.",
    tokenSymbol: "HELIOS",
    tokenSupply: 750_000,
    ownershipPercent: 18.0,
    creatorAddress: "0200helios001",
    marketCap: 1_280_000,
    category: ProjectCategory.INFRASTRUCTURE,
    roadmap: "Q1 2025: First facility built\nQ2 2025: Blockchain integration\nQ3 2025: 5 new locations\nQ4 2025: First revenue distribution to token holders",
    fundingGoal: 300_000,
    marketLevel: MarketLevel.APPROVED,
  },
  {
    title: "Flux Energy Storage",
    description:
      "Project that tokenizes off-grid energy storage modules to deliver community-backed financing.",
    tokenSymbol: "FLUX",
    tokenSupply: 2_500_000,
    ownershipPercent: 22.0,
    creatorAddress: "0200flux001",
    marketCap: 3_100_000,
    category: ProjectCategory.DEFI,
    roadmap: "Q1 2025: Begin module production\nQ2 2025: Deploy first 100 modules\nQ3 2025: Smart grid integration\nQ4 2025: Launch energy trading platform",
    fundingGoal: 800_000,
    marketLevel: MarketLevel.PRE_MARKET,
  },
];

async function main() {
  console.log("Seeding Casper Ignite marketplace...");

  for (const sample of sampleProjects) {
    const project = await prisma.project.upsert({
      where: {
        title: sample.title,
      },
      update: {},
      create: {
        title: sample.title,
        description: sample.description,
        tokenSymbol: sample.tokenSymbol,
        tokenSupply: sample.tokenSupply,
        ownershipPercent: sample.ownershipPercent,
        creatorAddress: sample.creatorAddress,
        tokenContractHash: `contract-${sample.tokenSymbol.toLowerCase()}`,
        tokenStatus: ProjectTokenStatus.DEPLOYED,
        category: sample.category,
        roadmap: sample.roadmap,
        fundingGoal: sample.fundingGoal,
        marketLevel: sample.marketLevel,
        platformFeeHash: sample.marketLevel === MarketLevel.APPROVED ? `platform-fee-${sample.tokenSymbol.toLowerCase()}` : null,
        liquidityPoolHash: sample.marketLevel === MarketLevel.APPROVED ? `liquidity-${sample.tokenSymbol.toLowerCase()}` : null,
        approvedAt: sample.marketLevel === MarketLevel.APPROVED ? new Date() : null,
        approvedBy: sample.marketLevel === MarketLevel.APPROVED ? "admin-seed-0x000" : null,
      },
    });

    await prisma.projectMetric.upsert({
      where: { projectId: project.id },
      update: {},
      create: {
        projectId: project.id,
        currentPrice: sample.marketCap / sample.tokenSupply,
        marketCap: sample.marketCap,
        liquidityUsd: sample.marketCap * 0.1,
        totalInvestors: Math.floor(Math.random() * 800) + 120,
      },
    });

    // Create bonding curve for the project
    await prisma.bondingCurve.upsert({
      where: { projectId: project.id },
      update: {},
      create: {
        projectId: project.id,
        initialPrice: 0.001, // Starting price in CSPR
        reserveRatio: 0.5, // Linear curve
        currentSupply: sample.tokenSupply * 0.15, // 15% already sold
        reserveBalance: 1400, // Initial liquidity in CSPR
      },
    });

    const orderCount = Math.floor(Math.random() * 6) + 4;
    for (let i = 0; i < orderCount; i += 1) {
      await prisma.projectOrder.create({
        data: {
          projectId: project.id,
          wallet: `0200investor${i}${sample.tokenSymbol}`,
          side: i % 2 === 0 ? OrderSide.BUY : OrderSide.SELL,
          tokenAmount: Math.round(Math.random() * 12_000) / 10,
          pricePerToken: sample.marketCap / sample.tokenSupply,
        },
      });
    }
  }

  console.log("Seed completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
