import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SearchReindexClient from '@/features/admin/components/SearchReindexClient'

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@/components/ui/ConfirmDialog', () => ({
  default: ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    onCancel: () => void
  }) =>
    isOpen ? (
      <div data-testid="confirm-dialog">
        <span>{title}</span>
        <span>{message}</span>
        <button onClick={onConfirm}>Proceed</button>
        <button onClick={onCancel}>Dismiss</button>
      </div>
    ) : null,
}))

describe('SearchReindexClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows not configured warning when both are false', () => {
    render(
      <SearchReindexClient
        productsConfigured={false}
        ordersConfigured={false}
      />
    )
    expect(screen.getByText('Search Not Configured')).toBeInTheDocument()
  })

  it('renders reindex buttons when configured', () => {
    render(
      <SearchReindexClient productsConfigured={true} ordersConfigured={true} />
    )
    expect(screen.getByText('Reindex Products')).toBeInTheDocument()
    expect(screen.getByText('Reindex Orders')).toBeInTheDocument()
  })

  it('disables button when not configured', () => {
    render(
      <SearchReindexClient productsConfigured={true} ordersConfigured={false} />
    )
    expect(screen.getByText('Reindex Products')).toBeEnabled()
    expect(screen.getByText('Orders unavailable')).toBeDisabled()
  })

  it('opens confirmation dialog when reindex clicked', () => {
    render(
      <SearchReindexClient productsConfigured={true} ordersConfigured={true} />
    )
    fireEvent.click(screen.getByText('Reindex Products'))
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument()
  })

  it('performs reindex on confirm', async () => {
    const toast = await import('react-hot-toast')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { reindexed: { products: 42 } },
        }),
      })
    )

    render(
      <SearchReindexClient productsConfigured={true} ordersConfigured={true} />
    )
    fireEvent.click(screen.getByText('Reindex Products'))
    fireEvent.click(screen.getByText('Proceed'))

    await waitFor(() => {
      expect(toast.default.success).toHaveBeenCalledWith(
        'Reindexed 42 products'
      )
    })
  })

  it('shows error toast when reindex fails', async () => {
    const toast = await import('react-hot-toast')

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Index locked' }),
      })
    )

    render(
      <SearchReindexClient productsConfigured={true} ordersConfigured={true} />
    )
    fireEvent.click(screen.getByText('Reindex Products'))
    fireEvent.click(screen.getByText('Proceed'))

    await waitFor(() => {
      expect(toast.default.error).toHaveBeenCalledWith('Index locked')
    })
  })

  it('cancels confirmation dialog', () => {
    render(
      <SearchReindexClient productsConfigured={true} ordersConfigured={true} />
    )
    fireEvent.click(screen.getByText('Reindex Products'))
    fireEvent.click(screen.getByText('Dismiss'))
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
  })

  it('shows last run result after reindex', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { reindexed: { orders: 100 } },
        }),
      })
    )

    render(
      <SearchReindexClient productsConfigured={true} ordersConfigured={true} />
    )
    fireEvent.click(screen.getByText('Reindex Orders'))
    fireEvent.click(screen.getByText('Proceed'))

    await waitFor(() => {
      expect(screen.getByText(/100 records indexed/)).toBeInTheDocument()
    })
  })

  it('renders information section', () => {
    render(
      <SearchReindexClient productsConfigured={true} ordersConfigured={true} />
    )
    expect(screen.getByText('Information')).toBeInTheDocument()
  })
})
