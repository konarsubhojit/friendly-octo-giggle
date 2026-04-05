'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { OrderStatus } from '@/lib/types'
import { useCurrency } from '@/contexts/CurrencyContext'
import { useDispatch } from 'react-redux'
import { updateAdminOrderStatus } from '@/features/admin/store/adminSlice'
import type { AppDispatch } from '@/lib/store'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { AlertBanner } from '@/components/ui/AlertBanner'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import { AdminOrderCard } from '@/features/admin/components/AdminOrderCard'
import { AdminSearchForm } from '@/features/admin/components/AdminSearchForm'
import { CursorPaginationBar } from '@/components/ui/CursorPaginationBar'
import { DataTable, type DataTableColumn } from 'zenput'

type ShippingEdits = Record<
  string,
  { trackingNumber: string; shippingProvider: string }
>

interface AdminOrderItem {
  id: string
  productId: string
  quantity: number
  price: number
  customizationNote?: string | null
  product?: { id: string; name: string; image: string }
  variation?: { id: string; name: string; price: number } | null
}

interface AdminOrder {
  id: string
  customerName: string
  customerEmail: string
  customerAddress: string
  totalAmount: number
  status: string
  trackingNumber?: string | null
  shippingProvider?: string | null
  createdAt: string
  updatedAt: string
  items: AdminOrderItem[]
  userId?: string | null
}

const STATUS_FILTERS = ['ALL', ...Object.values(OrderStatus)] as const
const PAGE_SIZE = 20

type OrderRow = {
  id: string
  customer: string
  status: string
  total: string
  date: string
  _raw: AdminOrder
}

export default function OrdersManagement() {
  const { formatPrice } = useCurrency()
  const dispatch = useDispatch<AppDispatch>()

  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | OrderStatus>('ALL')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [cursor, setCursor] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)
  const [savingShippingId, setSavingShippingId] = useState<string | null>(null)
  const [shippingEdits, setShippingEdits] = useState<ShippingEdits>({})
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)

  const pageCursorsRef = useRef<Array<string | null>>([null])
  const pendingOffsetRef = useRef<number | null>(null)

  const syncPageCursors = useCallback((nextValue: Array<string | null>) => {
    pageCursorsRef.current = nextValue
  }, [])

  const fetchOrders = useCallback(
    async (
      cursorParam: string | null,
      searchQuery: string,
      statusFilter: string,
      offsetVal?: number
    ) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
        if (offsetVal !== undefined && offsetVal > 0) {
          params.set('offset', String(offsetVal))
        } else if (cursorParam) {
          params.set('cursor', cursorParam)
        }
        if (searchQuery) params.set('search', searchQuery)
        if (statusFilter && statusFilter !== 'ALL')
          params.set('status', statusFilter)

        const res = await fetch(`/api/admin/orders?${params.toString()}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load orders')
        }
        const data = await res.json()
        const items: AdminOrder[] = data.data?.orders ?? data.orders ?? []
        setOrders(items)
        setNextCursor(data.data?.nextCursor ?? null)
        setHasMore(data.data?.hasMore ?? false)
        setTotalCount(Number(data.data?.totalCount ?? data.totalCount ?? 0))
        const discoveredCursors = pageCursorsRef.current.slice(0, currentPage)
        if (data.data?.nextCursor) {
          discoveredCursors[currentPage] = data.data.nextCursor
        }
        syncPageCursors(discoveredCursors)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
    },
    [currentPage, syncPageCursors]
  )

  useEffect(() => {
    const pendingOffset = pendingOffsetRef.current
    pendingOffsetRef.current = null
    const effectiveCursor = pendingOffset === null ? cursor : null
    fetchOrders(effectiveCursor, search, filter, pendingOffset ?? undefined)
  }, [fetchOrders, cursor, search, filter])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const handleSearch = (e: React.BaseSyntheticEvent) => {
    e.preventDefault()
    syncPageCursors([null])
    setCurrentPage(1)
    setCursor(null)
    setSearch(searchInput.trim())
  }

  const handleFilterChange = (status: 'ALL' | OrderStatus) => {
    setFilter(status)
    syncPageCursors([null])
    setCurrentPage(1)
    setCursor(null)
  }

  const handleFirst = () => {
    if (currentPage === 1) return
    setCurrentPage(1)
    setCursor(null)
  }

  const handleNext = () => {
    if (!nextCursor || currentPage >= totalPages) return
    setCurrentPage((prev) => prev + 1)
    setCursor(nextCursor)
  }

  const handlePrev = () => {
    if (currentPage === 1) return
    const prevCursor = pageCursorsRef.current[currentPage - 2]
    if (prevCursor === undefined) {
      pendingOffsetRef.current = (currentPage - 2) * PAGE_SIZE
      setCurrentPage((prev) => prev - 1)
      return
    }

    setCurrentPage((prev) => prev - 1)
    setCursor(prevCursor)
  }

  const handlePageSelect = (page: number) => {
    const targetPage = Math.min(Math.max(1, page), totalPages)
    if (targetPage === currentPage) return

    if (targetPage === 1) {
      handleFirst()
      return
    }

    const knownCursor = pageCursorsRef.current[targetPage - 1]
    if (knownCursor !== undefined) {
      setCurrentPage(targetPage)
      setCursor(knownCursor)
      return
    }

    pendingOffsetRef.current = (targetPage - 1) * PAGE_SIZE
    setCurrentPage(targetPage)
  }

  const handleLast = () => {
    handlePageSelect(totalPages)
  }

  const handleRefresh = () => {
    syncPageCursors([null])
    setCurrentPage(1)
    setCursor(null)
    setNextCursor(null)
    setHasMore(false)
    setTotalCount(0)
    setSearch('')
    setSearchInput('')
    setFilter('ALL')
  }

  const getShippingEdit = (
    orderId: string,
    order: { trackingNumber?: string | null; shippingProvider?: string | null }
  ) =>
    shippingEdits[orderId] ?? {
      trackingNumber: order.trackingNumber ?? '',
      shippingProvider: order.shippingProvider ?? '',
    }

  const setShippingField = (
    orderId: string,
    field: 'trackingNumber' | 'shippingProvider',
    value: string,
    order: { trackingNumber?: string | null; shippingProvider?: string | null }
  ) => {
    const current = getShippingEdit(orderId, order)
    setShippingEdits((prev) => ({
      ...prev,
      [orderId]: { ...current, [field]: value },
    }))
  }

  const normalizeShippingField = (
    value: string | null | undefined
  ): string | null => {
    if (value == null) return null
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }

  const handleStatusChange = async (
    orderId: string,
    newStatus: OrderStatus
  ) => {
    setUpdatingOrderId(orderId)
    await dispatch(updateAdminOrderStatus({ id: orderId, status: newStatus }))
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    )
    setUpdatingOrderId(null)
  }

  const handleSaveShipping = async (
    orderId: string,
    currentStatus: OrderStatus | string,
    order: { trackingNumber?: string | null; shippingProvider?: string | null }
  ) => {
    const edit = getShippingEdit(orderId, order)
    setSavingShippingId(orderId)
    await dispatch(
      updateAdminOrderStatus({
        id: orderId,
        status: currentStatus,
        trackingNumber: normalizeShippingField(edit.trackingNumber),
        shippingProvider: normalizeShippingField(edit.shippingProvider),
      })
    )
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              trackingNumber: normalizeShippingField(edit.trackingNumber),
              shippingProvider: normalizeShippingField(edit.shippingProvider),
            }
          : o
      )
    )
    setShippingEdits((prev) => {
      const { [orderId]: _removed, ...rest } = prev
      return rest
    })
    setSavingShippingId(null)
  }

  const orderColumns: DataTableColumn<OrderRow>[] = [
    { key: 'id', header: 'Order ID' },
    { key: 'customer', header: 'Customer' },
    { key: 'status', header: 'Status', filterable: true },
    { key: 'total', header: 'Total' },
    { key: 'date', header: 'Date' },
    {
      key: 'actions',
      header: '',
      render: (_value, row) => (
        <button
          onClick={() => setSelectedOrder(row._raw)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950 transition"
        >
          View
        </button>
      ),
    },
  ]

  const orderRows: OrderRow[] = orders.map((order) => ({
    id: order.id,
    customer: order.customerName,
    status: order.status,
    total: formatPrice(order.totalAmount),
    date: new Date(order.createdAt).toLocaleDateString('en-GB'),
    _raw: order,
  }))

  const ordersListContent = (
    <>
      <DataTable
        columns={orderColumns}
        data={orderRows}
        rowKey={(row) => row.id}
        emptyMessage={
          search ? 'No orders match your search.' : 'No orders yet.'
        }
        className="mb-8"
      />

      <CursorPaginationBar
        currentPage={currentPage}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        hasMore={hasMore}
        loading={loading}
        totalPages={totalPages}
        onFirst={handleFirst}
        onPrev={handlePrev}
        onNext={handleNext}
        onLast={handleLast}
        onPageSelect={handlePageSelect}
      />
    </>
  )

  const trackedOrders = orders.filter(
    (order) => order.trackingNumber || order.shippingProvider
  ).length
  const visibleRevenue = orders.reduce(
    (total, order) => total + order.totalAmount,
    0
  )

  return (
    <AdminPageShell
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Orders' }]}
      eyebrow="Fulfilment operations"
      title="Order Management"
      description="Search and manage orders, update fulfilment status, and track shipping."
      actions={
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Refresh
        </button>
      }
      metrics={[
        {
          label: 'Matching orders',
          value: String(totalCount),
          hint: 'Total orders matching current filters.',
          tone: 'sky',
        },
        {
          label: 'Visible revenue',
          value: formatPrice(visibleRevenue),
          hint: 'Revenue on the current page.',
          tone: 'emerald',
        },
        {
          label: 'Tracking attached',
          value: String(trackedOrders),
          hint: 'Orders with tracking details.',
          tone: 'amber',
        },
      ]}
    >
      <AdminPanel
        title="Search"
        description="Filter by customer, email, or order ID."
      >
        <AdminSearchForm
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          search={search}
          onSearch={handleSearch}
          onClear={handleRefresh}
          placeholder="Search by name, email, or order ID…"
          ariaLabel="Search orders"
        />

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              onClick={() => handleFilterChange(status)}
              className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                filter === status
                  ? 'bg-slate-950 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
              }`}
              aria-pressed={filter === status}
            >
              {status}
            </button>
          ))}
        </div>
      </AdminPanel>

      {error ? (
        <AlertBanner message={error} variant="error" className="mb-0" />
      ) : null}

      <AdminPanel title="Orders" description="">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner />
          </div>
        ) : (
          ordersListContent
        )}
      </AdminPanel>

      {selectedOrder !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-xl"
          >
            <div className="flex items-center justify-between p-4">
              <h3
                id="order-detail-title"
                className="text-lg font-bold text-slate-900 dark:text-slate-100"
              >
                Order {selectedOrder.id}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Close
              </button>
            </div>
            <div className="px-4 pb-6">
              <AdminOrderCard
                order={selectedOrder}
                updatingOrderId={updatingOrderId}
                savingShippingId={savingShippingId}
                edit={getShippingEdit(selectedOrder.id, selectedOrder)}
                onStatusChange={handleStatusChange}
                onShippingFieldChange={setShippingField}
                onSaveShipping={handleSaveShipping}
              />
            </div>
          </div>
        </div>
      )}
    </AdminPageShell>
  )
}
