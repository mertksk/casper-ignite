'use client';

import { useState, useEffect } from 'react';
import { useCasperWallet } from '@/hooks/useCasperWallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type OrderSide = 'BUY' | 'SELL';

type OrderBookLevel = {
  price: number;
  quantity: number;
};

type OrderBook = {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid: number;
  bestAsk: number;
  spread: number;
  spreadPercent: number;
};

type Trade = {
  id: string;
  tokenAmount: number;
  pricePerToken: number;
  totalValue: number;
  createdAt: string;
  buyerWallet: string;
  sellerWallet: string;
};

type UserOrder = {
  id: string;
  side: OrderSide;
  tokenAmount: number;
  pricePerToken: number;
  filledAmount: number;
  status: string;
  createdAt: string;
};

interface TradingInterfaceProps {
  projectId: string;
  tokenSymbol: string;
  currentPrice: number;
}

export function TradingInterface({ projectId, tokenSymbol, currentPrice }: TradingInterfaceProps) {
  const { isConnected, publicKey, connect } = useCasperWallet();
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [userOrders, setUserOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Order form state
  const [side, setSide] = useState<OrderSide>('BUY');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadOrderBook();
    loadRecentTrades();
    if (isConnected && publicKey) {
      loadUserOrders();
    }

    // Refresh every 10 seconds
    const interval = setInterval(() => {
      loadOrderBook();
      loadRecentTrades();
      if (isConnected && publicKey) {
        loadUserOrders();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [projectId, isConnected, publicKey]);

  const loadOrderBook = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/orders`);
      const data = await response.json();
      setOrderBook(data);
    } catch (error) {
      console.error('Error loading order book:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentTrades = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/trades?limit=20`);
      const { trades } = await response.json();
      setRecentTrades(trades);
    } catch (error) {
      console.error('Error loading trades:', error);
    }
  };

  const loadUserOrders = async () => {
    if (!publicKey) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/orders?wallet=${publicKey}`);
      const { orders } = await response.json();
      setUserOrders(orders);
    } catch (error) {
      console.error('Error loading user orders:', error);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) {
      await connect();
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: publicKey,
          side,
          tokenAmount: parseFloat(amount),
          pricePerToken: parseFloat(price),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create order');
      }

      // Reset form
      setAmount('');
      setPrice('');

      // Reload data
      await Promise.all([loadOrderBook(), loadRecentTrades(), loadUserOrders()]);
    } catch (error) {
      console.error('Error creating order:', error);
      alert(error instanceof Error ? error.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!publicKey) return;

    try {
      const response = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to cancel order');
      }

      await loadUserOrders();
      await loadOrderBook();
    } catch (error) {
      console.error('Error cancelling order:', error);
      alert('Failed to cancel order');
    }
  };

  const totalValue = amount && price ? parseFloat(amount) * parseFloat(price) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Order Book */}
      <Card className="border-2 border-brand-200 lg:col-span-1">
        <CardHeader className="border-b border-brand-100">
          <h3 className="font-semibold text-brand-800">Order Book</h3>
          {orderBook && (
            <div className="mt-2 text-xs text-brand-600">
              Spread: {orderBook.spread.toFixed(4)} CSPR ({orderBook.spreadPercent.toFixed(2)}%)
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {/* Asks (Sell orders) */}
          <div className="max-h-48 overflow-y-auto">
            {orderBook?.asks.slice(0, 10).reverse().map((level, idx) => (
              <div
                key={`ask-${idx}`}
                className="flex justify-between border-b border-red-50 bg-red-50/30 px-4 py-2 text-xs hover:bg-red-50"
              >
                <span className="font-mono text-red-700">{level.price.toFixed(4)}</span>
                <span className="text-brand-700">{level.quantity.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Current Price */}
          <div className="border-y-2 border-brand-200 bg-brand-50 px-4 py-3 text-center">
            <div className="text-xl font-bold text-brand-800">
              {currentPrice.toFixed(4)} <span className="text-sm font-normal">CSPR</span>
            </div>
            <div className="text-xs text-brand-600">Last Price</div>
          </div>

          {/* Bids (Buy orders) */}
          <div className="max-h-48 overflow-y-auto">
            {orderBook?.bids.slice(0, 10).map((level, idx) => (
              <div
                key={`bid-${idx}`}
                className="flex justify-between border-b border-green-50 bg-green-50/30 px-4 py-2 text-xs hover:bg-green-50"
              >
                <span className="font-mono text-green-700">{level.price.toFixed(4)}</span>
                <span className="text-brand-700">{level.quantity.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Order Form & Recent Trades */}
      <div className="space-y-6 lg:col-span-2">
        {/* Order Form */}
        <Card className="border-2 border-brand-200">
          <CardHeader className="border-b border-brand-100">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-brand-800">Place Order</h3>
              {!isConnected && (
                <Badge variant="outline" className="text-xs">
                  Connect wallet to trade
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmitOrder} className="space-y-4">
              {/* Buy/Sell Toggle */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setSide('BUY')}
                  className={`flex-1 rounded-full ${
                    side === 'BUY'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Buy
                </Button>
                <Button
                  type="button"
                  onClick={() => setSide('SELL')}
                  className={`flex-1 rounded-full ${
                    side === 'SELL'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Sell
                </Button>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-700">
                  Amount ({tokenSymbol})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="rounded-lg"
                  required
                />
              </div>

              {/* Price */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-brand-700">Price (CSPR)</label>
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.0000"
                  className="rounded-lg"
                  required
                />
              </div>

              {/* Total */}
              <div className="rounded-lg border-2 border-brand-200 bg-brand-50 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-brand-700">Total:</span>
                  <span className="font-semibold text-brand-900">
                    {totalValue.toFixed(4)} CSPR
                  </span>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={submitting || !amount || !price}
                className={`w-full rounded-full py-6 text-white ${
                  side === 'BUY'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting
                  ? 'Creating Order...'
                  : isConnected
                  ? `${side} ${tokenSymbol}`
                  : 'Connect Wallet'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card className="border-2 border-brand-200">
          <CardHeader className="border-b border-brand-100">
            <h3 className="font-semibold text-brand-800">Recent Trades</h3>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              {recentTrades.length === 0 ? (
                <div className="py-8 text-center text-sm text-brand-600">No trades yet</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="border-b border-brand-100 bg-brand-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-brand-700">Price</th>
                      <th className="px-4 py-2 text-right font-medium text-brand-700">Amount</th>
                      <th className="px-4 py-2 text-right font-medium text-brand-700">Total</th>
                      <th className="px-4 py-2 text-right font-medium text-brand-700">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-brand-50 hover:bg-brand-50">
                        <td className="px-4 py-2 font-mono text-brand-900">
                          {trade.pricePerToken.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 text-right text-brand-700">
                          {trade.tokenAmount.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-brand-700">
                          {trade.totalValue.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 text-right text-brand-600">
                          {new Date(trade.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* User's Open Orders */}
        {isConnected && userOrders.length > 0 && (
          <Card className="border-2 border-brand-200">
            <CardHeader className="border-b border-brand-100">
              <h3 className="font-semibold text-brand-800">Your Orders</h3>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-brand-100 bg-brand-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-brand-700">Type</th>
                      <th className="px-4 py-2 text-right font-medium text-brand-700">Price</th>
                      <th className="px-4 py-2 text-right font-medium text-brand-700">Amount</th>
                      <th className="px-4 py-2 text-right font-medium text-brand-700">Filled</th>
                      <th className="px-4 py-2 text-right font-medium text-brand-700">Status</th>
                      <th className="px-4 py-2 text-right font-medium text-brand-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userOrders.map((order) => (
                      <tr key={order.id} className="border-b border-brand-50 hover:bg-brand-50">
                        <td className="px-4 py-2">
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              order.side === 'BUY' ? 'border-green-500 text-green-700' : 'border-red-500 text-red-700'
                            }`}
                          >
                            {order.side}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{order.pricePerToken.toFixed(4)}</td>
                        <td className="px-4 py-2 text-right">{order.tokenAmount.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">{order.filledAmount.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">
                          <Badge variant="outline" className="text-xs">
                            {order.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {(order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelOrder(order.id)}
                              className="h-6 text-xs text-red-600 hover:text-red-700"
                            >
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
