'use client';

import { useState } from "react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader } from "../ui/card";

type CasperWalletApi = {
  requestConnection: () => Promise<{ publicKey: string }>;
  signMessage: (payload: { message: string }) => Promise<{ signature: string }>;
};

declare global {
  interface Window {
    casperlabsHelper?: CasperWalletApi;
  }
}

export function CasperWalletPanel() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ensureWallet() {
    if (typeof window === "undefined" || !window.casperlabsHelper) {
      setError("Casper cüzdan eklentisi tespit edilemedi.");
      return null;
    }
    setError(null);
    return window.casperlabsHelper;
  }

  const handleConnect = async () => {
    const wallet = await ensureWallet();
    if (!wallet) return;
    try {
      const result = await wallet.requestConnection();
      setPublicKey(result.publicKey);
    } catch {
      setError("Bağlantı isteği reddedildi.");
    }
  };

  const handleSign = async () => {
    const wallet = await ensureWallet();
    if (!wallet) return;
    try {
      const response = await wallet.signMessage({
        message: "Casper Ignite bağlantı testi",
      });
      setSignature(response.signature);
    } catch {
      setError("İmza isteği reddedildi.");
    }
  };

  return (
    <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
      <CardHeader>
        <p className="text-base font-semibold text-brand-700">
          <span role="img" aria-hidden className="mr-2">
            👻
          </span>
          Casper Cüzdanı
        </p>
        <p className="text-sm text-muted-foreground">
          Ignite üzerinde proje oluşturmak ve token ihraç etmek için Casper Wallet ile bağlantı kurun
          ve imza yetkinizi doğrulayın.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button className="rounded-full bg-brand-500 text-white shadow-cartoon-pop hover:bg-brand-400" onClick={handleConnect}>
            Bağlan
          </Button>
          <Button variant="outline" className="rounded-full border-brand-400 text-brand-700 hover:bg-brand-100" onClick={handleSign}>
            İmza Testi
          </Button>
        </div>
        {publicKey && (
          <p className="text-xs font-mono text-muted-foreground break-all">
            Public key: {publicKey}
          </p>
        )}
        {signature && (
          <p className="text-xs font-mono text-muted-foreground break-all">
            İmza: {signature}
          </p>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
