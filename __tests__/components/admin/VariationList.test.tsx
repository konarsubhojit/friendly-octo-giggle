// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import VariationList from '@/features/admin/components/VariationList'
import type { ProductVariant } from '@/lib/types'

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}))

vi.mock('@/features/admin/components/DeleteConfirmModal', () => ({
  default: ({
    onConfirm,
    onCancel,
    loading,
  }: {
    onConfirm: () => void
    onCancel: () => void
    loading: boolean
  }) => (
    <div data-testid="delete-modal">
      <p>Are you sure?</p>
      <button onClick={onConfirm} disabled={loading}>
        Confirm Delete
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    formatPrice: (n: number) => `$${n.toFixed(2)}`,
    currency: 'USD',
    availableCurrencies: ['USD'],
    rates: { INR: 1, USD: 1 },
    setCurrency: vi.fn(),
  }),
}))

const mockVariant: ProductVariant = {
  id: 'var1234',
  productId: 'abc1234',
  sku: 'RED-LG',
  image: 'https://example.com/red.jpg',
  images: [],
  price: 150,
  stock: 25,
  deletedAt: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
}

describe('VariationList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders empty state when no variations', () => {
    render(<VariationList productId="abc1234" initialVariants={[]} />)
    expect(screen.getByText('No variants yet')).toBeInTheDocument()
    expect(screen.getByText('Add Variant')).toBeInTheDocument()
  })

  it('renders variation cards with correct data', () => {
    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )
    expect(screen.getByText('RED-LG')).toBeInTheDocument()
    expect(screen.getByText('25 in stock')).toBeInTheDocument()
    expect(screen.getByText('Variants (1)')).toBeInTheDocument()
  })

  it('displays variation price', () => {
    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )
    expect(screen.getByText('$150.00')).toBeInTheDocument()
  })

  it('shows variant id for variations without sku', () => {
    const noSku = { ...mockVariant, sku: null }
    render(<VariationList productId="abc1234" initialVariants={[noSku]} />)
    expect(screen.getByText('var1234')).toBeInTheDocument()
  })

  it('renders Edit and Delete buttons', () => {
    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )
    expect(
      screen.getByRole('button', {
        name: 'Open quick edit for RED-LG',
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delete RED-LG' })
    ).toBeInTheDocument()
  })

  it('renders Add Variation button when variations exist', () => {
    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )
    expect(screen.getByText('Add Variant')).toBeInTheDocument()
  })

  it('keeps quick edit fields collapsed until edit is opened', () => {
    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )

    expect(screen.queryByLabelText('Price for RED-LG')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Stock for RED-LG')).not.toBeInTheDocument()
  })

  it('expands quick edit fields when the edit action is clicked', () => {
    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open quick edit for RED-LG',
      })
    )

    expect(screen.getByLabelText('Price for RED-LG')).toBeInTheDocument()
    expect(screen.getByLabelText('Stock for RED-LG')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('saves inline quick edits for stock and price', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          variant: {
            ...mockVariant,
            stock: 30,
            price: 200,
            updatedAt: '2025-01-02T00:00:00.000Z',
          },
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open quick edit for RED-LG',
      })
    )

    fireEvent.change(screen.getByLabelText('Price for RED-LG'), {
      target: { value: '200' },
    })
    fireEvent.change(screen.getByLabelText('Stock for RED-LG'), {
      target: { value: '30' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/admin/variations/var1234',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ price: 200, stock: 30 }),
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByText('30 in stock')).toBeInTheDocument()
      expect(screen.getByText('$200.00')).toBeInTheDocument()
    })
  })

  it('shows error toast for invalid price in quick edit (zero)', async () => {
    const mockToast = await import('react-hot-toast')

    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open quick edit for RED-LG',
      })
    )

    fireEvent.change(screen.getByLabelText('Price for RED-LG'), {
      target: { value: '0' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockToast.default.error).toHaveBeenCalledWith(
        'Price must be a positive number'
      )
    })
  })

  it('shows error toast for invalid stock in quick edit (negative)', async () => {
    const mockToast = await import('react-hot-toast')

    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open quick edit for RED-LG',
      })
    )

    // Set a valid price first, then set invalid stock
    fireEvent.change(screen.getByLabelText('Price for RED-LG'), {
      target: { value: '100' },
    })
    fireEvent.change(screen.getByLabelText('Stock for RED-LG'), {
      target: { value: '-1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockToast.default.error).toHaveBeenCalledWith(
        'Stock must be a non-negative integer'
      )
    })
  })

  it('shows error toast when quick save API call fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })
    vi.stubGlobal('fetch', mockFetch)
    const mockToast = await import('react-hot-toast')

    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open quick edit for RED-LG',
      })
    )

    // Set both fields to valid values so validation passes and API call is made
    fireEvent.change(screen.getByLabelText('Price for RED-LG'), {
      target: { value: '300' },
    })
    fireEvent.change(screen.getByLabelText('Stock for RED-LG'), {
      target: { value: '10' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(mockToast.default.error).toHaveBeenCalledWith('Server error')
    })
  })

  it('shows Reset button when draft values differ and resets on click', () => {
    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Open quick edit for RED-LG',
      })
    )

    fireEvent.change(screen.getByLabelText('Price for RED-LG'), {
      target: { value: '999' },
    })

    expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    expect(
      (screen.getByLabelText('Price for RED-LG') as HTMLInputElement).value
    ).toBe('150')
  })

  it('shows error toast when deletion API call fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Cannot delete last variant' }),
    })
    vi.stubGlobal('fetch', mockFetch)
    const mockToast = await import('react-hot-toast')

    render(
      <VariationList productId="abc1234" initialVariants={[mockVariant]} />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete RED-LG' }))

    await waitFor(() => {
      expect(screen.getByText('Confirm Delete')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Delete' }))

    await waitFor(() => {
      expect(mockToast.default.error).toHaveBeenCalledWith(
        'Cannot delete last variant'
      )
    })
  })

  it('renders option values text when variant has optionValues', () => {
    const variantWithOptions = {
      ...mockVariant,
      optionValues: [
        {
          id: 'ov1',
          value: 'Red',
          optionId: 'opt1',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
        {
          id: 'ov2',
          value: 'Large',
          optionId: 'opt2',
          sortOrder: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      ],
    }
    render(
      <VariationList
        productId="abc1234"
        initialVariants={[variantWithOptions]}
      />
    )
    expect(screen.getByText('Red / Large')).toBeInTheDocument()
  })

  it('renders variant without image using placeholder', () => {
    const noImageVariant = { ...mockVariant, image: null }
    render(
      <VariationList productId="abc1234" initialVariants={[noImageVariant]} />
    )
    expect(screen.getByText('📦')).toBeInTheDocument()
  })
})
