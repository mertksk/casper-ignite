'use client';

import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader } from "../ui/card";

type Props = {
  projectId: string;
};

export function ProjectOrderForm({ projectId }: Props) {
  const [wallet, setWallet] = useState("");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [tokenAmount, setTokenAmount] = useState(0);
  const [pricePerToken, setPricePerToken] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`/api/projects/${projectId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet,
        side,
        tokenAmount,
        pricePerToken,
      }),
    });
    if (!response.ok) {
      setMessage("Emir kaydedilirken hata oluştu.");
      return;
    }
    setMessage("Emir sisteme alındı. Likidite metriği güncellendi.");
    setWallet("");
    setTokenAmount(0);
    setPricePerToken(0);
  }

  return (
    <Card className="border-4 border-brand-100 bg-white/90 shadow-cartoon-pop">
      <CardHeader>
        <p className="text-base font-semibold text-brand-700">Token Al / Sat</p>
        <p className="text-sm text-brand-600">
          Market emri girerek piyasa değeri ve likidite hesaplarının güncellenmesine katkı sağla.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            placeholder="Cüzdan adresi"
            value={wallet}
            onChange={(event) => setWallet(event.target.value)}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant={side === "BUY" ? "default" : "outline"}
              className="flex-1 rounded-full"
              onClick={() => setSide("BUY")}
            >
              Alış
            </Button>
            <Button
              type="button"
              variant={side === "SELL" ? "default" : "outline"}
              className="flex-1 rounded-full"
              onClick={() => setSide("SELL")}
            >
              Satış
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              type="number"
              placeholder="Token miktarı"
              value={tokenAmount}
              onChange={(event) => setTokenAmount(Number(event.target.value))}
            />
            <Input
              type="number"
              placeholder="Token başı fiyat ($)"
              value={pricePerToken}
              onChange={(event) => setPricePerToken(Number(event.target.value))}
            />
          </div>
          <Button
            type="submit"
            className="rounded-full bg-brand-500 text-white shadow-cartoon-pop hover:bg-brand-400"
          >
            Emir Gönder
          </Button>
          {message && <p className="text-sm font-semibold text-brand-600">{message}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
