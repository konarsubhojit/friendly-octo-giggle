// @vitest-environment jsdom

import type { ReactNode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrderStatus } from '@/lib/types'
import OrdersManagementClient from '@/app/admin/orders/OrdersManagementClient'
import ProductsManagementClient from '@/app/admin/products/ProductsManagementClient'
import ReviewsManagementClient from '@/app/admin/reviews/ReviewsManagementClient'

interface DataViewProps {
  readonly ariaLabel: string
  readonly data: Array<Record<string, unknown>>
  readonly definition: {
    readonly columns: Array<{
      readonly key: string
      readonly render?: (
        value: unknown,
        row: Record<string, unknown>
      ) => ReactNode
    }>
    readonly rowActions: (row: Record<string, unknown>) => ReadonlyArray<{
      readonly onSelect: (row: Record<string, unknown>) => void
    }>
    readonly bulkActions: ReadonlyArray<{
      readonly onApply: (selection: {
        scope: 'loaded_page' | 'entire_filtered_result'
        rowIds: readonly string[]
        filterSnapshot: Record<string, unknown>
      }) => Promise<unknown>
    }>
  }
  readonly rowKey: (row: Record<string, unknown>, index: number) => string
  readonly renderMobileCard: (row: Record<string, unknown>) => ReactNode
  readonly expandedRowRender?: (row: Record<string, unknown>) => ReactNode
  readonly pagination?: { readonly onPageChange: (page: number) => void }
  readonly onRemoveFilter?: (key: string) => void
  readonly onClearFilters?: () => void
}

const mocks = vi.hoisted(() => {
  const refund = Object.assign(
    vi.fn((input: unknown) => ({ type: 'refund', payload: input })),
    { rejected: { match: vi.fn(() => false) } }
  )
  return {
    product: {
      id: 'product-1',
      name: 'Canvas Tote',
      description: 'A useful tote',
      price: 100,
      category: 'Bags',
      image: '/tote.jpg',
      stock: 4,
      variants: [{ id: 'variant-1', name: 'Blue', price: 100, stock: 4 }],
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
    views: {} as Record<string, DataViewProps>,
    dispatch: vi.fn(async (action: unknown) => ({
      ...((action as { payload?: object }).payload ?? {}),
      payload: action,
    })),
    refund,
    updateStatus: vi.fn((input: unknown) => ({
      type: 'update-status',
      payload: input,
    })),
    upsert: vi.fn((input: unknown) => ({ type: 'upsert', payload: input })),
  }
})

vi.mock('react-redux', () => ({
  useDispatch: () => mocks.dispatch,
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    formatPrice: (value: number) => `₹${value}`,
  }),
}))

vi.mock('@/features/admin/store/adminSlice', () => ({
  refundAdminOrder: mocks.refund,
  updateAdminOrderStatus: mocks.updateStatus,
  upsertProduct: mocks.upsert,
}))

vi.mock('next/image', () => ({
  default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('zenput', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))

vi.mock('@/components/ui/StarRating', () => ({
  StarRating: ({ rating }: { rating: number }) => <span>{rating} stars</span>,
}))

vi.mock('@/components/ui/AlertBanner', () => ({
  AlertBanner: ({ message }: { message: string }) => <div>{message}</div>,
}))

vi.mock('@/features/admin/components/AdminPageShell', () => ({
  AdminPageShell: ({
    title,
    actions,
    children,
  }: {
    title: string
    actions?: ReactNode
    children: ReactNode
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
  AdminPanel: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}))

vi.mock('@/features/admin/components/AdminSearchForm', () => ({
  AdminSearchForm: ({
    searchInput,
    setSearchInput,
    onSearch,
    onClear,
    ariaLabel,
  }: {
    searchInput: string
    setSearchInput: (value: string) => void
    onSearch: (event: React.SyntheticEvent) => void
    onClear: () => void
    ariaLabel: string
  }) => (
    <form onSubmit={onSearch}>
      <input
        aria-label={ariaLabel}
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
      />
      <button type="submit">Search</button>
      <button type="button" onClick={onClear}>
        Clear
      </button>
    </form>
  ),
}))

vi.mock('@/features/admin/components/AdminOrderCard', () => ({
  AdminOrderCard: ({
    order,
    onStatusChange,
    onShippingFieldChange,
    onSaveShipping,
    onRefund,
  }: {
    order: { id: string; status: string }
    onStatusChange: (id: string, status: OrderStatus) => void
    onShippingFieldChange: (
      id: string,
      field: 'trackingNumber',
      value: string,
      order: object
    ) => void
    onSaveShipping: (id: string, status: string, order: object) => void
    onRefund: (id: string, input: { reason: string }) => void
  }) => (
    <div>
      <button
        onClick={() => void onStatusChange(order.id, OrderStatus.SHIPPED)}
      >
        Update status
      </button>
      <button
        onClick={() =>
          onShippingFieldChange(order.id, 'trackingNumber', ' TRACK-2 ', order)
        }
      >
        Edit shipping
      </button>
      <button
        onClick={() => void onSaveShipping(order.id, order.status, order)}
      >
        Save shipping
      </button>
      <button onClick={() => void onRefund(order.id, { reason: 'requested' })}>
        Refund
      </button>
    </div>
  ),
}))

vi.mock('@/features/admin/components/ProductFormModal', () => ({
  default: ({
    onClose,
    onSuccess,
  }: {
    onClose: () => void
    onSuccess: (savedProduct: object) => void
  }) => (
    <div>
      <button onClick={() => onSuccess(mocks.product)}>Save product</button>
      <button onClick={onClose}>Close product form</button>
    </div>
  ),
}))

vi.mock('@/features/admin/components/AdminConfirmDialog', () => ({
  default: ({
    onClose,
    onConfirm,
  }: {
    onClose: () => void
    onConfirm: () => Promise<unknown>
  }) => (
    <div>
      <button onClick={() => void onConfirm()}>Confirm deletion</button>
      <button onClick={onClose}>Cancel deletion</button>
    </div>
  ),
}))

vi.mock('@/features/admin/components/AdminDataView', () => ({
  AdminDataView: (props: DataViewProps) => {
    mocks.views[props.ariaLabel] = props
    return (
      <div data-testid={`${props.ariaLabel}-view`}>
        {props.data.map((row, index) => (
          <div key={props.rowKey(row, index)}>
            {props.renderMobileCard(row)}
            {props.expandedRowRender?.(row)}
            {props.definition.columns.map((column) => (
              <div key={column.key}>
                {column.render?.(row[column.key], row)}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  },
}))

const order = {
  id: 'order-1',
  customerName: 'Asha',
  customerEmail: 'asha@example.com',
  customerAddress: 'Kolkata',
  totalAmount: 1500,
  status: OrderStatus.PROCESSING,
  trackingNumber: 'TRACK-1',
  shippingProvider: 'Carrier',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  items: [],
}

const reviews = [
  {
    id: 'review-1',
    productId: 'product-1',
    rating: 5,
    comment: 'Excellent tote',
    isAnonymous: false,
    isVerifiedBuyer: true,
    isFeatured: false,
    isHidden: false,
    helpfulCount: 3,
    notHelpfulCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    product: { id: 'product-1', name: 'Canvas Tote', image: '/tote.jpg' },
    user: {
      id: 'user-1',
      name: 'Asha',
      email: 'asha@example.com',
      image: null,
    },
  },
  {
    id: 'review-2',
    productId: 'product-2',
    rating: 3,
    comment: 'Anonymous feedback',
    isAnonymous: true,
    isVerifiedBuyer: false,
    isFeatured: true,
    isHidden: true,
    helpfulCount: 0,
    notHelpfulCount: 1,
    createdAt: '2026-01-02T00:00:00.000Z',
    product: null,
    user: null,
  },
]

const response = (data: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(data),
  }) as unknown as Response

const apply = async (callback: () => void | Promise<unknown>) => {
  await act(async () => {
    await callback()
  })
}

describe('admin management clients', () => {
  beforeEach(() => {
    mocks.views = {}
    mocks.dispatch.mockClear()
    mocks.refund.mockClear()
    mocks.refund.rejected.match.mockReturnValue(false)
    mocks.updateStatus.mockClear()
    mocks.upsert.mockClear()
    vi.stubGlobal('fetch', vi.fn())
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('manages product search, pagination, dialogs, and bulk deletion', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        response({
          data: {
            products: [mocks.product],
            totalCount: 45,
            nextCursor: 'next',
          },
        })
      )
      .mockResolvedValue(response({ data: { products: [mocks.product] } }))

    render(<ProductsManagementClient permissions={['products:write']} />)
    await screen.findByText('Canvas Tote')
    const view = mocks.views.Products
    const row = view.data[0]

    await apply(() => {
      view.definition.rowActions(row).forEach((action) => action.onSelect(row))
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancel deletion' })
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await apply(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }))
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Product' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Save product' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close product form' }))

    fireEvent.change(
      screen.getByRole('textbox', { name: /search products/i }),
      {
        target: { value: ' tote ' },
      }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
    await apply(() => view.pagination?.onPageChange(3))
    await apply(() => view.pagination?.onPageChange(1))

    await apply(() =>
      view.definition.bulkActions[0].onApply({
        scope: 'loaded_page',
        rowIds: ['product-1'],
        filterSnapshot: {},
      })
    )
    await apply(() =>
      view.definition.bulkActions[0].onApply({
        scope: 'entire_filtered_result',
        rowIds: [],
        filterSnapshot: { search: 'tote' },
      })
    )

    expect(fetch).toHaveBeenCalled()
    expect(mocks.upsert).toHaveBeenCalledWith(mocks.product)
  })

  it('manages order filters, row mutations, pagination, and bulk statuses', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({
        data: { orders: [order], totalCount: 41, nextCursor: 'next' },
      })
    )

    render(
      <OrdersManagementClient
        permissions={['orders:update', 'orders:refund']}
      />
    )
    await screen.findByText('Asha')
    const view = mocks.views.Orders
    const row = view.data[0]

    view.definition.rowActions(row).forEach((action) => action.onSelect(row))
    await apply(() => {
      fireEvent.click(
        screen.getAllByRole('button', { name: 'Update status' })[0]
      )
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit shipping' })[0])
    await apply(() => {
      fireEvent.click(
        screen.getAllByRole('button', { name: 'Save shipping' })[0]
      )
    })
    await apply(() => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Refund' })[0])
    })
    fireEvent.click(
      screen.getAllByRole('button', { name: OrderStatus.SHIPPED })[0]
    )
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    await apply(() => view.pagination?.onPageChange(3))
    await apply(() => view.pagination?.onPageChange(1))
    for (const action of view.definition.bulkActions) {
      await apply(() =>
        action.onApply({
          scope: 'loaded_page',
          rowIds: ['order-1'],
          filterSnapshot: {},
        })
      )
      await apply(() =>
        action.onApply({
          scope: 'entire_filtered_result',
          rowIds: [],
          filterSnapshot: { search: 'Asha', status: OrderStatus.PROCESSING },
        })
      )
    }

    await waitFor(() => expect(mocks.updateStatus).toHaveBeenCalled())
    expect(mocks.refund).toHaveBeenCalled()
  })

  it('filters, moderates, and removes reviews through row and bulk actions', async () => {
    vi.mocked(fetch).mockResolvedValue(
      response({
        data: { reviews, total: reviews.length, review: { isFeatured: true } },
      })
    )

    render(<ReviewsManagementClient permissions={['reviews:moderate']} />)
    await screen.findByText('Excellent tote')
    const view = mocks.views.Reviews
    const row = view.data[0]

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Search reviews' }),
      {
        target: { value: 'Asha' },
      }
    )
    fireEvent.click(screen.getByRole('button', { name: '5 ★' }))
    fireEvent.change(
      screen.getByRole('combobox', { name: 'Visibility filter' }),
      {
        target: { value: 'hidden' },
      }
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Verified only' }))

    await apply(() => {
      view.definition.rowActions(row).forEach((action) => action.onSelect(row))
    })
    await apply(() =>
      view.definition.bulkActions[0].onApply({
        scope: 'entire_filtered_result',
        rowIds: [],
        filterSnapshot: {},
      })
    )
    await apply(() =>
      view.definition.bulkActions[0].onApply({
        scope: 'loaded_page',
        rowIds: ['review-1', 'review-2'],
        filterSnapshot: {},
      })
    )

    await apply(() => {
      view.onRemoveFilter?.('search')
      view.onRemoveFilter?.('rating')
      view.onRemoveFilter?.('hidden')
      view.onRemoveFilter?.('verified')
      view.onClearFilters?.()
    })

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/reviews/review-1',
        expect.objectContaining({ method: 'PATCH' })
      )
    )
  })

  it('surfaces list and mutation failures without privileged actions', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(response({ error: 'Products unavailable' }, false))
      .mockResolvedValueOnce(response({ error: 'Orders unavailable' }, false))
      .mockResolvedValueOnce(response({ error: 'Reviews unavailable' }, false))

    render(<ProductsManagementClient permissions={[]} />)
    render(<OrdersManagementClient permissions={[]} />)
    render(<ReviewsManagementClient permissions={[]} />)

    expect(await screen.findByText('Products unavailable')).toBeInTheDocument()
    expect(await screen.findByText('Orders unavailable')).toBeInTheDocument()
    expect(await screen.findByText('Reviews unavailable')).toBeInTheDocument()
    expect(mocks.views.Products.definition.bulkActions).toHaveLength(0)
    expect(mocks.views.Orders.definition.bulkActions).toHaveLength(0)
    expect(mocks.views.Reviews.definition.bulkActions).toHaveLength(0)
  })
})
