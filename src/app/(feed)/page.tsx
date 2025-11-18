import Link from "next/link";
import { CasperWalletPanel } from "@/components/wallet/casper-wallet-panel";
import { LiveStats } from "@/components/feed/live-stats";
import { RecentActivity } from "@/components/feed/recent-activity";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { prisma } from "@/lib/db";

export const revalidate = 30;

export default async function FeedPage() {
  // Fetch projects split by market level
  const approvedProjects = await prisma.project.findMany({
    where: { marketLevel: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { metrics: true },
  });

  const preMarketProjects = await prisma.project.findMany({
    where: { marketLevel: "PRE_MARKET" },
    orderBy: { createdAt: "desc" },
    take: 6,
    include: { metrics: true },
  });

  const allProjects = [...approvedProjects, ...preMarketProjects];

  const totalMarketCap = allProjects.reduce(
    (sum, project) => sum + (project.metrics?.marketCap || 0),
    0
  );
  const totalInvestors = allProjects.reduce(
    (sum, project) => sum + (project.metrics?.totalInvestors || 0),
    0
  );

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-block">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
              Casper Ignite
            </p>
          </div>
          <h1 className="text-5xl font-bold leading-tight text-brand-800 md:text-6xl">
            Tokenize your{" "}
            <span className="bg-gradient-to-r from-brand-600 to-risk-danger bg-clip-text text-transparent">
              venture
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-brand-600">
            Launch equity-like tokens to connect your project with investors.
            Secure, transparent, and automated on the Casper blockchain.
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href="/projects/new"
              className="rounded-full bg-brand-600 px-8 py-3 font-semibold text-white transition-all hover:bg-brand-700 hover:shadow-lg"
            >
              Create a Project
            </Link>
            <a
              href="#wallet"
              className="rounded-full border-2 border-brand-300 px-8 py-3 font-semibold text-brand-700 transition-all hover:border-brand-400 hover:bg-brand-50"
            >
              Connect Wallet
            </a>
          </div>
        </div>

        {/* Live Stats */}
        <LiveStats
          totalProjects={allProjects.length}
          totalMarketCap={totalMarketCap}
          totalInvestors={totalInvestors}
        />
      </section>

      {/* Wallet Panel */}
      <section id="wallet" className="scroll-mt-24">
        <div className="mx-auto max-w-2xl">
          <CasperWalletPanel />
        </div>
      </section>

      {/* Two-Tier Market Tabs */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-brand-800">
            Two-Tier Marketplace System
          </h2>
          <p className="text-brand-600">
            Projects start in the pre-market and are approved once they pass a $100k market cap.
          </p>
        </div>

        <Tabs defaultValue="approved" className="space-y-6">
          <div className="flex justify-center">
            <TabsList>
              <TabsTrigger value="approved">
                ✅ Approved Projects ({approvedProjects.length})
              </TabsTrigger>
              <TabsTrigger value="premarket">
                🚀 Pre-Market ({preMarketProjects.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Approved Projects Tab */}
          <TabsContent value="approved" className="space-y-4">
            <div className="rounded-xl border border-green-200 bg-green-50/30 p-4">
              <p className="text-sm text-green-800">
                <strong>Level 2:</strong> Projects that reached $100k+ market cap and maintained it for 15 days,
                then cleared admin review. More mature and reliable investments.
              </p>
            </div>

            {approvedProjects.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {approvedProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="group relative overflow-hidden rounded-2xl border-2 border-green-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-green-300 hover:shadow-xl"
                  >
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-green-100/50 transition-transform group-hover:scale-125" />
                    <div className="relative space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="flex-1 text-lg font-bold text-brand-800 group-hover:text-green-700">
                          {project.title}
                        </h3>
                        <span className="flex-shrink-0 rounded-full bg-green-600 px-3 py-1 text-xs font-bold text-white">
                          {project.tokenSymbol}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-brand-600">
                        {project.description}
                      </p>
                      <div className="space-y-2 border-t border-brand-100 pt-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-brand-500">Market Cap</span>
                          <span className="font-bold text-brand-800">
                            ${project.metrics?.marketCap.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-brand-500">Investors</span>
                          <span className="font-bold text-brand-800">
                            {project.metrics?.totalInvestors}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-brand-200 bg-white p-12 text-center">
                <p className="text-brand-600">No approved projects yet.</p>
              </div>
            )}
          </TabsContent>

          {/* Pre-Market Projects Tab */}
          <TabsContent value="premarket" className="space-y-4">
            <div className="rounded-xl border border-brand-300 bg-brand-50/30 p-4">
              <p className="text-sm text-brand-800">
                <strong>Level 1:</strong> Newly listed projects working toward the $100k market-cap threshold.
                Higher risk, higher potential return.
              </p>
            </div>

            {preMarketProjects.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {preMarketProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="group relative overflow-hidden rounded-2xl border-2 border-brand-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl"
                  >
                    <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-100/50 transition-transform group-hover:scale-125" />
                    <div className="relative space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="flex-1 text-lg font-bold text-brand-800 group-hover:text-brand-600">
                          {project.title}
                        </h3>
                        <span className="flex-shrink-0 rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white">
                          {project.tokenSymbol}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-brand-600">
                        {project.description}
                      </p>
                      <div className="space-y-2 border-t border-brand-100 pt-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-brand-500">Market Cap</span>
                          <span className="font-bold text-brand-800">
                            ${project.metrics?.marketCap.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-brand-500">Investors</span>
                          <span className="font-bold text-brand-800">
                            {project.metrics?.totalInvestors}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-brand-500">Goal</span>
                          <span className="font-bold text-brand-800">
                            {project.fundingGoal.toLocaleString()} CSPR
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-brand-200 bg-white p-12 text-center">
                <p className="text-brand-600">No pre-market projects yet.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Recent Activity Feed */}
      <section className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-brand-800">Recent Activity</h2>
          <p className="text-brand-600">
            Latest investments and project launches happening across the platform.
          </p>
        </div>
        <RecentActivity />
      </section>
    </div>
  );
}
