"use client";

import { useState, useEffect, useCallback } from "react";
import { useCasperWallet } from "@/hooks/useCasperWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Loader2, Wallet } from "lucide-react";

interface SimpleTradingInterfaceProps {
  projectId: string;
  tokenSymbol: string;
  currentPrice: number;
}

type TradeMode = "BUY" | "SELL";

interface Quote {
  tokenAmount: number;
  cost?: number; // For buy
  payout?: number; // For sell
  pricePerToken: number;
  currentPrice: number;
  newPrice: number;
  priceImpact: number;
}

export function SimpleTradingInterface({
  projectId,
  tokenSymbol,
  currentPrice: initialPrice,
}: SimpleTradingInterfaceProps) {
  const { isConnected, publicKey, connect } = useCasperWallet();
  const [mode, setMode] = useState<TradeMode>("BUY");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [currentPrice, setCurrentPrice] = useState(initialPrice);
  const [deployHash, setDeployHash] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string>("0");
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Fetch user's token balance
  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    setBalanceLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/balance?wallet=${publicKey}`);
      if (response.ok) {
        const data = await response.json();
        setTokenBalance(data.formatted || "0");
      }
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setBalanceLoading(false);
    }
  }, [publicKey, projectId]);

  // Fetch balance when wallet connects or after trade
  useEffect(() => {
    if (isConnected && publicKey) {
      fetchBalance();
    }
  }, [isConnected, publicKey, fetchBalance]);

  // Fetch current price every 5 seconds
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/bonding-curve`);
        if (response.ok) {
          const data = await response.json();
          setCurrentPrice(data.currentPrice);
        }
      } catch (error) {
        console.error("Error fetching price:", error);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Get quote when amount changes
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }

    const getQuote = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/bonding-curve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: mode.toLowerCase(),
            tokenAmount: parseFloat(amount),
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to get quote");
        }

        const data = await response.json();
        setQuote(data);
      } catch (err) {
        console.error("Error getting quote:", err);
        setQuote(null);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(getQuote, 500);
    return () => clearTimeout(debounce);
  }, [amount, mode, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setDeployHash(null);

    if (!isConnected) {
      try {
        await connect();
      } catch {
        setMessage({ type: "error", text: "Please connect your wallet" });
        return;
      }
    }

    if (!quote || !publicKey) {
      setMessage({ type: "error", text: "Please enter a valid amount" });
      return;
    }

    setSubmitting(true);

    try {
      const endpoint = mode === "BUY" ? "buy" : "sell";

      // Generate idempotency key to prevent duplicate trades
      const idempotencyKey = `${mode}-${projectId}-${publicKey}-${Date.now()}`;

      setMessage({
        type: "success",
        text: mode === "BUY"
          ? "Buying tokens... Platform will send tokens to your wallet..."
          : "Selling tokens... Platform will send CSPR to your wallet..."
      });

      const response = await fetch(`/api/projects/${projectId}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey,
          tokenAmount: parseFloat(amount),
          maxSlippage: 10, // 10% max slippage tolerance
          idempotencyKey,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `${mode === "BUY" ? "Buy" : "Sell"} failed`);
      }

      const data = await response.json();

      setMessage({
        type: "success",
        text: data.message || `Transaction completed successfully!`
      });

      if (data.deployHash) {
        setDeployHash(data.deployHash);
      }

      setAmount("");
      setQuote(null);

      // Refresh price and balance
      const priceResponse = await fetch(`/api/projects/${projectId}/bonding-curve`);
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        setCurrentPrice(priceData.currentPrice);
      }
      fetchBalance(); // Refresh user's token balance
    } catch (error) {
      console.error("Transaction error:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Transaction failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalCost = quote ? (mode === "BUY" ? quote.cost : quote.payout) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Trading Card */}
      <Card className="border-4 border-brand-100 bg-white shadow-cartoon-pop">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-brand-900">Trade {tokenSymbol}</h3>
            <div className="text-right">
              <p className="text-xs text-brand-500">Price</p>
              <p className="text-lg font-bold text-brand-900">
                {currentPrice.toFixed(6)} CSPR
              </p>
            </div>
          </div>
          {/* User Balance Display */}
          {isConnected && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-brand-500" />
                <span className="text-sm text-brand-600">Your Balance</span>
              </div>
              <span className="font-semibold text-brand-800">
                {balanceLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `${tokenBalance} ${tokenSymbol}`
                )}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Buy/Sell Toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-full bg-brand-50 p-1">
            <button
              onClick={() => setMode("BUY")}
              className={`rounded-full py-2 font-semibold transition-all ${mode === "BUY"
                ? "bg-green-500 text-white shadow-cartoon-sm"
                : "text-brand-600 hover:bg-white"
                }`}
            >
              <TrendingUp className="inline h-4 w-4 mr-1" />
              Buy
            </button>
            <button
              onClick={() => setMode("SELL")}
              className={`rounded-full py-2 font-semibold transition-all ${mode === "SELL"
                ? "bg-red-500 text-white shadow-cartoon-sm"
                : "text-brand-600 hover:bg-white"
                }`}
            >
              <TrendingDown className="inline h-4 w-4 mr-1" />
              Sell
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount Input */}
            <div>
              <label className="mb-2 block text-sm font-medium text-brand-700">
                Amount ({tokenSymbol})
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="any"
                min="0"
                className="rounded-2xl border-2 border-brand-200 text-lg focus:border-brand-400"
              />
            </div>

            {/* Quote Preview */}
            {loading && (
              <div className="rounded-2xl bg-brand-50 p-4 text-center">
                <Loader2 className="inline h-5 w-5 animate-spin text-brand-500" />
                <p className="mt-2 text-sm text-brand-600">Calculating...</p>
              </div>
            )}

            {quote && !loading && (
              <div className="space-y-2 rounded-2xl bg-brand-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-600">You {mode === "BUY" ? "pay" : "receive"}</span>
                  <span className="font-bold text-brand-900">
                    {totalCost?.toFixed(4)} CSPR
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-600">Price per token</span>
                  <span className="font-semibold text-brand-800">
                    ${quote.pricePerToken.toFixed(6)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-600">Price impact</span>
                  <span
                    className={`font-semibold ${quote.priceImpact > 5
                      ? "text-orange-600"
                      : "text-green-600"
                      }`}
                  >
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-600">New price</span>
                  <span className="font-semibold text-brand-800">
                    ${quote.newPrice.toFixed(6)}
                  </span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!quote || submitting || loading}
              className={`w-full rounded-full py-6 text-lg font-bold shadow-cartoon-pop transition-all disabled:opacity-50 ${mode === "BUY"
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-red-500 hover:bg-red-600 text-white"
                }`}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processing...
                </>
              ) : !isConnected ? (
                "Connect Wallet"
              ) : (
                `${mode === "BUY" ? "Buy" : "Sell"} ${tokenSymbol}`
              )}
            </Button>
          </form>

          {/* Message */}
          {message && (
            <div
              className={`rounded-2xl p-3 text-sm font-semibold ${message.type === "success"
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
                }`}
            >
              <p>{message.text}</p>
              {deployHash && message.type === "success" && (
                <a
                  href={`https://testnet.cspr.live/deploy/${deployHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-xs underline hover:text-green-900"
                >
                  View on Casper Explorer →
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-4 border-brand-100 bg-gradient-to-br from-brand-50 to-white shadow-cartoon-sm">
        <CardHeader>
          <h3 className="text-xl font-bold text-brand-900">How it Works</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                1
              </div>
              <div>
                <p className="font-semibold text-brand-900">Instant Liquidity</p>
                <p className="text-sm text-brand-600">
                  Buy or sell tokens instantly using our bonding curve. No need to wait for orders to match.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                2
              </div>
              <div>
                <p className="font-semibold text-brand-900">Dynamic Pricing</p>
                <p className="text-sm text-brand-600">
                  Price automatically adjusts based on supply and demand. More buyers = higher price.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                3
              </div>
              <div>
                <p className="font-semibold text-brand-900">Fair & Transparent</p>
                <p className="text-sm text-brand-600">
                  Everyone gets the same price based on the curve. No front-running or manipulation.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-blue-50 border-2 border-blue-200 p-3">
            <p className="text-xs font-semibold text-blue-800">
              💎 Live on Casper Testnet! All transactions are real blockchain transfers.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
