"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PriceDataPoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PriceChartProps {
  data: PriceDataPoint[];
  tokenSymbol: string;
}

const timeframes = [
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "ALL", value: "all" },
];

export function PriceChart({ data, tokenSymbol }: PriceChartProps) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("1d");

  if (!data || data.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border-2 border-brand-200 bg-white">
        <p className="text-brand-600">No price data available</p>
      </div>
    );
  }

  // Calculate price change
  const firstPrice = data[0]?.open || 0;
  const lastPrice = data[data.length - 1]?.close || 0;
  const priceChange = lastPrice - firstPrice;
  const priceChangePercent = firstPrice > 0 ? ((priceChange / firstPrice) * 100) : 0;
  const isPositive = priceChange >= 0;

  // Format data for charts
  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    price: point.close,
    volume: point.volume,
  }));

  return (
    <div className="space-y-4 rounded-xl border-2 border-brand-200 bg-white p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-brand-800">{tokenSymbol}/CSPR</h3>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-brand-800">
              {lastPrice.toFixed(4)} CSPR
            </span>
            <span
              className={`text-sm font-semibold ${
                isPositive ? "text-green-600" : "text-red-600"
              }`}
            >
              {isPositive ? "+" : ""}
              {priceChange.toFixed(4)} ({isPositive ? "+" : ""}
              {priceChangePercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Timeframe Selector */}
        <div className="flex gap-1 rounded-lg bg-brand-100 p-1">
          {timeframes.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setSelectedTimeframe(tf.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedTimeframe === tf.value
                  ? "bg-white text-brand-800 shadow-sm"
                  : "text-brand-600 hover:text-brand-800"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={isPositive ? "#10b981" : "#ef4444"}
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor={isPositive ? "#10b981" : "#ef4444"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
            />
            <YAxis
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#e2e8f0" }}
              tickFormatter={(value) => value.toFixed(4)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "none",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
              labelStyle={{ color: "#cbd5e1", fontSize: "12px" }}
              itemStyle={{ color: "#fff", fontSize: "14px", fontWeight: "600" }}
              formatter={(value: number) => [`${value.toFixed(4)} CSPR`, "Price"]}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={isPositive ? "#10b981" : "#ef4444"}
              strokeWidth={2}
              fill="url(#colorPrice)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Volume Chart */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-500">
          Volume
        </p>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" hide />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#cbd5e1", fontSize: "12px" }}
                itemStyle={{ color: "#fff", fontSize: "14px", fontWeight: "600" }}
                formatter={(value: number) => [value.toLocaleString(), "Volume"]}
              />
              <Bar dataKey="volume" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="grid grid-cols-4 gap-4 border-t border-brand-100 pt-4">
        <div>
          <p className="text-xs text-brand-500">24h High</p>
          <p className="text-sm font-bold text-brand-800">
            {Math.max(...data.map((d) => d.high)).toFixed(4)}
          </p>
        </div>
        <div>
          <p className="text-xs text-brand-500">24h Low</p>
          <p className="text-sm font-bold text-brand-800">
            {Math.min(...data.map((d) => d.low)).toFixed(4)}
          </p>
        </div>
        <div>
          <p className="text-xs text-brand-500">24h Volume</p>
          <p className="text-sm font-bold text-brand-800">
            {data.reduce((sum, d) => sum + d.volume, 0).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-brand-500">Trades</p>
          <p className="text-sm font-bold text-brand-800">{data.length}</p>
        </div>
      </div>
    </div>
  );
}
