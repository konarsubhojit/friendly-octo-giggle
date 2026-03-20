"use client";

import { useRouter } from "next/navigation";
import { Search } from "@upstash/search";
import { SearchBar } from "@upstash/search-ui";
import "@upstash/search-ui/dist/index.css";

// ─── Search client (readonly token — safe for client) ────

const searchUrl = process.env.NEXT_PUBLIC_UPSTASH_SEARCH_REST_URL;
const searchToken = process.env.NEXT_PUBLIC_UPSTASH_SEARCH_REST_READONLY_TOKEN;

type ProductContent = Record<string, unknown> & {
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
};

// Lazily initialized — avoids constructing the client at import time
let _cached: {
  search: (opts: {
    query: string;
    limit: number;
    reranking: boolean;
  }) => Promise<Array<{ id: string; score: number; content: ProductContent }>>;
} | null = null;

function getIndex() {
  if (_cached) return _cached;
  if (!searchUrl || !searchToken) return null;
  const client = new Search({ url: searchUrl, token: searchToken });
  _cached = client.index<ProductContent>("products");
  return _cached;
}

// ─── Component ───────────────────────────────────────────

export default function ProductSearch() {
  const router = useRouter();
  const index = getIndex();

  if (!index) return null;

  return (
    <SearchBar.Dialog>
      <SearchBar.DialogTrigger
        className="w-full max-w-[220px] sm:max-w-xs border border-[var(--border-warm)] bg-[var(--surface)] text-[var(--text-secondary)] rounded-full px-4 py-1.5 text-sm placeholder:text-[var(--text-muted)] hover:border-[var(--accent-rose)] transition-colors cursor-pointer"
        placeholder="Search products..."
      />

      <SearchBar.DialogContent className="bg-[var(--surface)] border border-[var(--border-warm)] shadow-warm-lg rounded-2xl">
        <SearchBar.Input
          className="border-b border-[var(--border-warm)] bg-transparent text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:ring-[var(--accent-rose)]"
          placeholder="Search products..."
        />
        <SearchBar.Results
          searchFn={async (query) => {
            try {
              return await index.search({ query, limit: 8, reranking: true });
            } catch (error) {
              // Prevent search errors from breaking the UI
              console.error("ProductSearch: search failed", error);
              return [];
            }
          }}
        >
          {(result) => (
            <SearchBar.Result
              value={result.id}
              key={result.id}
              onSelect={() => router.push(`/products/${result.id}`)}
              className="hover:bg-[var(--accent-blush)] rounded-lg transition-colors cursor-pointer"
            >
              <SearchBar.ResultIcon>
                <svg
                  className="w-5 h-5 text-[var(--accent-rose)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </SearchBar.ResultIcon>

              <SearchBar.ResultContent>
                <SearchBar.ResultTitle
                  className="font-medium text-[var(--foreground)]"
                  highlightClassName="decoration-[var(--accent-rose)] text-[var(--accent-rose)]"
                >
                  {result.content.name}
                </SearchBar.ResultTitle>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {result.content.category}
                </p>
              </SearchBar.ResultContent>
            </SearchBar.Result>
          )}
        </SearchBar.Results>
      </SearchBar.DialogContent>
    </SearchBar.Dialog>
  );
}
