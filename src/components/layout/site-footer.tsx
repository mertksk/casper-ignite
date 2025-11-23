import { publicRuntime } from "@/lib/client-config";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-brand-200 bg-gradient-to-r from-brand-100/70 via-white to-brand-50/80">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6 lg:px-10">
        {/* Links Section */}
        <div className="mb-6 grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-800">
              Platform
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/projects" className="text-brand-600 transition-colors hover:text-brand-800">
                  Browse Projects
                </Link>
              </li>
              <li>
                <Link href="/projects/new" className="text-brand-600 transition-colors hover:text-brand-800">
                  Launch Project
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-brand-600 transition-colors hover:text-brand-800">
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-800">
              Resources
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about/risk" className="text-brand-600 transition-colors hover:text-brand-800">
                  Risk Disclaimer
                </Link>
              </li>
              <li>
                <a
                  href="https://testnet.cspr.live"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 transition-colors hover:text-brand-800"
                >
                  Casper Explorer ↗
                </a>
              </li>
              <li>
                <a
                  href="https://testnet.cspr.live/tools/faucet"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 transition-colors hover:text-brand-800"
                >
                  Testnet Faucet ↗
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand-800">
              Network
            </h3>
            <div className="space-y-2 text-sm text-brand-600">
              <p>
                <strong>Chain:</strong> Casper Testnet
              </p>
              <p>
                <strong>Standard:</strong> CEP-18
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Live
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-2 border-t border-brand-200 pt-6 text-sm text-brand-700 md:flex-row md:items-center md:justify-between">
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
      </div>
    </footer>
  );
}
