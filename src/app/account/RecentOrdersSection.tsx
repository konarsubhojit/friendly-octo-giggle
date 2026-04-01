"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, orderStatusVariant } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import {
  countOrderUnits,
  summarizeOrderProducts,
} from "@/features/orders/services/order-summary";

interface RecentOrderItem {
  readonly quantity: number;
  readonly product?: { readonly name: string } | null;
  readonly variation?: { readonly name: string } | null;
}

interface RecentOrder {
  readonly id: string;
  readonly status: string;
  readonly createdAt: string;
  readonly items: readonly RecentOrderItem[];
}

interface OrdersResponse {
  readonly orders?: RecentOrder[];
  readonly data?: {
    readonly orders?: RecentOrder[];
  };
}

function RecentOrderRow({ order }: Readonly<{ order: RecentOrder }>) {
  const itemCount = countOrderUnits(order.items);
  const productSummary = summarizeOrderProducts(order.items);

  return (
    <Link
      href={`/orders/${order.id}`}
      className="block rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/70 px-4 py-4 transition hover:border-[var(--accent-rose)]/40 hover:shadow-warm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant={orderStatusVariant(order.status)} size="sm">
              {order.status}
            </Badge>
            <span className="text-xs text-[var(--text-muted)]">
              {new Date(order.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-[var(--foreground)] sm:text-base">
            {productSummary}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span className="text-[var(--text-muted)]">Order #{order.id}</span>
          </div>
        </div>
        <svg
          className="mt-1 h-4 w-4 flex-shrink-0 text-[var(--text-muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}

export function RecentOrdersSection() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOrders() {
      try {
        const response = await fetch("/api/orders?limit=3");
        const payload = (await response.json()) as OrdersResponse;

        if (!response.ok) {
          throw new Error("Failed to load recent orders");
        }

        const nextOrders = payload.data?.orders ?? payload.orders ?? [];
        if (isMounted) {
          setOrders(nextOrders);
        }
      } catch {
        if (isMounted) {
          setError("We couldn’t load your recent orders right now.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOrders().catch(() => {
      /* errors handled inside loadOrders */
    });

    return () => {
      isMounted = false;
    };
  }, []);

  function renderOrdersContent() {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      );
    }
    if (orders.length === 0) {
      return (
        <EmptyState
          title="No orders yet"
          message="Once you place an order, the latest updates will appear here."
          ctaText="Browse Products"
          ctaHref="/shop"
          className="py-4"
        />
      );
    }
    return (
      <div className="space-y-3">
        {orders.map((order) => (
          <RecentOrderRow key={order.id} order={order} />
        ))}
      </div>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[var(--foreground)]">
            Recent Orders
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Quick status checks with compact product summaries.
          </p>
        </div>
        <Link
          href="/orders"
          className="text-sm font-semibold text-[var(--accent-rose)] transition hover:text-[var(--accent-warm)]"
        >
          View all
        </Link>
      </div>

      {error ? <AlertBanner message={error} variant="error" /> : null}

      {renderOrdersContent()}
    </Card>
  );
}
