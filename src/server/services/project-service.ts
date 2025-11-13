import "server-only";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { projectListQuerySchema, type ProjectListQuery, type ProjectCreateInput, type OrderCreateInput } from "@/lib/dto";
import { deployProjectToken } from "@/lib/casper";

type ProjectInclude = Prisma.ProjectGetPayload<{
  include: { metrics: true };
}>;

const projectWithMetrics = {
  include: {
    metrics: true,
  },
} satisfies Prisma.ProjectInclude;

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
    };
  },

  async createProject(input: ProjectCreateInput) {
    const contractHash = await deployProjectToken({
      symbol: input.tokenSymbol,
      totalSupply: input.tokenSupply,
      projectName: input.title,
    });

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
          ? project.metrics.marketCap + totalVolume
          : Math.max(project.metrics.marketCap - totalVolume, 0);

      await tx.projectMetric.update({
        where: { projectId: input.projectId },
        data: {
          currentPrice: input.pricePerToken,
          marketCap: newMarketCap,
          liquidityUsd: project.metrics.liquidityUsd + totalVolume * 0.1,
          totalInvestors: { increment: input.side === "BUY" ? 1 : 0 },
        },
      });

      return created;
    });

    return order;
  },
};

export type ProjectSummary = ReturnType<typeof mapProject>;
