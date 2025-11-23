'use client';

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCasperWallet } from "@/hooks/useCasperWallet";
import { Button } from "../ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/projects", label: "Projects" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/projects/new", label: "Create Project" },
  { href: "/search", label: "Search" },
];

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Casper Ignite";

export function SiteHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { isConnected, publicKey, connect, disconnect } = useCasperWallet();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      await connect();
    } catch (error) {
      console.error("Connection error:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const scrollToWallet = () => {
    if (pathname !== "/") {
      router.push("/");
      setTimeout(() => {
        const element = document.getElementById("wallet");
        if (element) {
          const headerOffset = 100;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });
        }
      }, 500);
    } else {
      const element = document.getElementById("wallet");
      if (element) {
        const headerOffset = 100;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });
      }
    }
  };

  const abbreviateKey = (key: string | null | undefined) => {
    if (!key || typeof key !== 'string') return '';
    if (key.length <= 16) return key;
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setShowDropdown(false);
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-brand-200/60 bg-white/70 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-20 w-full max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <Link href="/" className="group relative font-semibold text-2xl text-brand-700">
          <span className="absolute -left-3 -top-3 h-8 w-8 rounded-full bg-brand-200/80 text-center text-xl leading-8 text-brand-700 shadow-cartoon-pop">
            ✨
          </span>
          <span className="ml-6">
            {APP_NAME}
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

        {/* Wallet Status */}
        {isConnected && publicKey ? (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 rounded-full border-2 border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-800 shadow-sm transition-all hover:bg-green-100"
            >
              <span className="h-2 w-2 rounded-full bg-green-600" />
              <span className="hidden font-mono sm:inline">{abbreviateKey(publicKey)}</span>
              <span className="inline sm:hidden">Connected</span>
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-xl border-2 border-brand-200 bg-white shadow-xl">
                  <div className="border-b border-brand-100 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">
                      Connected Wallet
                    </p>
                    <p className="mt-1 truncate font-mono text-sm text-brand-800">
                      {publicKey ? String(publicKey) : ''}
                    </p>
                  </div>
                  <div className="p-2">
                    <button
                      onClick={scrollToWallet}
                      className="w-full rounded-lg px-4 py-2 text-left text-sm text-brand-700 transition-colors hover:bg-brand-50"
                    >
                      Wallet Panel
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="w-full rounded-lg px-4 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            size="sm"
            className="rounded-full bg-brand-500 text-white shadow-cartoon-pop hover:bg-brand-600"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </Button>
        )}
      </div>
    </header>
  );
}
