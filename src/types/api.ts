export type ProjectSummary = {
  id: string;
  title: string;
  description: string;
  tokenSymbol: string;
  tokenSupply: number;
  ownershipPercent: number;
  creatorAddress: string;
  tokenStatus: "PENDING" | "DEPLOYED" | "FAILED";
  marketLevel: "PRE_MARKET" | "APPROVED";
  category: "DEFI" | "GAMING" | "NFT" | "DAO" | "INFRASTRUCTURE" | "METAVERSE" | "SOCIAL" | "MARKETPLACE" | "TOOLS" | "OTHER";
  createdAt: string;
  metrics: {
    currentPrice: number;
    marketCap: number;
    liquidityUsd: number;
    totalInvestors: number;
  };
};

export type ProjectListResponse = {
  items: ProjectSummary[];
  nextCursor?: string;
};

export type ProjectDetailResponse = ProjectSummary & {
  orders: {
    id: string;
    wallet: string;
    side: "BUY" | "SELL";
    tokenAmount: number;
    pricePerToken: number;
    createdAt: string;
  }[];
};
