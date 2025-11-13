import "server-only";
import { CasperServiceByJsonRPC } from "casper-js-sdk";
import { appConfig } from "./config";

type DeployInput = {
  projectName: string;
  symbol: string;
  totalSupply: number;
};

let rpcClient: CasperServiceByJsonRPC | null = null;

function getRpcClient() {
  if (appConfig.isTest) return null;
  if (!rpcClient) {
    rpcClient = new CasperServiceByJsonRPC(appConfig.rpcUrls.primary);
  }
  return rpcClient;
}

/**
 * Placeholder deployment helper. In production this would craft and submit a deploy that
 * instantiates a CEP-18 contract. For MVP we simulate the flow but still ping RPC to ensure
 * connectivity.
 */
export async function deployProjectToken(input: DeployInput): Promise<string> {
  const client = getRpcClient();
  if (client) {
    await client.getLatestBlockInfo();
  }
  const hashSeed = `${input.projectName}-${input.symbol}-${input.totalSupply}-${Date.now()}`;
  const mockHash = `hash-${Buffer.from(hashSeed).toString("hex").slice(0, 32)}`;
  await new Promise((resolve) => setTimeout(resolve, 500));
  return mockHash;
}
