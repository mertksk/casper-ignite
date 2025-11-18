"use client";

import { useEffect, useState } from "react";

interface LiveStatsProps {
  totalProjects: number;
  totalMarketCap: number;
  totalInvestors: number;
}

function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const duration = 2000; // 2 seconds
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(current + increment, value);
      setDisplayValue(Math.floor(current));

      if (step >= steps || current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

export function LiveStats({ totalProjects, totalMarketCap, totalInvestors }: LiveStatsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {/* Total Projects */}
      <div className="group relative overflow-hidden rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-white to-brand-50 p-8 shadow-lg transition-all hover:shadow-xl">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-200/30 blur-2xl transition-transform group-hover:scale-110" />
        <div className="relative space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-500">
            Active Projects
          </p>
          <p className="text-5xl font-bold text-brand-800">
            <AnimatedCounter value={totalProjects} />
          </p>
          <p className="text-xs text-brand-600">Tokenized ventures</p>
        </div>
      </div>

      {/* Total Market Cap */}
      <div className="group relative overflow-hidden rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-white to-green-50 p-8 shadow-lg transition-all hover:shadow-xl">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-green-200/30 blur-2xl transition-transform group-hover:scale-110" />
        <div className="relative space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-green-600">
            Total Market Cap
          </p>
          <p className="text-5xl font-bold text-brand-800">
            <AnimatedCounter value={totalMarketCap} prefix="$" />
          </p>
          <p className="text-xs text-brand-600">Across all projects</p>
        </div>
      </div>

      {/* Total Investors */}
      <div className="group relative overflow-hidden rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-white to-purple-50 p-8 shadow-lg transition-all hover:shadow-xl">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-purple-200/30 blur-2xl transition-transform group-hover:scale-110" />
        <div className="relative space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-purple-600">
            Total Investors
          </p>
          <p className="text-5xl font-bold text-brand-800">
            <AnimatedCounter value={totalInvestors} />
          </p>
          <p className="text-xs text-brand-600">Across the platform</p>
        </div>
      </div>
    </div>
  );
}
