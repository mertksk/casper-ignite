import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { projectListQuerySchema, type ProjectListQuery, type ProjectCreateInput, type OrderCreateInput } from "@/lib/dto";
import { deployProjectToken } from "@/lib/casper";
import { bondingCurveService } from "./bonding-curve-service";

type ProjectInclude = Prisma.ProjectGetPayload<{
  include: { metrics: true };
}>;

const projectWithMetrics = {
  include: {
    metrics: true,
  },
} as const;

const mapProject = (project: ProjectInclude) => ({
  id: project.id,
  title: project.title,
  description: project.description,
  tokenSymbol: project.tokenSymbol,
  tokenSupply: project.tokenSupply,
  ownershipPercent: project.ownershipPercent,
  creatorAddress: project.creatorAddress,
  tokenStatus: project.tokenStatus,
  createdAt: project.createdAt.toISOString(),

  // New fields
  marketLevel: project.marketLevel,
  category: project.category,
  roadmap: project.roadmap,
  fundingGoal: project.fundingGoal,
  approvedAt: project.approvedAt?.toISOString() ?? null,

  metrics: {
    currentPrice: project.metrics?.currentPrice ?? 0,
    marketCap: project.metrics?.marketCap ?? 0,
    liquidityUsd: project.metrics?.liquidityUsd ?? 0,
    totalInvestors: project.metrics?.totalInvestors ?? 0,
  },
});

export const projectService = {
  async list(rawParams: Record<string, string | undefined>) {
    const parsed = projectListQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      throw new Error("Invalid list params");
    }
    const params = parsed.data as ProjectListQuery;

    const where: Prisma.ProjectWhereInput = {};
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
        { tokenSymbol: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const orderBy =
      params.sort === "marketCap"
        ? { metrics: { marketCap: "desc" as const } }
        : { createdAt: "desc" as const };

    const projects = await prisma.project.findMany({
      where,
      orderBy,
      take: params.limit + 1,
      skip: params.cursor ? 1 : 0,
      cursor: params.cursor ? { id: params.cursor } : undefined,
      include: projectWithMetrics.include,
    });

    const hasNext = projects.length > params.limit;
    const items = (hasNext ? projects.slice(0, params.limit) : projects).map(mapProject);

    return {
      items,
      nextCursor: hasNext ? projects[projects.length - 1]?.id : undefined,
    };
  },

  async get(id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        metrics: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        priceHistory: {
          where: { interval: "1h" },
          orderBy: { timestamp: "asc" },
          take: 48, // Last 48 hours
        },
      },
    });
    if (!project) return null;

    return {
      ...mapProject(project),
      orders: project.orders.map((order) => ({
        id: order.id,
        wallet: order.wallet,
        side: order.side,
        tokenAmount: order.tokenAmount,
        pricePerToken: order.pricePerToken,
        createdAt: order.createdAt.toISOString(),
      })),
      priceHistory: project.priceHistory.map((price) => ({
        timestamp: price.timestamp.toISOString(),
        open: price.open,
        high: price.high,
        low: price.low,
        close: price.close,
        volume: price.volume,
      })),
    };
  },

  async createProject(input: ProjectCreateInput) {
    // Step 1: Deploy CEP-18 token contract
    const contractHash = await deployProjectToken({
      symbol: input.tokenSymbol,
      totalSupply: input.tokenSupply,
      projectName: input.title,
      creatorPublicKey: input.creatorAddress,
    });

    // Step 2: Create project with all new fields
    const project = await prisma.project.create({
      data: {
        title: input.title,
        description: input.description,
        tokenSymbol: input.tokenSymbol,
        tokenSupply: input.tokenSupply,
        ownershipPercent: input.ownershipPercent,
        creatorAddress: input.creatorAddress,
        tokenContractHash: contractHash,
        tokenStatus: contractHash ? "DEPLOYED" : "PENDING",

        // New fields
        category: input.category as Prisma.ProjectCreateInput["category"],
        roadmap: input.roadmap,
        fundingGoal: input.fundingGoal,
        marketLevel: "PRE_MARKET", // All new projects start in pre-market

        // Note: platformFeeHash and liquidityPoolHash should be set
        // after payment deploys are sent and confirmed
        // For now, they remain null until payment flow is implemented

        metrics: {
          create: {
            currentPrice: 0,
            marketCap: 0,
            liquidityUsd: 0,
            totalInvestors: 0,
          },
        },
      },
      include: projectWithMetrics.include,
    });

    // Step 3: Initialize bonding curve
    await bondingCurveService.initialize({
      projectId: project.id,
      initialPrice: 0.001, // Starting price: 0.001 CSPR per token
      reserveRatio: 0.5, // Linear curve (medium steepness)
      totalSupply: project.tokenSupply,
    });

    return mapProject(project);
  },

  async createOrder(input: OrderCreateInput) {
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      include: { metrics: true },
    });
    if (!project || !project.metrics) {
      throw new Error("Project not found");
    }

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.projectOrder.create({
        data: {
          projectId: input.projectId,
          wallet: input.wallet,
          side: input.side as Prisma.ProjectOrderCreateInput["side"],
          tokenAmount: input.tokenAmount,
          pricePerToken: input.pricePerToken,
        },
      });

      const totalVolume = input.tokenAmount * input.pricePerToken;
      const newMarketCap =
        input.side === "BUY"
          ? (project.metrics?.marketCap || 0) + totalVolume
          : Math.max((project.metrics?.marketCap || 0) - totalVolume, 0);

      await tx.projectMetric.update({
        where: { projectId: input.projectId },
        data: {
          currentPrice: input.pricePerToken,
          marketCap: newMarketCap,
          liquidityUsd: (project.metrics?.liquidityUsd || 0) + totalVolume * 0.1,
          totalInvestors: { increment: input.side === "BUY" ? 1 : 0 },
        },
      });

      return created;
    });

    return order;
  },
};

export type ProjectSummary = ReturnType<typeof mapProject>;
