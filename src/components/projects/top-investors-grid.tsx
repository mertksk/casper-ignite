import Link from "next/link";
import { ProjectSummary } from "@/types/api";
import { Card, CardContent, CardHeader } from "../ui/card";
import { TrendingUp, Users, DollarSign } from "lucide-react";

interface TopInvestorsGridProps {
  projects: ProjectSummary[];
}

export function TopInvestorsGrid({ projects }: TopInvestorsGridProps) {
  if (projects.length === 0) {
    return null;
  }

  return (
    <section className="mb-12">
      {/* Section Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-brand-900">
            🔥 En Çok Yatırım Alanlar
          </h2>
          <p className="text-brand-600 mt-1">
            En yüksek piyasa değerine sahip projeler
          </p>
        </div>
        <div className="rounded-full bg-brand-100 px-4 py-2">
          <span className="text-sm font-semibold text-brand-700">
            Top {projects.length}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project, index) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="group relative"
          >
            <Card className="h-full border-4 border-brand-100 bg-gradient-to-br from-brand-50 via-white to-yellow-50/50 shadow-cartoon-pop transition-all hover:scale-[1.02] hover:shadow-cartoon-lift">
              {/* Rank Badge */}
              <div className="absolute -left-3 -top-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-600 shadow-cartoon-sm">
                <span className="text-xl font-bold text-white">#{index + 1}</span>
              </div>

              <CardHeader className="space-y-3 pt-6">
                {/* Token Symbol & Status */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
                      {project.tokenSymbol}
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-brand-900 line-clamp-2 group-hover:text-brand-600 transition-colors">
                      {project.title}
                    </h3>
                  </div>
                  <span className="ml-2 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                    {project.marketLevel === "APPROVED" ? "Approved" : "Pre-Market"}
                  </span>
                </div>

                {/* Description */}
                <p className="text-sm text-brand-600 line-clamp-2">
                  {project.description}
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Key Metrics - Highlighted */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Market Cap */}
                  <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 p-3 text-center shadow-sm">
                    <div className="mb-1 flex justify-center">
                      <TrendingUp className="h-4 w-4 text-white" />
                    </div>
                    <dt className="text-[10px] uppercase tracking-wide text-white/90">
                      Market Cap
                    </dt>
                    <dd className="text-base font-bold text-white">
                      ${(project.metrics.marketCap / 1000).toFixed(1)}k
                    </dd>
                  </div>

                  {/* Price */}
                  <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
                    <div className="mb-1 flex justify-center">
                      <DollarSign className="h-4 w-4 text-brand-500" />
                    </div>
                    <dt className="text-[10px] uppercase tracking-wide text-brand-500">
                      Price
                    </dt>
                    <dd className="text-base font-bold text-brand-900">
                      {project.metrics.currentPrice > 0
                        ? `$${project.metrics.currentPrice.toFixed(3)}`
                        : "—"}
                    </dd>
                  </div>

                  {/* Investors */}
                  <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
                    <div className="mb-1 flex justify-center">
                      <Users className="h-4 w-4 text-brand-500" />
                    </div>
                    <dt className="text-[10px] uppercase tracking-wide text-brand-500">
                      Investors
                    </dt>
                    <dd className="text-base font-bold text-brand-900">
                      {project.metrics.totalInvestors}
                    </dd>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white/60 p-2 text-center">
                    <dt className="text-[10px] uppercase tracking-wide text-brand-500">
                      Liquidity
                    </dt>
                    <dd className="text-sm font-semibold text-brand-800">
                      ${project.metrics.liquidityUsd.toLocaleString()}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-white/60 p-2 text-center">
                    <dt className="text-[10px] uppercase tracking-wide text-brand-500">
                      Category
                    </dt>
                    <dd className="text-sm font-semibold text-brand-800">
                      {project.category}
                    </dd>
                  </div>
                </div>

                {/* CTA Button */}
                <button className="w-full rounded-full bg-brand-500 py-2.5 text-sm font-semibold text-white shadow-cartoon-sm transition-all hover:bg-brand-600 hover:shadow-cartoon-pop group-hover:scale-105">
                  View Details →
                </button>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
