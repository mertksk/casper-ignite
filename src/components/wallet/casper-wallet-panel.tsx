'use client';

import { useState } from "react";
import { useCasperWallet } from "@/hooks/useCasperWallet";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";

export function CasperWalletPanel() {
  const { isInstalled, isConnected, publicKey, loading, connect, disconnect } = useCasperWallet();
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    try {
      await connect();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Wallet connection error:", err);
      setError(`Failed to connect Casper Wallet: ${errorMessage}`);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await disconnect();
    } catch (err) {
      console.error("Wallet disconnect error:", err);
      setError("Casper Wallet could not be disconnected.");
    }
  };

  const abbreviateKey = (key: string) => {
    if (key.length <= 16) return key;
    return `${key.slice(0, 8)}...${key.slice(-8)}`;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      );
    }

    if (isInstalled === false) {
      return (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
            <span className="text-3xl">💼</span>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-brand-800">Casper Wallet not found</p>
            <p className="text-sm text-brand-600">
              Install the browser extension to continue
            </p>
          </div>
          <a
            href="https://casperwallet.io/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-brand-700"
          >
            Download Casper Wallet
            <span>→</span>
          </a>
        </div>
      );
    }

    if (isConnected && publicKey) {
      return (
        <div className="space-y-4">
          <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-600">
                <span className="text-xl">✓</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-900">Connection Active</p>
                <p className="truncate text-xs font-mono text-green-700">
                  {abbreviateKey(publicKey)}
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-brand-600">
              Your wallet is connected. You can now create projects and execute token flows.
            </p>
            <Button
              variant="outline"
              className="w-full rounded-full border-brand-300 text-brand-700 hover:bg-brand-50"
              onClick={handleDisconnect}
            >
              Disconnect
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-brand-200 bg-brand-50/50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-200">
            <span className="text-2xl">🔗</span>
          </div>
          <p className="mb-2 text-sm font-semibold text-brand-800">
            Wallet connection required
          </p>
          <p className="text-xs text-brand-600">
            Connect Casper Wallet to create projects and handle token transactions.
          </p>
        </div>
        <Button
          className="w-full rounded-full bg-brand-600 py-6 text-base font-semibold text-white shadow-lg transition-all hover:bg-brand-700 hover:shadow-xl"
          onClick={handleConnect}
        >
          Connect with Casper Wallet
        </Button>
      </div>
    );
  };

  return (
    <Card className="border-2 border-brand-200 bg-white shadow-lg">
      <CardHeader className="border-b border-brand-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100">
            <span className="text-xl">👻</span>
          </div>
          <div>
            <p className="text-lg font-bold text-brand-800">Casper Wallet</p>
            <p className="text-xs text-brand-500">Secure blockchain connection</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {renderContent()}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
