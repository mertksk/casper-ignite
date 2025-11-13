'use client';

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

type SearchResult = {
  id: string;
  name: string;
  symbol: string;
  contractHash: string;
};

async function runSearch(term: string) {
  const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
  if (!response.ok) {
    throw new Error("Arama sorgusu reddedildi.");
  }
  return (await response.json()) as SearchResult[];
}

export function TokenSearch() {
  const [term, setTerm] = useState("");
  const [queryTerm, setQueryTerm] = useState("");

  const query = useQuery({
    queryKey: ["search", queryTerm],
    queryFn: () => runSearch(queryTerm),
    enabled: queryTerm.length > 1,
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setQueryTerm(term);
  };

  return (
    <div className="space-y-4 rounded-3xl border-4 border-brand-100 bg-white/90 p-6 shadow-cartoon-pop">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          className="rounded-2xl border-brand-200 bg-white shadow-sm"
          placeholder="İsim / Simge / Kontrat hash"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
        />
        <Button
          type="submit"
          disabled={term.length < 2}
          className="rounded-full bg-brand-500 text-white shadow-cartoon-pop hover:bg-brand-400"
        >
          Ara
        </Button>
      </form>

      {query.isFetching && <p className="text-sm text-brand-600">Aranıyor…</p>}

      {query.data && (
        <ul className="space-y-2">
          {query.data.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-brand-200/70 p-3 text-sm text-brand-600">
              Sonuç bulunamadı.
            </li>
          ) : (
            query.data.map((token) => (
              <li key={token.id} className="rounded-2xl border border-brand-100 bg-brand-50/60 p-3 shadow-sm">
                <p className="font-semibold text-brand-700">
                  {token.name} · {token.symbol}
                </p>
                <p className="text-xs text-brand-500">{token.contractHash}</p>
                <Link className="text-sm font-semibold text-brand-700 underline" href={`/token/${token.id}`}>
                  Detaya git
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
