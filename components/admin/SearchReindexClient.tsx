"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import toast from "react-hot-toast";

type ReindexTarget = "products" | "orders" | "all";

interface ReindexResult {
  products?: number;
  orders?: number;
}

interface SearchReindexClientProps {
  readonly configured: boolean;
}

const TARGET_OPTIONS: {
  value: ReindexTarget;
  label: string;
  description: string;
}[] = [
  {
    value: "products",
    label: "Products",
    description: "Rebuild the products search index from the database",
  },
  {
    value: "orders",
    label: "Orders",
    description: "Rebuild the orders search index from the database",
  },
  {
    value: "all",
    label: "All Indexes",
    description: "Rebuild both products and orders indexes",
  },
];

const SearchReindexClient = ({ configured }: SearchReindexClientProps) => {
  const [loading, setLoading] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ReindexTarget | null>(
    null,
  );
  const [lastResult, setLastResult] = useState<ReindexResult | null>(null);

  if (!configured) {
    return (
      <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20 p-6">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
              Search Not Configured
            </h3>
            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Upstash Search environment variables are missing. Set{" "}
              <code className="text-xs bg-yellow-100 dark:bg-yellow-900/40 px-1 py-0.5 rounded">
                UPSTASH_SEARCH_REST_URL
              </code>{" "}
              and{" "}
              <code className="text-xs bg-yellow-100 dark:bg-yellow-900/40 px-1 py-0.5 rounded">
                UPSTASH_SEARCH_REST_TOKEN
              </code>{" "}
              to enable search indexing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleReindex = async (target: ReindexTarget) => {
    setConfirmTarget(null);
    setLoading(true);
    setLastResult(null);

    try {
      const res = await fetch("/api/admin/search/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Reindex failed (${res.status})`);
      }

      const data = await res.json();
      const result = data.data?.reindexed ?? data.reindexed ?? {};
      setLastResult(result);

      const parts: string[] = [];
      if (result.products != null) parts.push(`${result.products} products`);
      if (result.orders != null) parts.push(`${result.orders} orders`);
      toast.success(`Reindexed ${parts.join(" and ")}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Reindex failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TARGET_OPTIONS.map(({ value, label, description }) => (
          <div
            key={value}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 flex flex-col"
          >
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {label}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 flex-1">
              {description}
            </p>

            {lastResult && value !== "all" && lastResult[value] != null && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-3">
                Last run: {lastResult[value]} records indexed
              </p>
            )}
            {lastResult &&
              value === "all" &&
              (lastResult.products != null || lastResult.orders != null) && (
                <p className="text-xs text-green-600 dark:text-green-400 mb-3">
                  Last run: {lastResult.products ?? 0} products,{" "}
                  {lastResult.orders ?? 0} orders indexed
                </p>
              )}

            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmTarget(value)}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md transition"
            >
              {loading ? "Reindexing…" : `Reindex ${label}`}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          How it works
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
          <li>
            Reindexing resets the selected index and rebuilds it from the
            database.
          </li>
          <li>
            Products and orders are automatically indexed on create/update
            during normal operations.
          </li>
          <li>
            Use a full reindex after bulk imports, data migrations, or if search
            results seem stale.
          </li>
          <li>
            The process runs server-side and may take a few seconds for large
            datasets.
          </li>
        </ul>
      </div>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title="Confirm Reindex"
        message={
          confirmTarget === "all"
            ? "This will reset and rebuild both the products and orders search indexes. Existing search results will be temporarily unavailable during the process. Continue?"
            : `This will reset and rebuild the ${confirmTarget} search index. Existing ${confirmTarget} search results will be temporarily unavailable during the process. Continue?`
        }
        confirmLabel="Reindex"
        cancelLabel="Cancel"
        variant="warning"
        loading={loading}
        onConfirm={() => confirmTarget && handleReindex(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
      />
    </>
  );
};
export default SearchReindexClient;
