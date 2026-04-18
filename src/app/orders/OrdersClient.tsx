'use client'

import { useCurrency } from '@/contexts/CurrencyContext'
import { useCursorPagination } from '@/hooks/useCursorPagination'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { GradientHeading } from '@/components/ui/GradientHeading'
import { OrderListCard } from '@/features/orders/components/OrderListCard'
import { OrdersSearchForm } from '@/features/orders/components/OrdersSearchForm'
import { CursorPaginationBar } from '@/components/ui/CursorPaginationBar'

interface OrderSummary {
  id: string
  status: string
  createdAt: string
  totalAmount: number
  items: Array<{
    quantity: number
    product?: { name: string; image: string } | null
    variant?: { id: string; name: string; price: number } | null
  }>
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
      title={search ? 'No matching orders' : 'No orders yet'}
      message={
        search
          ? 'Try a different search term.'
          : 'Start shopping and your orders will appear here.'
      }
      ctaText={search ? undefined : 'Browse Products'}
      ctaHref={search ? undefined : '/shop'}
      className="py-0"
    />
  </Card>
)

export default function OrdersClient() {
  useCurrency()
  const {
    items: orders,
    loading,
    error,
    search,
    searchInput,
    hasMore,
    currentPage,
    totalCount,
    totalPages,
    setSearchInput,
    handleSearch,
    handleFirst,
    handleNext,
    handlePrev,
    handleLast,
    handlePageSelect,
    handleRefresh,
  } = useCursorPagination<OrderSummary>({
    url: '/api/orders',
    dataKey: 'orders',
    enabled: true,
  })

  const ordersContent =
    orders.length === 0 ? (
      <OrdersEmptyState search={search} />
    ) : (
      <>
        <div className="space-y-4 mb-8">
          {orders.map((order) => (
            <OrderListCard key={order.id} order={order} />
          ))}
        </div>

        <CursorPaginationBar
          currentPage={currentPage}
          totalCount={totalCount}
          pageSize={10}
          hasMore={hasMore}
          loading={loading}
          totalPages={totalPages}
          onFirst={handleFirst}
          onPrev={handlePrev}
          onNext={handleNext}
          onLast={handleLast}
          onPageSelect={handlePageSelect}
          variant="warm"
        />
      </>
    )

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
  )
}
