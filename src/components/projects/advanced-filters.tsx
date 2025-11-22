"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

const CATEGORIES = [
  { value: "ALL", label: "All Categories" },
  { value: "DEFI", label: "DeFi" },
  { value: "GAMING", label: "Gaming" },
  { value: "NFT", label: "NFT" },
  { value: "DAO", label: "DAO" },
  { value: "INFRASTRUCTURE", label: "Infrastructure" },
  { value: "METAVERSE", label: "Metaverse" },
  { value: "SOCIAL", label: "Social" },
  { value: "MARKETPLACE", label: "Marketplace" },
  { value: "TOOLS", label: "Tools" },
  { value: "OTHER", label: "Other" },
] as const;

const MARKET_LEVELS = [
  { value: "ALL", label: "All Markets" },
  { value: "APPROVED", label: "Approved" },
  { value: "PRE_MARKET", label: "Pre-Market" },
] as const;

const SORT_OPTIONS = [
  { value: "createdAt", label: "Newest First" },
  { value: "marketCap", label: "Highest Market Cap" },
] as const;

interface AdvancedFiltersProps {
  searchQuery: string;
  category: string;
  marketLevel: string;
  sortBy: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMarketLevelChange: (value: string) => void;
  onSortChange: (value: string) => void;
  onClearFilters: () => void;
}

export function AdvancedFilters({
  searchQuery,
  category,
  marketLevel,
  sortBy,
  onSearchChange,
  onCategoryChange,
  onMarketLevelChange,
  onSortChange,
  onClearFilters,
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters = category !== "ALL" || marketLevel !== "ALL" || searchQuery !== "";

  return (
    <div className="space-y-4">
      {/* Search and Toggle Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-400" />
          <Input
            type="text"
            placeholder="Search projects by name, symbol, or description..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10 rounded-full border-2 border-brand-200 focus:border-brand-400 focus:ring-brand-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-4 py-2 rounded-full border-2 border-brand-200 bg-white text-brand-700 focus:border-brand-400 focus:ring-brand-400 focus:outline-none cursor-pointer min-w-[180px]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Toggle Filters Button (Mobile) */}
        <Button
          variant="outline"
          onClick={() => setIsExpanded(!isExpanded)}
          className="sm:hidden rounded-full border-2 border-brand-200 hover:bg-brand-50"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 flex h-2 w-2 rounded-full bg-brand-500" />
          )}
        </Button>
      </div>

      {/* Advanced Filters (Always visible on desktop, toggle on mobile) */}
      <div className={`space-y-4 ${isExpanded ? "block" : "hidden sm:block"}`}>
        {/* Category Filter Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-brand-700">Category</label>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="text-xs text-brand-600 hover:text-brand-700 h-auto p-1"
              >
                Clear all filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => onCategoryChange(cat.value)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all
                    border-2
                    ${
                      isActive
                        ? "bg-brand-500 text-white border-brand-500 shadow-cartoon-sm"
                        : "bg-white text-brand-700 border-brand-200 hover:border-brand-400 hover:bg-brand-50"
                    }
                  `}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Market Level Filter */}
        <div>
          <label className="text-sm font-medium text-brand-700 mb-2 block">
            Market Level
          </label>
          <div className="flex flex-wrap gap-2">
            {MARKET_LEVELS.map((level) => {
              const isActive = marketLevel === level.value;
              return (
                <button
                  key={level.value}
                  onClick={() => onMarketLevelChange(level.value)}
                  className={`
                    px-4 py-2 rounded-full text-sm font-medium transition-all
                    border-2
                    ${
                      isActive
                        ? "bg-brand-500 text-white border-brand-500 shadow-cartoon-sm"
                        : "bg-white text-brand-700 border-brand-200 hover:border-brand-400 hover:bg-brand-50"
                    }
                  `}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
