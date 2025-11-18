import { useMemo } from "react";
import type { ProjectFeedFilters } from "./project-feed";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

type Props = {
  filters: ProjectFeedFilters;
  onChange: (filters: ProjectFeedFilters) => void;
  isLoading?: boolean;
};

export function ProjectFilterControls({ filters, onChange, isLoading }: Props) {
  const badgeText = useMemo(() => {
    if (filters.sort === "marketCap") return "Sort: Market Cap";
    return "Sort: Newest";
  }, [filters.sort]);

  return (
    <Card className="grid gap-6 border-4 border-dashed border-brand-200/70 bg-white/80 p-6 shadow-cartoon-pop md:grid-cols-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">
          Search
        </p>
        <Input
          className="mt-3 rounded-2xl border-brand-200 bg-white shadow-sm"
          placeholder="Project name or token"
          value={filters.search ?? ""}
          onChange={(event) =>
            onChange({
              ...filters,
              search: event.target.value || undefined,
            })
          }
        />
        <p className="mt-2 text-xs text-brand-600">
          Find crowdfunding listings by name or ticker symbol.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">
          Sorting
        </p>
        <div className="mt-3 flex gap-3">
          <Button
            variant={filters.sort === "createdAt" ? "default" : "outline"}
            className="rounded-full"
            onClick={() =>
              onChange({
                ...filters,
                sort: "createdAt",
              })
            }
          >
            Newest
          </Button>
          <Button
            variant={filters.sort === "marketCap" ? "default" : "outline"}
            className="rounded-full"
            onClick={() =>
              onChange({
                ...filters,
                sort: "marketCap",
              })
            }
          >
            Market cap
          </Button>
        </div>
        <p className="mt-2 inline-flex rounded-full bg-brand-100/80 px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">
          {badgeText}
        </p>
      </div>

      <div className="flex items-end justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="rounded-full border-brand-400 text-brand-700 hover:bg-brand-100"
          onClick={() => onChange({ sort: "createdAt" })}
        >
          Reset
        </Button>
      </div>
    </Card>
  );
}
