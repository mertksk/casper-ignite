import Link from "next/link";
import { ProjectSummary } from "@/types/api";
import { ExternalLink } from "lucide-react";

interface ProjectsListViewProps {
  projects: ProjectSummary[];
}

export function ProjectsListView({ projects }: ProjectsListViewProps) {
  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border-4 border-brand-100 bg-white p-12 text-center shadow-cartoon-sm">
        <p className="text-lg font-semibold text-brand-600">
          No projects found matching your filters.
        </p>
        <p className="mt-2 text-sm text-brand-500">
          Try adjusting your search criteria or filters.
        </p>
      </div>
    );
  }

  return (
    <section>
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-900">All Projects</h2>
        <p className="text-brand-600 mt-1">
          Browse all available projects
        </p>
      </div>

      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto rounded-2xl border-4 border-brand-100 bg-white shadow-cartoon-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-brand-100 bg-brand-50">
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-brand-700">
                #
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-brand-700">
                Project
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-brand-700">
                Category
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-brand-700">
                Market Cap
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-brand-700">
                Price
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-brand-700">
                Liquidity
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-brand-700">
                Investors
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-brand-700">
                Status
              </th>
              <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-brand-700">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-brand-50">
            {projects.map((project, index) => (
              <tr
                key={project.id}
                className="transition-colors hover:bg-brand-50/50"
              >
                {/* Index */}
                <td className="px-6 py-4 text-sm font-semibold text-brand-500">
                  {index + 1}
                </td>

                {/* Project Info */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-bold text-white shadow-sm">
                      {project.tokenSymbol.slice(0, 2)}
                    </div>
                    <div>
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-semibold text-brand-900 hover:text-brand-600 transition-colors"
                      >
                        {project.title}
                      </Link>
                      <p className="text-xs text-brand-500">{project.tokenSymbol}</p>
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td className="px-6 py-4">
                  <span className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
                    {project.category}
                  </span>
                </td>

                {/* Market Cap */}
                <td className="px-6 py-4 text-right">
                  <span className="font-semibold text-brand-900">
                    ${project.metrics.marketCap.toLocaleString()}
                  </span>
                </td>

                {/* Price */}
                <td className="px-6 py-4 text-right">
                  <div>
                    <span className="font-semibold text-brand-900">
                      {project.metrics.currentPrice > 0
                        ? `$${project.metrics.currentPrice.toFixed(4)}`
                        : "—"}
                    </span>
                    {/* TODO: Add 24h change when available */}
                    {/* <div className="mt-1 flex items-center justify-end gap-1 text-xs">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      <span className="text-green-600">+12.5%</span>
                    </div> */}
                  </div>
                </td>

                {/* Liquidity */}
                <td className="px-6 py-4 text-right">
                  <span className="text-sm font-medium text-brand-700">
                    ${project.metrics.liquidityUsd.toLocaleString()}
                  </span>
                </td>

                {/* Investors */}
                <td className="px-6 py-4 text-center">
                  <span className="inline-flex items-center justify-center rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                    {project.metrics.totalInvestors}
                  </span>
                </td>

                {/* Status */}
                <td className="px-6 py-4 text-center">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      project.marketLevel === "APPROVED"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {project.marketLevel === "APPROVED" ? "Approved" : "Pre-Market"}
                  </span>
                </td>

                {/* Action */}
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex items-center gap-1 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-cartoon-sm transition-all hover:bg-brand-600 hover:shadow-cartoon-pop"
                  >
                    View
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="grid gap-4 lg:hidden">
        {projects.map((project, index) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="group block"
          >
            <div className="rounded-2xl border-4 border-brand-100 bg-white p-4 shadow-cartoon-sm transition-all hover:shadow-cartoon-pop">
              {/* Header */}
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-base font-bold text-white shadow-sm">
                    {project.tokenSymbol.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand-900 group-hover:text-brand-600 transition-colors">
                      {project.title}
                    </h3>
                    <p className="text-xs text-brand-500">{project.tokenSymbol}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-brand-400">#{index + 1}</span>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="rounded-lg bg-brand-50 p-2">
                  <dt className="text-[10px] uppercase tracking-wide text-brand-500">
                    Market Cap
                  </dt>
                  <dd className="text-sm font-semibold text-brand-900">
                    ${(project.metrics.marketCap / 1000).toFixed(1)}k
                  </dd>
                </div>
                <div className="rounded-lg bg-brand-50 p-2">
                  <dt className="text-[10px] uppercase tracking-wide text-brand-500">
                    Price
                  </dt>
                  <dd className="text-sm font-semibold text-brand-900">
                    {project.metrics.currentPrice > 0
                      ? `$${project.metrics.currentPrice.toFixed(4)}`
                      : "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-brand-50 p-2">
                  <dt className="text-[10px] uppercase tracking-wide text-brand-500">
                    Investors
                  </dt>
                  <dd className="text-sm font-semibold text-brand-900">
                    {project.metrics.totalInvestors}
                  </dd>
                </div>
                <div className="rounded-lg bg-brand-50 p-2">
                  <dt className="text-[10px] uppercase tracking-wide text-brand-500">
                    Liquidity
                  </dt>
                  <dd className="text-sm font-semibold text-brand-900">
                    ${project.metrics.liquidityUsd.toLocaleString()}
                  </dd>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="inline-flex rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-700">
                  {project.category}
                </span>
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    project.marketLevel === "APPROVED"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {project.marketLevel === "APPROVED" ? "Approved" : "Pre-Market"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
