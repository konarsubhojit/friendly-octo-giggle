"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import toast from "react-hot-toast";

type ReindexTarget = "products" | "orders";

interface ReindexResult {
  products?: number;
  orders?: number;
}

interface SearchReindexClientProps {
  readonly productsConfigured: boolean;
  readonly ordersConfigured: boolean;
}

const TARGET_OPTIONS: {
  value: ReindexTarget;
  label: string;
  description: string;
  configuredProp: keyof SearchReindexClientProps;
  confirmMessage: string;
}[] = [
  {
    value: "products",
    label: "Products",
    description: "Rebuild the products search index from the database",
    configuredProp: "productsConfigured",
    confirmMessage:
      "This will reset and rebuild the products search index. Existing product search results will be temporarily unavailable during the process. Continue?",
  },
  {
    value: "orders",
    label: "Orders",
    description: "Rebuild the orders search index from the database",
    configuredProp: "ordersConfigured",
    confirmMessage: "This will rebuild the orders search index. Continue?",
  },
];

export default function SearchReindexClient({
  productsConfigured,
  ordersConfigured,
}: SearchReindexClientProps) {
  const [loading, setLoading] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ReindexTarget | null>(
    null,
  );
  const [lastResult, setLastResult] = useState<ReindexResult | null>(null);

  if (!productsConfigured && !ordersConfigured) {
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
              Search is not configured. Contact your system administrator to
              enable search capabilities.
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
      toast.success(
        parts.length > 0
          ? `Reindexed ${parts.join(" and ")}`
          : "Reindex completed",
      );
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
        {TARGET_OPTIONS.map(({ value, label, description, configuredProp }) => {
          let isConfigured = ordersConfigured;

          if (configuredProp === "productsConfigured") {
            isConfigured = productsConfigured;
          }

          let buttonLabel = `${label} unavailable`;

          if (loading) {
            buttonLabel = "Reindexing…";
          } else if (isConfigured) {
            buttonLabel = `Reindex ${label}`;
          }

          return (
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

              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Status: {isConfigured ? "configured" : "missing config"}
              </p>

              {lastResult?.[value] != null && (
                <p className="text-xs text-green-600 dark:text-green-400 mb-3">
                  Last run: {lastResult[value]} records indexed
                </p>
              )}

              <button
                type="button"
                disabled={loading || !isConfigured}
                onClick={() => setConfirmTarget(value)}
                className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-md transition"
              >
                {buttonLabel}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
          Information
        </h3>
        <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
          <li>
            Product reindexing rebuilds search from current catalogue data.
          </li>
          <li>Products are indexed automatically on create and update.</li>
          <li>Order reindexing rebuilds the search index from all orders.</li>
          <li>
            Reindex after bulk imports or if search results appear incomplete.
          </li>
          <li>Reindexing may take time for large datasets.</li>
        </ul>
      </div>

      <ConfirmDialog
        isOpen={confirmTarget !== null}
        title="Confirm Reindex"
        message={
          TARGET_OPTIONS.find((option) => option.value === confirmTarget)
            ?.confirmMessage ?? "Continue?"
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
}
