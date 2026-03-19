'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuthRequiredState } from '@/components/ui/AuthRequiredState';
import { Card } from '@/components/ui/Card';
import { GradientHeading } from '@/components/ui/GradientHeading';
import { Badge, orderStatusVariant } from '@/components/ui/Badge';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  PROCESSING: { label: 'Processing', color: 'text-blue-700', bg: 'bg-blue-100' },
  SHIPPED: { label: 'Shipped', color: 'text-purple-700', bg: 'bg-purple-100' },
  DELIVERED: { label: 'Delivered', color: 'text-green-700', bg: 'bg-green-100' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
};

const PAGE_SIZE = 20;

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

interface OrderListCardProps {
  readonly order: OrderSummary;
  readonly formatPrice: (amount: number) => string;
}

const OrderListCard = ({ order, formatPrice }: OrderListCardProps) => {
  const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const firstItem = order.items[0];
  const firstImage = firstItem?.product?.image;

  return (
    <Link
      href={`/orders/${order.id}`}
      className="block bg-[var(--surface)] backdrop-blur-lg rounded-xl shadow-warm border border-[var(--border-warm)] p-6 hover:shadow-warm-lg hover:scale-[1.01] transition-all duration-300"
    >
      <div className="flex items-center gap-6">
        {firstImage && (
          <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <Image src={firstImage} alt={firstItem?.product?.name || 'Order item'} fill sizes="48px" className="object-cover" />
          </div>
        )}
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <Badge variant={orderStatusVariant(order.status)} size="sm">
              {statusInfo.label}
            </Badge>
            <span className="text-xs text-[var(--text-muted)]">
              {new Date(order.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)] truncate">
            {firstItem?.product?.name}
            {order.items.length > 1 && ` and ${order.items.length - 1} more`}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-lg font-bold text-[var(--foreground)]">{formatPrice(order.totalAmount)}</p>
          <p className="text-xs text-[var(--text-muted)]">Order #{order.id}</p>
        </div>
        <svg className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
};

export default function OrdersPage() {
  const { data: session, status: authStatus } = useSession();
  const { formatPrice } = useCurrency();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const fetchOrders = useCallback(async (cursorParam: string | null, searchQuery: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (cursorParam) params.set('cursor', cursorParam);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to load orders');
      }
      const data = await res.json();
      const items: OrderSummary[] = data.orders ?? [];
      setOrders(items);
      setNextCursor(data.nextCursor ?? null);
      setHasMore(data.hasMore ?? false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchOrders(cursor, search);
    }
  }, [authStatus, fetchOrders, cursor, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCursor(null);
    setCursorHistory([]);
    setSearch(searchInput.trim());
  };

  const handleNext = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor ?? '']);
    setCursor(nextCursor);
  };

  const handlePrev = () => {
    if (cursorHistory.length === 0) return;
    const prev = [...cursorHistory];
    const prevCursor = prev.pop() ?? null;
    setCursorHistory(prev);
    setCursor(prevCursor);
  };

  const handleClearSearch = () => {
    setSearch('');
    setSearchInput('');
    setCursor(null);
    setCursorHistory([]);
  };

  const currentPage = cursorHistory.length + 1;

  if (authStatus === 'loading' || (authStatus === 'authenticated' && loading && orders.length === 0 && !error)) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
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
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <AuthRequiredState callbackUrl="/orders" message="Please sign in to view your orders." />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <GradientHeading className="mb-6">My Orders</GradientHeading>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-2 max-w-md">
            <div className="relative flex-1">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--accent-rose)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                placeholder="Search by order ID or status…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-11 pr-4 py-3 border border-[var(--border-warm)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--accent-rose)]/30 focus:border-[var(--accent-rose)] bg-[var(--surface)] text-[var(--foreground)] placeholder-[var(--text-muted)] shadow-warm transition-all duration-200"
                aria-label="Search your orders"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-[var(--accent-rose)] text-white rounded-full text-sm hover:opacity-90 transition"
            >
              Search
            </button>
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border-warm)] text-[var(--text-secondary)] rounded-full text-sm hover:bg-[var(--border-warm)] transition"
              >
                Clear
              </button>
            )}
          </div>
          {search && (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Results for &ldquo;<strong>{search}</strong>&rdquo;
            </p>
          )}
        </form>

        {error && <AlertBanner message={error} variant="error" className="mb-6" />}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : orders.length === 0 ? (
          <Card className="p-12 text-center">
            <EmptyState
              icon={
                <svg className="w-20 h-20 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              title={search ? 'No matching orders' : 'No orders yet'}
              message={search ? 'Try a different search term.' : 'Start shopping and your orders will appear here.'}
              ctaText={search ? undefined : 'Browse Products'}
              ctaHref={search ? undefined : '/'}
              className="py-0"
            />
          </Card>
        ) : (
          <>
            <div className="space-y-4 mb-8">
              {orders.map((order) => (
                <OrderListCard key={order.id} order={order} formatPrice={formatPrice} />
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--border-warm)] pt-4">
              <p className="text-sm text-[var(--text-muted)]">Page {currentPage}</p>
              <div className="flex gap-2">
                <button
                  onClick={handlePrev}
                  disabled={cursorHistory.length === 0 || loading}
                  className="px-4 py-2 text-sm font-medium bg-[var(--surface)] border border-[var(--border-warm)] text-[var(--text-secondary)] rounded-full hover:bg-[var(--border-warm)] disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  ← Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={!hasMore || loading}
                  className="px-4 py-2 text-sm font-medium bg-[var(--accent-rose)] text-white rounded-full hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

