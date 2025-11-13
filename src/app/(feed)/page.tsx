import Link from "next/link";
import { ProjectFeed } from "@/components/projects/project-feed";
import { CasperWalletPanel } from "@/components/wallet/casper-wallet-panel";
import { projectService } from "@/server/services/project-service";

export const revalidate = 30;

export default async function FeedPage() {
  const initialFeed = await projectService.list({ limit: "12", sort: "createdAt" });
  const totalMarketCap = initialFeed.items.reduce(
    (sum, project) => sum + project.metrics.marketCap,
    0
  );
  const totalInvestors = initialFeed.items.reduce(
    (sum, project) => sum + project.metrics.totalInvestors,
    0
  );

  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-[2fr,1fr] xl:grid-cols-[2fr,1fr,0.8fr]">
        <div className="relative overflow-hidden rounded-3xl border-4 border-brand-200 bg-white/90 p-8 text-brand-800 shadow-[0_20px_0_rgba(255,176,103,0.2)]">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-200/40 blur-3xl" />
          <div className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-risk-neutral/20 blur-3xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-brand-500">
            Casper Ignite · Tokenize Startup Equity
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Girişiminizi
            <span className="text-risk-danger"> token’laştırarak </span> kitle fonlayın.
          </h1>
          <p className="mt-4 text-base text-brand-700">
            Casper Ignite, hisse benzeri tokenlar çıkararak projelerin yatırımcılarla buluştuğu
            pazar yeridir. Cüzdanınızı bağlayın, proje açın ve token’larınızı listeleyin.
          </p>
          <ul className="mt-6 grid gap-3 text-sm text-brand-700 md:grid-cols-2">
            {[
              "Otomatik CEP-18 token ihraç",
              "Sahiplik yüzdesiyle bağlanan arz",
              "Casper Wallet ile güvenli imzalama",
              "Gerçek zamanlı piyasa değeri ve likidite",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 rounded-full bg-brand-50/70 px-4 py-2 shadow-sm">
                <span role="img" aria-hidden>
                  ⭐️
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4" id="wallet">
          <CasperWalletPanel />
        </div>
        <div className="hidden flex-col gap-4 xl:flex">
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border-4 border-brand-200 bg-gradient-to-br from-brand-100 via-brand-50 to-white text-center text-brand-800 shadow-cartoon-pop">
            <div className="absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.9),transparent_55%)]" />
            <div className="relative z-10 space-y-3 p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.4em] text-brand-500">
                Ignite Özeti
              </p>
              <p className="text-5xl font-bold text-brand-700">{initialFeed.items.length}</p>
              <p className="text-sm text-brand-600">Aktif tokenize girişim</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-brand-500">Piyasa Değeri</p>
                  <p className="text-2xl font-semibold text-brand-800">
                    ${totalMarketCap.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/80 p-3 shadow-sm">
                  <p className="text-xs uppercase tracking-wide text-brand-500">Yatırımcı</p>
                  <p className="text-2xl font-semibold text-brand-800">
                    {totalInvestors.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border-4 border-brand-200 bg-white/90 p-6 text-center text-brand-700 shadow-cartoon-pop">
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-risk-neutral/20" />
            <div className="absolute -left-4 -bottom-4 h-16 w-16 rounded-full bg-brand-200/30" />
            <div className="relative z-10 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-500">
                Proje Oluştur
              </p>
              <p className="text-4xl">🪙</p>
              <p className="text-sm text-brand-600">
                Token arzını, sahiplik yüzdesini ve kurucu adresini belirleyerek dakikalar içinde
                kitle fonlama sayfanı yayınla.
              </p>
              <Link
                className="inline-flex rounded-full border border-brand-400 px-4 py-2 text-sm font-semibold text-brand-700"
                href="/projects/new"
              >
                Proje Oluştur
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ProjectFeed initial={initialFeed} />
    </div>
  );
}
