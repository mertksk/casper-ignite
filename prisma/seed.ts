/* eslint-disable no-console */
import { PrismaClient, OrderSide, ProjectTokenStatus } from "../src/generated/prisma";

const prisma = new PrismaClient();

const sampleProjects = [
  {
    title: "Aurora Mobility Pods",
    description:
      "Otonom micro-mobility araçlarını Casper ağı üzerinden tokenize eden ve gelir paylaşımı sunan bir girişim.",
    tokenSymbol: "AURPOD",
    tokenSupply: 1_000_000,
    ownershipPercent: 12.5,
    creatorAddress: "0200aurora001",
    marketCap: 2_500_000,
  },
  {
    title: "Helios Vertical Farms",
    description:
      "Kent içi dikey tarım çözümleri için izlenebilir tedarik zinciri ve yatırım token modeli.",
    tokenSymbol: "HELIOS",
    tokenSupply: 750_000,
    ownershipPercent: 18.0,
    creatorAddress: "0200helios001",
    marketCap: 1_280_000,
  },
  {
    title: "Flux Energy Storage",
    description:
      "Şebeke dışı enerji depolama modüllerini tokenize ederek topluluk destekli finansman sağlayan proje.",
    tokenSymbol: "FLUX",
    tokenSupply: 2_500_000,
    ownershipPercent: 22.0,
    creatorAddress: "0200flux001",
    marketCap: 3_100_000,
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
