"use client";

import { useState, useEffect } from "react";
import { ProjectSummary } from "@/types/api";
import { TopInvestorsGrid } from "@/components/projects/top-investors-grid";
import { ProjectsListView } from "@/components/projects/projects-list-view";
import { AdvancedFilters } from "@/components/projects/advanced-filters";
import { Pagination } from "@/components/projects/pagination";
import { Loader2 } from "lucide-react";

const PROJECTS_PER_PAGE = 20;
const TOP_INVESTORS_COUNT = 6;

export default function ProjectsPage() {
  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [marketLevel, setMarketLevel] = useState("ALL");
  const [sortBy, setSortBy] = useState("marketCap");
  const [currentPage, setCurrentPage] = useState(1);

  // Data state
  const [topProjects, setTopProjects] = useState<ProjectSummary[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectSummary[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    async function fetchProjects() {
      setIsLoading(true);
      setError(null);

      try {
        // Build query params
        const params = new URLSearchParams({
          sort: sortBy,
          limit: String(PROJECTS_PER_PAGE + TOP_INVESTORS_COUNT), // Fetch extra for top projects
        });

        if (searchQuery) params.set("search", searchQuery);
        if (category !== "ALL") params.set("category", category);
        if (marketLevel !== "ALL") params.set("marketLevel", marketLevel);

        // Fetch projects
        const response = await fetch(`/api/projects?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to fetch projects");
        }

        const data = await response.json();
        const projects = data.items || [];

        // Split into top investors (first 6 with highest market cap) and rest
        // Since we're already sorting by marketCap on the backend, just slice
        if (sortBy === "marketCap" && currentPage === 1 && searchQuery === "" && category === "ALL" && marketLevel === "ALL") {
          // Only show featured section on first page with no filters
          setTopProjects(projects.slice(0, TOP_INVESTORS_COUNT));
          setAllProjects(projects.slice(TOP_INVESTORS_COUNT));
        } else {
          setTopProjects([]);
          setAllProjects(projects);
        }

        // For pagination, we'll use client-side slicing for simplicity
        // In production, you'd want proper cursor-based or offset-based pagination
        setTotalProjects(projects.length);
      } catch (err) {
        console.error("Error fetching projects:", err);
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjects();
  }, [searchQuery, category, marketLevel, sortBy, currentPage]);

  // Calculate pagination
  const totalPages = Math.ceil((totalProjects - topProjects.length) / PROJECTS_PER_PAGE);
  const startIndex = (currentPage - 1) * PROJECTS_PER_PAGE;
  const endIndex = startIndex + PROJECTS_PER_PAGE;
  const paginatedProjects = allProjects.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, category, marketLevel, sortBy]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setCategory("ALL");
    setMarketLevel("ALL");
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-brand-900 sm:text-5xl">
            Explore Projects
          </h1>
          <p className="mt-2 text-lg text-brand-600">
            Discover and invest in innovative blockchain projects on Casper
          </p>
        </div>

        {/* Filters */}
        <div className="mb-8 rounded-2xl border-4 border-brand-100 bg-white p-6 shadow-cartoon-sm">
          <AdvancedFilters
            searchQuery={searchQuery}
            category={category}
            marketLevel={marketLevel}
            sortBy={sortBy}
            onSearchChange={setSearchQuery}
            onCategoryChange={setCategory}
            onMarketLevelChange={setMarketLevel}
            onSortChange={setSortBy}
            onClearFilters={handleClearFilters}
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-brand-500" />
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="rounded-2xl border-4 border-red-200 bg-red-50 p-8 text-center">
            <p className="text-lg font-semibold text-red-700">Error loading projects</p>
            <p className="mt-2 text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Content */}
        {!isLoading && !error && (
          <>
            {/* Top Investors Grid - Only show on first page with no filters */}
            {topProjects.length > 0 && <TopInvestorsGrid projects={topProjects} />}

            {/* All Projects List */}
            <ProjectsListView projects={paginatedProjects} />

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
