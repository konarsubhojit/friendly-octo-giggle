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

const mockVariantNoImage: ProductVariant = {
  ...mockVariant,
  id: 'var5678',
  sku: 'BLU-SM',
  image: null,
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
})
