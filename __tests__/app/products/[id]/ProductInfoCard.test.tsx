// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { ProductInfoCard } from '@/app/[locale]/(public)/products/[id]/components/ProductInfoCard'
import type { Product, ProductVariant } from '@/lib/types'

// Stub child components so we focus on ProductInfoCard's own markup
vi.mock('@/features/product/components/StockBadge', () => ({
  StockBadge: ({ stock }: { stock: number }) => (
    <span data-testid="stock-badge">stock:{stock}</span>
  ),
}))

vi.mock('@/features/product/components/ShareButton', () => ({
  ShareButton: () => <button type="button">Share</button>,
}))

vi.mock(
  '@/app/[locale]/(public)/products/[id]/components/VariantSelector',
  () => ({
    VariantSelector: () => <div data-testid="variant-selector" />,
  })
)

const baseProduct: Product = {
  id: 'p1',
  name: 'Test Product',
  description: 'A lovely test product',
  image: '/img.jpg',
  images: ['/img.jpg'],
  category: 'Accessories',
  soldCount: 42,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const formatPrice = (n: number) => `$${n.toFixed(2)}`

const renderCard = (overrides: Partial<React.ComponentProps<typeof ProductInfoCard>> = {}) =>
  render(
    <ProductInfoCard
      product={baseProduct}
      formatPrice={formatPrice}
      effectivePrice={199}
      selectedVariant={null}
      setSelectedVariant={vi.fn()}
      effectiveStock={5}
      cartQuantities={{}}
      {...overrides}
    />
  )

describe('ProductInfoCard', () => {
  it('renders name, description, category and formatted price', () => {
    renderCard()
    expect(screen.getByRole('heading', { name: 'Test Product' })).toBeInTheDocument()
    expect(screen.getByText('A lovely test product')).toBeInTheDocument()
    expect(screen.getByText('Accessories')).toBeInTheDocument()
    expect(screen.getByText('$199.00')).toBeInTheDocument()
  })

  it('exposes the sold count via a semantic <output> element (S6819)', () => {
    renderCard()
    const sold = screen.getByText(/42 Sold/)
    // <output> is exposed with role="status" implicitly — the JSX must use the
    // semantic element rather than role="status" on a <span>.
    expect(sold.tagName).toBe('OUTPUT')
    expect(sold).toHaveAttribute('aria-label', 'Total units sold: 42')
  })

  it('defaults soldCount to 0 when missing', () => {
    const { soldCount: _drop, ...rest } = baseProduct
    void _drop
    renderCard({ product: rest as Product })
    expect(screen.getByText(/0 Sold/)).toBeInTheDocument()
  })

  it('shows the variant-price modifier copy when a variant is selected', () => {
    const variant: ProductVariant = {
      id: 'v1',
      productId: 'p1',
      sku: null,
      price: 249,
      stock: 5,
      image: null,
      images: [],
      deletedAt: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    }
    renderCard({ selectedVariant: variant })
    expect(screen.getByText('Variant price')).toBeInTheDocument()
  })

  it('omits the variant-price modifier copy when no variant is selected', () => {
    renderCard()
    expect(screen.queryByText('Variant price')).toBeNull()
  })

  it('forwards stock to StockBadge and renders VariantSelector', () => {
    renderCard({ effectiveStock: 7 })
    expect(screen.getByTestId('stock-badge')).toHaveTextContent('stock:7')
    expect(screen.getByTestId('variant-selector')).toBeInTheDocument()
  })
})
