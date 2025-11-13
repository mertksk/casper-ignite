import type { Metadata } from "next";
import { Baloo_2, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { publicRuntime } from "@/lib/config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-casual",
});

export const metadata: Metadata = {
  title: {
    default: `${publicRuntime.appName} · Casper tabanlı kitle fonlaması`,
    template: `%s · ${publicRuntime.appName}`,
  },
  description:
    "Casper Ignite, girişimlerin token tabanlı hisse tekliflerini listeleyip yatırımcılarla buluşturduğu, dijital menkul kıymet portalıdır.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className="bg-background">
      <body className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} antialiased`}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-10 sm:px-6 lg:px-10">
              {children}
            </main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
