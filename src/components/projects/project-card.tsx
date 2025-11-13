import Link from "next/link";
import { ProjectSummary } from "@/types/api";
import { Card, CardContent, CardFooter, CardHeader } from "../ui/card";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const price = project.metrics.currentPrice;
  const marketCap = project.metrics.marketCap;
  const investors = project.metrics.totalInvestors;

  return (
    <Card className="flex h-full flex-col justify-between border-4 border-brand-100 bg-gradient-to-br from-brand-50 via-white to-brand-100/80 shadow-cartoon-pop">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
              {project.tokenSymbol}
            </p>
            <Link
              href={`/projects/${project.id}`}
              className="text-xl font-semibold text-brand-800 hover:text-brand-600"
            >
              {project.title}
            </Link>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
            {project.tokenStatus === "DEPLOYED" ? "Canlı" : "Deploy Sürecinde"}
          </span>
        </div>
        <p className="text-sm text-brand-600 line-clamp-3">{project.description}</p>
      </CardHeader>

      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-sm text-brand-800">
          <div className="rounded-2xl bg-white/80 p-3 text-center shadow-sm">
            <dt className="text-xs uppercase tracking-wide text-brand-500">Token Supply</dt>
            <dd className="text-lg font-semibold">{project.tokenSupply.toLocaleString()}</dd>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 text-center shadow-sm">
            <dt className="text-xs uppercase tracking-wide text-brand-500">Sahiplik</dt>
            <dd className="text-lg font-semibold">%{project.ownershipPercent}</dd>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 text-center shadow-sm">
            <dt className="text-xs uppercase tracking-wide text-brand-500">Fiyat</dt>
            <dd className="text-lg font-semibold">
              {price ? `$${price.toFixed(2)}` : "—"}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/80 p-3 text-center shadow-sm">
            <dt className="text-xs uppercase tracking-wide text-brand-500">Yatırımcı</dt>
            <dd className="text-lg font-semibold">{investors.toLocaleString()}</dd>
          </div>
        </dl>
      </CardContent>

      <CardFooter className="flex items-center justify-between">
        <p className="text-sm font-semibold text-brand-700">
          Piyasa Değeri:{" "}
          <span className="text-brand-900">${marketCap.toLocaleString()}</span>
        </p>
        <Link
          href={`/projects/${project.id}`}
          className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-cartoon-pop hover:bg-brand-400"
        >
          Detay
        </Link>
      </CardFooter>
    </Card>
  );
}
