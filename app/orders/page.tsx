"use client";

import { useSession } from "next-auth/react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useCursorPagination } from "@/lib/hooks";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthRequiredState } from "@/components/ui/AuthRequiredState";
import { Card } from "@/components/ui/Card";
import { GradientHeading } from "@/components/ui/GradientHeading";
import { OrderListCard } from "@/components/orders/OrderListCard";
import { OrdersSearchForm } from "@/components/orders/OrdersSearchForm";
import { CursorPaginationBar } from "@/components/ui/CursorPaginationBar";

interface OrderSummary {
  id: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  items: Array<{
    quantity: number;
    product?: { name: string; image: string } | null;
    variation?: { id: string; name: string; priceModifier: number } | null;
  }>;
}

const OrdersEmptyState = ({ search }: { readonly search: string }) => (
  <Card className="p-12 text-center">
    <EmptyState
      icon={
        <svg
          className="w-20 h-20 text-[var(--text-muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      }
      title={search ? "No matching orders" : "No orders yet"}
      message={
        search
          ? "Try a different search term."
          : "Start shopping and your orders will appear here."
      }
      ctaText={search ? undefined : "Browse Products"}
      ctaHref={search ? undefined : "/shop"}
      className="py-0"
    />
  </Card>
);

export default function OrdersPage() {
  const { data: session, status: authStatus } = useSession();
  const { formatPrice } = useCurrency();

  const {
    items: orders,
    loading,
    error,
    search,
    searchInput,
    hasMore,
    cursorHistoryLength,
    currentPage,
    setSearchInput,
    handleSearch,
    handleNext,
    handlePrev,
    handleRefresh,
  } = useCursorPagination<OrderSummary>({
    url: "/api/orders",
    dataKey: "orders",
    enabled: authStatus === "authenticated",
  });

  const isInitialLoading =
    authStatus === "loading" ||
    (authStatus === "authenticated" &&
      loading &&
      orders.length === 0 &&
      !error);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <AuthRequiredState
            callbackUrl="/orders"
            message="Please sign in to view your orders."
          />
        </main>
      </div>
    );
  }

  const ordersContent =
    orders.length === 0 ? (
      <OrdersEmptyState search={search} />
    ) : (
      <>
        <div className="space-y-4 mb-8">
          {orders.map((order) => (
            <OrderListCard
              key={order.id}
              order={order}
              formatPrice={formatPrice}
            />
          ))}
        </div>

        <CursorPaginationBar
          currentPage={currentPage}
          hasMore={hasMore}
          loading={loading}
          cursorHistoryLength={cursorHistoryLength}
          onPrev={handlePrev}
          onNext={handleNext}
          variant="warm"
        />
      </>
    );

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <GradientHeading className="mb-6">My Orders</GradientHeading>

        <OrdersSearchForm
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          search={search}
          onSearch={handleSearch}
          onClear={handleRefresh}
        />

        {error && (
          <AlertBanner message={error} variant="error" className="mb-6" />
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          ordersContent
        )}
      </main>
    </div>
  );
}
