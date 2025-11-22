import { publicRuntime } from "@/lib/client-config";

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-200 bg-gradient-to-r from-brand-100/70 via-white to-brand-50/80">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-2 px-4 py-8 text-sm text-brand-700 sm:px-6 lg:px-10 md:flex-row md:items-center md:justify-between">
        <p className="flex items-center gap-2 font-semibold">
          <span role="img" aria-hidden>
            🛡️
          </span>
          © {new Date().getFullYear()} {publicRuntime.appName}
        </p>
        <p className="text-xs uppercase tracking-[0.3em] text-brand-500">
          Source: On-chain data · Deterministic rules
        </p>
      </div>
    </footer>
  );
}
