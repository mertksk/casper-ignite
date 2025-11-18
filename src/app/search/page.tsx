import { Metadata } from "next";
import { ProjectSearch } from "@/components/search/project-search";

export const metadata: Metadata = {
  title: "Search",
  description: "Find tokenized projects by name, symbol, or founder details.",
};

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Search</h1>
        <p className="text-muted-foreground">
          Discover projects by name, token symbol, or founder wallet address.
        </p>
      </div>
      <ProjectSearch />
    </div>
  );
}
