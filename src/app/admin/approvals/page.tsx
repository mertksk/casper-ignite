import { prisma } from "@/lib/db";
import Link from "next/link";
import { ApproveButton } from "@/components/admin/approve-button";

export const metadata = {
  title: "Project Approvals | Admin",
};

export default async function AdminApprovalsPage() {
  // Get all PRE_MARKET projects with their metrics and market cap history
  const preMarketProjects = await prisma.project.findMany({
    where: { marketLevel: "PRE_MARKET" },
    include: {
      metrics: true,
      marketCapHistory: {
        orderBy: { recordedAt: "desc" },
        take: 15,
      },
    },
    orderBy: {
      metrics: {
        marketCap: "desc",
      },
    },
  });

  const MIN_MARKET_CAP = 100_000;
  const MIN_DAYS = 15;

  // Calculate eligibility for each project
  const projectsWithEligibility = preMarketProjects.map((project) => {
    const currentMarketCap = project.metrics?.marketCap || 0;
    const meetsMarketCap = currentMarketCap >= MIN_MARKET_CAP;
    const hasEnoughHistory = project.marketCapHistory.length >= MIN_DAYS;
    const allAboveThreshold = project.marketCapHistory.every(
      (entry) => entry.marketCap >= MIN_MARKET_CAP
    );

    const eligible = meetsMarketCap && hasEnoughHistory && allAboveThreshold;

    return {
      ...project,
      eligible,
      meetsMarketCap,
      hasEnoughHistory,
      allAboveThreshold,
    };
  });

  const eligibleProjects = projectsWithEligibility.filter((p) => p.eligible);
  const notEligibleProjects = projectsWithEligibility.filter((p) => !p.eligible);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-brand-700">Project Approvals</h1>
        <p className="text-brand-600">
          Review and approve projects for the main market (Level 2)
        </p>
      </div>

      {/* Approval Criteria */}
      <div className="rounded-xl border-2 border-brand-200 bg-brand-50 p-6">
        <h2 className="mb-3 text-lg font-semibold text-brand-700">
          Approval Criteria
        </h2>
        <ul className="space-y-2 text-sm text-brand-600">
          <li className="flex items-center gap-2">
            <span className="text-brand-500">✓</span>
            Market cap must be ${MIN_MARKET_CAP.toLocaleString()} or higher
          </li>
          <li className="flex items-center gap-2">
            <span className="text-brand-500">✓</span>
            Must maintain minimum market cap for {MIN_DAYS} consecutive days
          </li>
          <li className="flex items-center gap-2">
            <span className="text-brand-500">✓</span>
            Requires admin approval
          </li>
        </ul>
      </div>

      {/* Eligible Projects */}
      {eligibleProjects.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-brand-700">
              ✅ Eligible for Approval ({eligibleProjects.length})
            </h2>
            <span className="rounded-full bg-green-100 px-4 py-1 text-xs font-semibold text-green-700">
              Ready
            </span>
          </div>

          <div className="space-y-3">
            {eligibleProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border-2 border-green-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold text-brand-800">
                        {project.title}
                      </h3>
                      <span className="rounded-full bg-brand-500 px-3 py-1 text-xs text-white">
                        {project.tokenSymbol}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-brand-600">
                      {project.description}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-brand-500">Market Cap</p>
                        <p className="font-semibold text-brand-800">
                          ${project.metrics?.marketCap.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-500">Investors</p>
                        <p className="font-semibold text-brand-800">
                          {project.metrics?.totalInvestors}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-brand-500">History Days</p>
                        <p className="font-semibold text-brand-800">
                          {project.marketCapHistory.length} / {MIN_DAYS}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-6 flex flex-col gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                    >
                      View Project
                    </Link>
                    <ApproveButton projectId={project.id} projectTitle={project.title} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Not Eligible Projects */}
      {notEligibleProjects.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-brand-700">
            ⏳ Not Yet Eligible ({notEligibleProjects.length})
          </h2>

          <div className="space-y-3">
            {notEligibleProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-brand-200 bg-white p-6 opacity-75"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-brand-800">
                        {project.title}
                      </h3>
                      <span className="rounded-full bg-brand-500 px-3 py-1 text-xs text-white">
                        {project.tokenSymbol}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-brand-500">Market Cap</p>
                        <p className="font-semibold text-brand-800">
                          ${project.metrics?.marketCap.toLocaleString()}
                        </p>
                        {!project.meetsMarketCap && (
                          <p className="text-xs text-red-600">
                            Below ${MIN_MARKET_CAP.toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-brand-500">History Days</p>
                        <p className="font-semibold text-brand-800">
                          {project.marketCapHistory.length} / {MIN_DAYS}
                        </p>
                        {!project.hasEnoughHistory && (
                          <p className="text-xs text-red-600">Need more days</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-brand-500">Consistency</p>
                        <p className="font-semibold text-brand-800">
                          {project.allAboveThreshold ? "✓ Pass" : "✗ Fail"}
                        </p>
                        {!project.allAboveThreshold && (
                          <p className="text-xs text-red-600">
                            Dropped below threshold
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/projects/${project.id}`}
                    className="ml-6 rounded-lg border border-brand-300 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    View Project
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {preMarketProjects.length === 0 && (
        <div className="rounded-xl border-2 border-brand-200 bg-white p-12 text-center">
          <p className="text-brand-600">No pre-market projects found.</p>
        </div>
      )}
    </div>
  );
}
