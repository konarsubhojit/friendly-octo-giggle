"use client";

import { useState, useEffect, useCallback } from "react";
import { OrderStatus } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useDispatch } from "react-redux";
import { updateAdminOrderStatus } from "@/lib/features/admin/adminSlice";
import type { AppDispatch } from "@/lib/store";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import AdminBreadcrumbs from "@/components/admin/AdminBreadcrumbs";
import { AdminOrderCard } from "@/components/admin/AdminOrderCard";

type ShippingEdits = Record<
  string,
  { trackingNumber: string; shippingProvider: string }
>;

interface AdminOrderItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  customizationNote?: string | null;
  product?: { id: string; name: string; image: string };
  variation?: { id: string; name: string; priceModifier: number } | null;
}

interface AdminOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: string;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItem[];
  userId?: string | null;
}

const STATUS_FILTERS = ["ALL", ...Object.values(OrderStatus)] as const;
const PAGE_SIZE = 20;

const OrdersManagement = () => {
  const { formatPrice } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [savingShippingId, setSavingShippingId] = useState<string | null>(null);
  const [shippingEdits, setShippingEdits] = useState<ShippingEdits>({});

  const fetchOrders = useCallback(
    async (
      cursorParam: string | null,
      searchQuery: string,
      statusFilter: string,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (cursorParam) params.set("cursor", cursorParam);
        if (searchQuery) params.set("search", searchQuery);
        if (statusFilter && statusFilter !== "ALL")
          params.set("status", statusFilter);

        const res = await fetch(`/api/admin/orders?${params.toString()}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load orders");
        }
        const data = await res.json();
        const items: AdminOrder[] = data.data?.orders ?? data.orders ?? [];
        setOrders(items);
        setNextCursor(data.data?.nextCursor ?? null);
        setHasMore(data.data?.hasMore ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchOrders(cursor, search, filter);
  }, [fetchOrders, cursor, search, filter]);

  const handleSearch = (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    setCursor(null);
    setCursorHistory([]);
    setSearch(searchInput.trim());
  };

  const handleFilterChange = (status: "ALL" | OrderStatus) => {
    setFilter(status);
    setCursor(null);
    setCursorHistory([]);
  };

  const handleNext = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor ?? ""]);
    setCursor(nextCursor);
  };

  const handlePrev = () => {
    if (cursorHistory.length === 0) return;
    const prev = [...cursorHistory];
    const prevCursor = prev.pop() ?? null;
    setCursorHistory(prev);
    setCursor(prevCursor);
  };

  const handleRefresh = () => {
    setCursor(null);
    setCursorHistory([]);
    setSearch("");
    setSearchInput("");
    setFilter("ALL");
  };

  const getShippingEdit = (
    orderId: string,
    order: { trackingNumber?: string | null; shippingProvider?: string | null },
  ) =>
    shippingEdits[orderId] ?? {
      trackingNumber: order.trackingNumber ?? "",
      shippingProvider: order.shippingProvider ?? "",
    };

  const setShippingField = (
    orderId: string,
    field: "trackingNumber" | "shippingProvider",
    value: string,
    order: { trackingNumber?: string | null; shippingProvider?: string | null },
  ) => {
    const current = getShippingEdit(orderId, order);
    setShippingEdits((prev) => ({
      ...prev,
      [orderId]: { ...current, [field]: value },
    }));
  };

  const normalizeShippingField = (
    value: string | null | undefined,
  ): string | null => {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  };

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus,
  ) => {
    setUpdatingOrderId(orderId);
    await dispatch(updateAdminOrderStatus({ id: orderId, status: newStatus }));
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)),
    );
    setUpdatingOrderId(null);
  };

  const handleSaveShipping = async (
    orderId: string,
    currentStatus: OrderStatus | string,
    order: { trackingNumber?: string | null; shippingProvider?: string | null },
  ) => {
    const edit = getShippingEdit(orderId, order);
    setSavingShippingId(orderId);
    await dispatch(
      updateAdminOrderStatus({
        id: orderId,
        status: currentStatus,
        trackingNumber: normalizeShippingField(edit.trackingNumber),
        shippingProvider: normalizeShippingField(edit.shippingProvider),
      }),
    );
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              trackingNumber: normalizeShippingField(edit.trackingNumber),
              shippingProvider: normalizeShippingField(edit.shippingProvider),
            }
          : o,
      ),
    );
    setShippingEdits((prev) => {
      const { [orderId]: _removed, ...rest } = prev;
      return rest;
    });
    setSavingShippingId(null);
  };

  const currentPage = cursorHistory.length + 1;

  const ordersListContent =
    orders.length === 0 ? (
      <EmptyState
        title="No orders found"
        message={search ? "Try a different search term." : undefined}
      />
    ) : (
      <>
        <div className="space-y-4 mb-8">
          {orders.map((order) => (
            <AdminOrderCard
              key={order.id}
              order={order}
              updatingOrderId={updatingOrderId}
              savingShippingId={savingShippingId}
              edit={getShippingEdit(order.id, order)}
              formatPrice={formatPrice}
              onStatusChange={handleStatusChange}
              onShippingFieldChange={setShippingField}
              onSaveShipping={handleSaveShipping}
            />
          ))}
        </div>

        {/* Cursor Pagination */}
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Page {currentPage}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handlePrev}
              disabled={cursorHistory.length === 0 || loading}
              className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Previous
            </button>
            <button
              onClick={handleNext}
              disabled={!hasMore || loading}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
      </>
    );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminBreadcrumbs
        items={[{ label: "Admin", href: "/admin" }, { label: "Orders" }]}
      />
      {/* Header */}
      <div className="mb-6 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Order Management
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage all customer orders
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition text-sm"
        >
          Refresh
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2 max-w-md">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              placeholder="Search by name, email, or order ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Search orders"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Clear
            </button>
          )}
        </div>
        {search && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Showing results for &ldquo;<strong>{search}</strong>&rdquo;
          </p>
        )}
      </form>

      {error && (
        <AlertBanner message={error} variant="error" className="mb-4" />
      )}

      {/* Status Filter Tabs */}
      <div className="mb-6 flex gap-2 overflow-x-auto">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            onClick={() => handleFilterChange(status)}
            className={`px-4 py-2 rounded-md font-medium whitespace-nowrap transition ${
              filter === status
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
            aria-pressed={filter === status}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        ordersListContent
      )}
    </main>
  );
};
export default OrdersManagement;
