import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { projectListQuerySchema, type ProjectListQuery, type ProjectCreateInput, type OrderCreateInput } from "@/lib/dto";
import { deployProjectToken, sendTokenTransfer, waitForDeploy } from "@/lib/casper";
import { bondingCurveService } from "./bonding-curve-service";
import { appConfig } from "@/lib/config";

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
  tokenContractHash: project.tokenContractHash,
  tokenPackageHash: project.tokenPackageHash,
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

    // Search filter
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
        { tokenSymbol: { contains: params.search, mode: "insensitive" } },
      ];
    }

    // Category filter
    if (params.category && params.category !== "ALL") {
      where.category = params.category as Prisma.ProjectWhereInput["category"];
    }

    // Market level filter
    if (params.marketLevel && params.marketLevel !== "ALL") {
      where.marketLevel = params.marketLevel as Prisma.ProjectWhereInput["marketLevel"];
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
        bondingCurve: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 25,
        },
        priceHistory: {
          where: { interval: "1m" },
          orderBy: { timestamp: "asc" },
          take: 100, // Last 100 trades
        },
      },
    });
    if (!project) return null;

    // Compute metrics from bonding curve if stored metrics are zero
    let metrics = {
      currentPrice: project.metrics?.currentPrice ?? 0,
      marketCap: project.metrics?.marketCap ?? 0,
      liquidityUsd: project.metrics?.liquidityUsd ?? 0,
      totalInvestors: project.metrics?.totalInvestors ?? 0,
    };

    if (project.bondingCurve && metrics.currentPrice === 0) {
      const curve = project.bondingCurve;
      const slope = curve.initialPrice * curve.reserveRatio * 0.0001;
      const currentPrice = curve.initialPrice + slope * curve.currentSupply;
      const csprPriceUsd = 0.02;

      metrics = {
        currentPrice,
        marketCap: currentPrice * project.tokenSupply * csprPriceUsd,
        liquidityUsd: curve.reserveBalance * csprPriceUsd,
        totalInvestors: metrics.totalInvestors,
      };
    }

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      tokenSymbol: project.tokenSymbol,
      tokenSupply: project.tokenSupply,
      ownershipPercent: project.ownershipPercent,
      creatorAddress: project.creatorAddress,
      tokenContractHash: project.tokenContractHash,
      tokenPackageHash: project.tokenPackageHash,
      tokenStatus: project.tokenStatus,
      createdAt: project.createdAt.toISOString(),
      marketLevel: project.marketLevel,
      category: project.category,
      roadmap: project.roadmap,
      fundingGoal: project.fundingGoal,
      approvedAt: project.approvedAt?.toISOString() ?? null,
      metrics,
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
    // Step 1: Platform deploys token on behalf of user
    console.log(`[Project Creation] Deploying token ${input.tokenSymbol} for ${input.creatorAddress}`);

    const tokenDeployResult = await deployProjectToken({
      projectName: input.title,
      symbol: input.tokenSymbol,
      totalSupply: input.tokenSupply,
      creatorPublicKey: appConfig.platformAddresses.tokenWallet, // Platform wallet owns tokens initially
    });

    const contractHash = tokenDeployResult.contractHash;
    const contractPackageHash = tokenDeployResult.contractPackageHash;
    const deployHash = tokenDeployResult.deployHash;

    if (!contractHash) {
      throw new Error("Token deployment failed - contract hash could not be extracted");
    }

    // Step 2: Calculate token distribution
    const creatorTokenAmount = (input.tokenSupply * input.ownershipPercent) / 100;
    const platformTokenAmount = input.tokenSupply - creatorTokenAmount;

    console.log(`[Token Distribution] Total: ${input.tokenSupply}, Creator: ${creatorTokenAmount}, Platform: ${platformTokenAmount}`);

    // Step 3: Create project with all fields
    const project = await prisma.project.create({
      data: {
        title: input.title,
        description: input.description,
        tokenSymbol: input.tokenSymbol,
        tokenSupply: input.tokenSupply,
        ownershipPercent: input.ownershipPercent,
        creatorAddress: input.creatorAddress,
        tokenContractHash: contractHash,
        tokenPackageHash: contractPackageHash,
        tokenStatus: "DEPLOYED",

        // New fields
        category: input.category as Prisma.ProjectCreateInput["category"],
        roadmap: input.roadmap,
        fundingGoal: input.fundingGoal,
        marketLevel: "PRE_MARKET",

        // Token distribution
        creatorTokenAmount,
        platformTokenAmount,
        deployedBy: "PLATFORM",

        // Store payment deploy hashes for audit trail
        platformFeeHash: input.platformFeeHash ?? null,
        liquidityPoolHash: input.liquidityPoolHash ?? null,
        tokenDeployHash: deployHash,

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

    // Step 4: Transfer creator's portion of tokens (if > 0)
    if (creatorTokenAmount > 0) {
      console.log(`[Token Distribution] Transferring ${creatorTokenAmount} tokens to creator ${input.creatorAddress}`);

      const transferResult = await sendTokenTransfer({
        projectId: project.id,
        tokenContractHash: contractHash,
        toAddress: input.creatorAddress,
        tokenAmount: creatorTokenAmount,
      });

      // Wait for confirmation (with 5-minute timeout)
      console.log(`[Token Distribution] Waiting for confirmation of deploy ${transferResult.deployHash}`);
      const confirmed = await waitForDeploy(transferResult.deployHash, 300_000);

      if (!confirmed.success) {
        console.error(`[Token Distribution] FAILED - Deploy hash: ${transferResult.deployHash}`);
        // TODO: Add to admin review queue for manual resolution
        throw new Error(`Token transfer to creator failed. Deploy hash: ${transferResult.deployHash}`);
      }

      // Update project with distribution hash
      await prisma.project.update({
        where: { id: project.id },
        data: { tokenDistributionHash: transferResult.deployHash },
      });

      console.log(`[Token Distribution] SUCCESS - ${creatorTokenAmount} tokens transferred to creator`);
    }

    // Step 5: Initialize bonding curve
    await bondingCurveService.initialize({
      projectId: project.id,
      initialPrice: 0.001, // Starting price: 0.001 CSPR per token
      reserveRatio: 0.5, // Linear curve (medium steepness)
      totalSupply: project.tokenSupply,
    });

    console.log(`[Project Creation] Complete - Project ID: ${project.id}`);
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
