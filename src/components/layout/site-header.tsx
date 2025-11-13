import Link from "next/link";
import { publicRuntime } from "@/lib/config";
import { Button } from "../ui/button";

const links = [
  { href: "/", label: "Projeler" },
  { href: "/projects/new", label: "Proje Oluştur" },
  { href: "/search", label: "Ara" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-brand-200/60 bg-white/70 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-20 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group relative font-semibold text-2xl text-brand-700">
          <span className="absolute -left-3 -top-3 h-8 w-8 rounded-full bg-brand-200/80 text-center text-xl leading-8 text-brand-700 shadow-cartoon-pop">
            ✨
          </span>
          <span className="ml-6">
            {publicRuntime.appName}
            <span className="block text-xs font-normal uppercase tracking-[0.35em] text-brand-400">
              Casper Ignite
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-4 text-sm font-medium md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full bg-white/70 px-4 py-2 text-brand-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-100/80"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Button
          asChild
          size="sm"
          className="rounded-full bg-brand-500 text-white shadow-cartoon-pop"
        >
          <Link href="/#wallet">Cüzdan Bağla</Link>
        </Button>
      </div>
    </header>
  );
}
