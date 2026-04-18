// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { VariantButton } from '@/features/product/components/VariantButton'
import type { ProductVariant } from '@/lib/types'

const baseVariant: ProductVariant = {
  id: 'var1',
  productId: 'prod1',
  sku: null,
  image: null,
  images: [],
  price: 499,
  stock: 10,
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockFormatPrice = (amount: number) => `₹${amount.toFixed(2)}`

describe('VariantButton', () => {
  it('renders label and formatted price', () => {
    render(
      <VariantButton
        variant={baseVariant}
        label="Red"
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Red')).toBeTruthy()
    expect(screen.getByText('₹499.00')).toBeTruthy()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(
      <VariantButton
        variant={baseVariant}
        label="Red"
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={onSelect}
      />
    )

    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(baseVariant)
  })

  it('shows low stock warning when stock < 6', () => {
    const lowStockVariant = { ...baseVariant, stock: 3 }
    render(
      <VariantButton
        variant={lowStockVariant}
        label="Low Stock"
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText('Only 3 left')).toBeTruthy()
  })

  it('does not show low stock when stock >= 6', () => {
    render(
      <VariantButton
        variant={baseVariant}
        label="Red"
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByText(/Only \d+ left/)).toBeNull()
  })

  it('does not show low stock when stock is 0', () => {
    const outOfStock = { ...baseVariant, stock: 0 }
    render(
      <VariantButton
        variant={outOfStock}
        label="Out of Stock"
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />
    )

    expect(screen.queryByText(/Only \d+ left/)).toBeNull()
  })

  it('shows cart quantity badge when cartQuantity > 0', () => {
    render(
      <VariantButton
        variant={baseVariant}
        label="Red"
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
        cartQuantity={3}
      />
    )

    expect(screen.getByText('3 in cart')).toBeTruthy()
  })

  it('does not show cart quantity when cartQuantity is 0', () => {
    render(
      <VariantButton
        variant={baseVariant}
        label="Red"
        isSelected={false}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
        cartQuantity={0}
      />
    )

    expect(screen.queryByText(/in cart/)).toBeNull()
  })

  it('applies selected styles when isSelected is true', () => {
    render(
      <VariantButton
        variant={baseVariant}
        label="Red"
        isSelected={true}
        formatPrice={mockFormatPrice}
        onSelect={vi.fn()}
      />
    )

    const button = screen.getByRole('button')
    expect(button.className).toContain('scale-105')
    expect(button.className).toContain('shadow-warm')
  })
})
