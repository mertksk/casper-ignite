import { notFound } from "next/navigation";
import { Metadata } from "next";
import { projectService } from "@/server/services/project-service";
import { Card, CardContent } from "@/components/ui/card";
import { SimpleTradingInterface } from "@/components/trading/SimpleTradingInterface";
import { AMMTradingInterface } from "@/components/trading/AMMTradingInterface";
import { PriceChart } from "@/components/charts/price-chart";
import { CopyAddress } from "@/components/ui/copy-address";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await projectService.get(id);
  if (!project) {
    return { title: "Project not found" };
  }
  return {
    title: `${project.title} · ${project.tokenSymbol}`,
    description: project.description.slice(0, 140),
  };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  const { id } = await params;
  const project = await projectService.get(id);
  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
          <CardContent className="space-y-4 p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
                {project.tokenSymbol}
              </p>
              <h1 className="text-3xl font-semibold text-brand-800">{project.title}</h1>
            </div>
            <p className="text-brand-700">{project.description}</p>
            <dl className="grid gap-4 text-sm text-brand-800 md:grid-cols-3">
              <div className="rounded-2xl bg-brand-50/80 p-3 text-center shadow-sm">
                <dt className="text-xs uppercase tracking-wide text-brand-500">Token Supply</dt>
                <dd className="text-lg font-semibold">
                  {project.tokenSupply.toLocaleString()}
                </dd>
              </div>
              <div className="rounded-2xl bg-brand-50/80 p-3 text-center shadow-sm">
                <dt className="text-xs uppercase tracking-wide text-brand-500">Ownership</dt>
                <dd className="text-lg font-semibold">%{project.ownershipPercent}</dd>
              </div>
              <div className="rounded-2xl bg-brand-50/80 p-3 text-center shadow-sm">
                <dt className="text-xs uppercase tracking-wide text-brand-500">Founder</dt>
                <dd className="flex items-center justify-center">
                  <CopyAddress address={project.creatorAddress} />
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-xl font-semibold text-brand-800">Market Snapshot</h2>
            <ul className="space-y-2 text-brand-700">
              <li className="flex items-center justify-between text-sm">
                <span>Price</span>
                <strong>${project.metrics.currentPrice.toFixed(2)}</strong>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span>Market Cap</span>
                <strong>${project.metrics.marketCap.toLocaleString()}</strong>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span>Liquidity</span>
                <strong>${project.metrics.liquidityUsd.toLocaleString()}</strong>
              </li>
              <li className="flex items-center justify-between text-sm">
                <span>Investors</span>
                <strong>{project.metrics.totalInvestors.toLocaleString()}</strong>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* Price Chart - Binance Style */}
      <PriceChart data={project.priceHistory} tokenSymbol={project.tokenSymbol} />

      {/* On-Chain AMM Trading */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold text-brand-800">Trade On-Chain</h2>
        <p className="mb-4 text-sm text-brand-600">
          Trade directly on the Casper blockchain using our bonding curve AMM smart contract.
        </p>
        <AMMTradingInterface tokenSymbol={project.tokenSymbol} />
      </section>

      {/* Simple Trading Interface with Bonding Curve (Off-chain) */}
      <section>
        <h2 className="mb-4 text-2xl font-semibold text-brand-800">Quick Trade (Platform)</h2>
        <p className="mb-4 text-sm text-brand-600">
          Trade via the platform for faster execution (off-chain matching).
        </p>
        <SimpleTradingInterface
          projectId={project.id}
          tokenSymbol={project.tokenSymbol}
          currentPrice={project.metrics.currentPrice}
        />
      </section>
    </div>
  );
}
