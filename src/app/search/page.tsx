import { Metadata } from "next";
import { ProjectSearch } from "@/components/search/project-search";

export const metadata: Metadata = {
  title: "Arama",
  description: "Tokenize projeleri isim, simge veya kurucu bilgisiyle ara.",
};

export default function SearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Arama</h1>
        <p className="text-muted-foreground">
          Projeleri isim, token simgesi veya kurucu cüzdanına göre bul.
        </p>
      </div>
      <ProjectSearch />
    </div>
  );
}
