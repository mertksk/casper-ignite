"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useCasperWallet } from "@/hooks/useCasperWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrendingUp, TrendingDown, Loader2, Wallet, ExternalLink } from "lucide-react";
import { CLPublicKey } from "casper-js-sdk";
import {
  getAmmStatus,
  getBuyQuote,
  getSellQuote,
  buyTokens,
  sellTokens,
  getTokenBalance,
  type AmmStatus,
  type BuyQuote,
  type SellQuote,
} from "@/lib/amm-client";

interface AMMTradingInterfaceProps {
  tokenSymbol?: string;
  onTradeComplete?: (deployHash: string, type: "buy" | "sell") => void;
}

type TradeMode = "BUY" | "SELL";

interface TradeMessage {
  type: "success" | "error" | "info";
  text: string;
}

export function AMMTradingInterface({
  tokenSymbol = "TOKEN",
  onTradeComplete,
}: AMMTradingInterfaceProps) {
  const { isConnected, publicKey, connect } = useCasperWallet();

  // Compute account hash from public key
  const accountHash = useMemo(() => {
    if (!publicKey) return null;
    try {
      const pk = CLPublicKey.fromHex(publicKey);
      // accountHash returns AccountHash (Uint8Array) in SDK v2
      const hash = pk.toAccountHash();
      return `account-hash-${Buffer.from(hash).toString("hex")}`;
    } catch {
      return null;
    }
  }, [publicKey]);

  // State
  const [mode, setMode] = useState<TradeMode>("BUY");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(5); // 5% default slippage
  const [ammStatus, setAmmStatus] = useState<AmmStatus | null>(null);
  const [buyQuote, setBuyQuote] = useState<BuyQuote | null>(null);
  const [sellQuote, setSellQuote] = useState<SellQuote | null>(null);
  const [userBalance, setUserBalance] = useState<string>("0");
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<TradeMessage | null>(null);
  const [deployHash, setDeployHash] = useState<string | null>(null);

  // Fetch AMM status
  const fetchAmmStatus = useCallback(async () => {
    try {
      const status = await getAmmStatus();
      setAmmStatus(status);
    } catch (error) {
      console.error("Error fetching AMM status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch user balance
  const fetchUserBalance = useCallback(async () => {
    if (!accountHash) return;
    try {
      const balance = await getTokenBalance(accountHash);
      setUserBalance(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
    }
  }, [accountHash]);

  // Initial load
  useEffect(() => {
    fetchAmmStatus();
    const interval = setInterval(fetchAmmStatus, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchAmmStatus]);

  // Fetch balance when wallet connects
  useEffect(() => {
    if (accountHash) {
      fetchUserBalance();
    }
  }, [accountHash, fetchUserBalance]);

  // Get quote when amount changes
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !ammStatus?.configured) {
      setBuyQuote(null);
      setSellQuote(null);
      return;
    }

    const getQuote = async () => {
      setQuoteLoading(true);
      try {
        // Convert token amount to motes (9 decimals)
        const tokenMotes = Math.floor(parseFloat(amount) * 1_000_000_000).toString();

        if (mode === "BUY") {
          const quote = await getBuyQuote(tokenMotes);
          setBuyQuote(quote);
          setSellQuote(null);
        } else {
          const quote = await getSellQuote(tokenMotes);
          setSellQuote(quote);
          setBuyQuote(null);
        }
      } catch (err) {
        console.error("Error getting quote:", err);
        setBuyQuote(null);
        setSellQuote(null);
      } finally {
        setQuoteLoading(false);
      }
    };

    const debounce = setTimeout(getQuote, 300);
    return () => clearTimeout(debounce);
  }, [amount, mode, ammStatus?.configured]);

  // Handle trade submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setDeployHash(null);

    if (!isConnected || !publicKey) {
      try {
        await connect();
        return;
      } catch {
        setMessage({ type: "error", text: "Please connect your wallet" });
        return;
      }
    }

    if (!amount || parseFloat(amount) <= 0) {
      setMessage({ type: "error", text: "Please enter a valid amount" });
      return;
    }

    setSubmitting(true);
    setMessage({ type: "info", text: "Preparing transaction..." });

    try {
      const tokenMotes = Math.floor(parseFloat(amount) * 1_000_000_000).toString();

      if (mode === "BUY") {
        if (!buyQuote) {
          throw new Error("No quote available");
        }

        // Add slippage to max cost
        const maxCostCSPR = buyQuote.estimatedCost.cspr * (1 + slippage / 100);

        setMessage({ type: "info", text: "Please sign the transaction in your wallet..." });

        const result = await buyTokens({
          tokenAmount: tokenMotes,
          maxCostCSPR,
          senderPublicKey: publicKey,
        });

        if (result.success) {
          setDeployHash(result.deployHash);
          setMessage({
            type: "success",
            text: `Buy order submitted! Purchasing ${amount} ${tokenSymbol} for ~${buyQuote.estimatedCost.cspr.toFixed(4)} CSPR`,
          });
          setAmount("");
          setBuyQuote(null);
          onTradeComplete?.(result.deployHash, "buy");

          // Refresh balances after a delay
          setTimeout(() => {
            fetchAmmStatus();
            fetchUserBalance();
          }, 5000);
        } else {
          throw new Error(result.error || "Transaction failed");
        }
      } else {
        if (!sellQuote) {
          throw new Error("No quote available");
        }

        // Subtract slippage from min proceeds
        const minProceedsCSPR = sellQuote.estimatedProceeds.cspr * (1 - slippage / 100);

        setMessage({ type: "info", text: "Please sign the transaction in your wallet..." });

        const result = await sellTokens({
          tokenAmount: tokenMotes,
          minProceedsCSPR,
          senderPublicKey: publicKey,
        });

        if (result.success) {
          setDeployHash(result.deployHash);
          setMessage({
            type: "success",
            text: `Sell order submitted! Selling ${amount} ${tokenSymbol} for ~${sellQuote.estimatedProceeds.cspr.toFixed(4)} CSPR`,
          });
          setAmount("");
          setSellQuote(null);
          onTradeComplete?.(result.deployHash, "sell");

          // Refresh balances after a delay
          setTimeout(() => {
            fetchAmmStatus();
            fetchUserBalance();
          }, 5000);
        } else {
          throw new Error(result.error || "Transaction failed");
        }
      }
    } catch (error) {
      console.error("Trade error:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Transaction failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Format balance display
  const formattedBalance = (Number(userBalance) / 1_000_000_000).toFixed(4);
  const quote = mode === "BUY" ? buyQuote : sellQuote;
  const estimatedAmount = mode === "BUY"
    ? buyQuote?.estimatedCost.cspr
    : sellQuote?.estimatedProceeds.cspr;

  if (loading) {
    return (
      <Card className="border-4 border-brand-100 bg-white shadow-cartoon-pop">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
        </CardContent>
      </Card>
    );
  }

  if (!ammStatus?.configured) {
    return (
      <Card className="border-4 border-brand-100 bg-white shadow-cartoon-pop">
        <CardContent className="py-12 text-center">
          <p className="text-brand-600">AMM contract not configured</p>
          <p className="mt-2 text-sm text-brand-500">
            The on-chain AMM is not yet deployed or configured.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Trading Card */}
      <Card className="border-4 border-brand-100 bg-white shadow-cartoon-pop">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-brand-900">Trade {tokenSymbol}</h3>
            <div className="text-right">
              <p className="text-xs text-brand-500">Current Price</p>
              <p className="text-lg font-bold text-brand-900">
                {ammStatus.currentPrice?.cspr.toFixed(6) ?? "0"} CSPR
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Wallet Balance */}
          {isConnected && (
            <div className="flex items-center justify-between rounded-xl bg-brand-50 px-4 py-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-brand-500" />
                <span className="text-sm text-brand-600">Your Balance</span>
              </div>
              <span className="font-bold text-brand-900">
                {formattedBalance} {tokenSymbol}
              </span>
            </div>
          )}

          {/* Buy/Sell Toggle */}
          <div className="grid grid-cols-2 gap-2 rounded-full bg-brand-50 p-1">
            <button
              onClick={() => setMode("BUY")}
              className={`rounded-full py-2 font-semibold transition-all ${mode === "BUY"
                  ? "bg-green-500 text-white shadow-cartoon-sm"
                  : "text-brand-600 hover:bg-white"
                }`}
            >
              <TrendingUp className="mr-1 inline h-4 w-4" />
              Buy
            </button>
            <button
              onClick={() => setMode("SELL")}
              className={`rounded-full py-2 font-semibold transition-all ${mode === "SELL"
                  ? "bg-red-500 text-white shadow-cartoon-sm"
                  : "text-brand-600 hover:bg-white"
                }`}
            >
              <TrendingDown className="mr-1 inline h-4 w-4" />
              Sell
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Amount Input */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-brand-700">
                  Amount ({tokenSymbol})
                </label>
                {mode === "SELL" && isConnected && (
                  <button
                    type="button"
                    onClick={() => setAmount(formattedBalance)}
                    className="text-xs text-brand-500 hover:text-brand-700"
                  >
                    Max
                  </button>
                )}
              </div>
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

            {/* Slippage Setting */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-500">Slippage:</span>
              {[1, 3, 5, 10].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setSlippage(pct)}
                  className={`rounded-lg px-2 py-1 text-xs ${slippage === pct
                      ? "bg-brand-200 text-brand-800"
                      : "bg-brand-50 text-brand-600 hover:bg-brand-100"
                    }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            {/* Quote Preview */}
            {quoteLoading && (
              <div className="rounded-2xl bg-brand-50 p-4 text-center">
                <Loader2 className="inline h-5 w-5 animate-spin text-brand-500" />
                <p className="mt-2 text-sm text-brand-600">Calculating...</p>
              </div>
            )}

            {quote && !quoteLoading && (
              <div className="space-y-2 rounded-2xl bg-brand-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-600">
                    You {mode === "BUY" ? "pay" : "receive"}
                  </span>
                  <span className="font-bold text-brand-900">
                    {estimatedAmount?.toFixed(4)} CSPR
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-600">Price per token</span>
                  <span className="font-semibold text-brand-800">
                    {quote.pricePerToken.toFixed(6)} CSPR
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-brand-600">Price impact</span>
                  <span
                    className={`font-semibold ${Math.abs(quote.priceImpact) > 5
                        ? "text-orange-600"
                        : "text-green-600"
                      }`}
                  >
                    {quote.priceImpact.toFixed(2)}%
                  </span>
                </div>
                {mode === "BUY" && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-brand-600">Max cost (with slippage)</span>
                    <span className="font-semibold text-brand-800">
                      {((buyQuote?.estimatedCost.cspr ?? 0) * (1 + slippage / 100)).toFixed(4)} CSPR
                    </span>
                  </div>
                )}
                {mode === "SELL" && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-brand-600">Min proceeds (with slippage)</span>
                    <span className="font-semibold text-brand-800">
                      {((sellQuote?.estimatedProceeds.cspr ?? 0) * (1 - slippage / 100)).toFixed(4)} CSPR
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!quote || submitting || quoteLoading}
              className={`w-full rounded-full py-6 text-lg font-bold shadow-cartoon-pop transition-all disabled:opacity-50 ${mode === "BUY"
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-red-500 text-white hover:bg-red-600"
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
                  : message.type === "error"
                    ? "bg-red-100 text-red-800"
                    : "bg-blue-100 text-blue-800"
                }`}
            >
              <p>{message.text}</p>
              {deployHash && message.type === "success" && (
                <a
                  href={`https://testnet.cspr.live/deploy/${deployHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1 text-xs underline hover:opacity-80"
                >
                  View on Casper Explorer
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-4 border-brand-100 bg-gradient-to-br from-brand-50 to-white shadow-cartoon-sm">
        <CardHeader>
          <h3 className="text-xl font-bold text-brand-900">On-Chain AMM</h3>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* AMM Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-xs text-brand-500">Total Supply</p>
              <p className="text-lg font-bold text-brand-900">
                {ammStatus.totalSupply
                  ? (Number(ammStatus.totalSupply) / 1_000_000_000).toFixed(2)
                  : "0"}{" "}
                {tokenSymbol}
              </p>
            </div>
            <div className="rounded-xl bg-white p-3 shadow-sm">
              <p className="text-xs text-brand-500">Reserve</p>
              <p className="text-lg font-bold text-brand-900">
                {ammStatus.reserve?.cspr.toFixed(2) ?? "0"} CSPR
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                1
              </div>
              <div>
                <p className="font-semibold text-brand-900">Fully On-Chain</p>
                <p className="text-sm text-brand-600">
                  All trades execute directly on the Casper blockchain via smart contract.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                2
              </div>
              <div>
                <p className="font-semibold text-brand-900">Bonding Curve</p>
                <p className="text-sm text-brand-600">
                  Linear bonding curve ensures price increases with each purchase.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">
                3
              </div>
              <div>
                <p className="font-semibold text-brand-900">Wallet Signing</p>
                <p className="text-sm text-brand-600">
                  You sign transactions with your wallet. Funds never leave your control.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-3">
            <p className="text-xs font-semibold text-green-800">
              Contract: {ammStatus.contractHash?.slice(0, 20)}...
            </p>
            <p className="mt-1 text-xs text-green-700">
              Network: {ammStatus.network || "casper-test"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
