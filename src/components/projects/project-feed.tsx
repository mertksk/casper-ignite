'use client';

import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ProjectListResponse } from "@/types/api";
import { ProjectCard } from "./project-card";
import { ProjectFilterControls } from "./project-filters";
import { Button } from "../ui/button";

export type ProjectFeedFilters = {
  search?: string;
  sort?: "createdAt" | "marketCap";
};

async function fetchProjects(filters: ProjectFeedFilters, cursor?: string | null) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.sort) params.set("sort", filters.sort);
  if (cursor) params.set("cursor", cursor);
  params.set("limit", "12");

  const response = await fetch(`/api/projects?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Projeler alınamadı.");
  }
  return (await response.json()) as ProjectListResponse;
}

export function ProjectFeed({ initial }: { initial?: ProjectListResponse }) {
  const [filters, setFilters] = useState<ProjectFeedFilters>({ sort: "createdAt" });

  const query = useInfiniteQuery({
    queryKey: ["projects", filters],
    queryFn: ({ pageParam }) => fetchProjects(filters, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: initial
      ? {
          pages: [initial],
          pageParams: [null],
        }
      : undefined,
    initialPageParam: null as string | null,
    staleTime: 30_000,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data]
  );

  return (
    <section className="space-y-6">
      <ProjectFilterControls filters={filters} onChange={setFilters} isLoading={query.isFetching} />

      {query.isFetching && !query.isFetchingNextPage && items.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {["a", "b", "c", "d", "e", "f"].map((placeholder) => (
            <div key={placeholder} className="h-48 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-center">
        {query.hasNextPage ? (
          <Button
            variant="secondary"
            onClick={() => query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? "Yükleniyor..." : "Daha fazla göster"}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            {query.isFetching ? "Güncelleniyor..." : "Listelenecek başka proje yok."}
          </p>
        )}
      </div>
    </section>
  );
}
