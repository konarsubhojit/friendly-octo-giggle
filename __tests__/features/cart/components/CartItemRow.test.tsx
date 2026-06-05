// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}))

vi.mock('@/components/ui/LoadingSpinner', () => ({
  LoadingSpinner: () => <div data-testid="loading-spinner" />,
}))

import { CartItemRow } from '@/features/cart/components/CartItemRow'
import type { CartItemWithProduct } from '@/lib/types'

const baseItem: CartItemWithProduct = {
  id: 'item1',
  cartId: 'cart1',
  productId: 'prod1',
  variantId: 'v1',
  quantity: 2,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  product: {
    id: 'prod1',
    name: 'Handmade Basket',
    description: 'Beautiful basket',
    image: '/img/basket.jpg',
    images: ['/img/basket.jpg'],
    category: 'Home Decor',
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  variant: {
    id: 'v1',
    productId: 'prod1',
    sku: null,
    price: 999,
    stock: 10,
    image: null,
    images: [],
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
}

const fallbackVariant: NonNullable<CartItemWithProduct['variant']> = {
  id: 'var1',
  productId: 'prod1',
  sku: null,
  price: 1299,
  stock: 5,
  image: null,
  images: [],
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

const mockFormatPrice = (amount: number) => `₹${amount.toFixed(2)}`

describe('CartItemRow', () => {
  it('renders product name as link', () => {
    render(
      <CartItemRow
        item={baseItem}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    const link = screen.getByText('Handmade Basket')
    expect(link.closest('a')?.getAttribute('href')).toBe('/en/products/prod1')
  })

  it('renders product image', () => {
    render(
      <CartItemRow
        item={baseItem}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    expect(screen.getByAltText('Handmade Basket')).toBeTruthy()
  })

  it('renders price and total', () => {
    render(
      <CartItemRow
        item={baseItem}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    expect(screen.getByText('₹999.00')).toBeTruthy()
    expect(screen.getByText('₹1998.00')).toBeTruthy()
  })

  it('renders quantity selector', () => {
    render(
      <CartItemRow
        item={baseItem}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    const select = screen.getByLabelText('Quantity for Handmade Basket')
    expect(select).toBeTruthy()
    expect((select as HTMLSelectElement).value).toBe('2')
  })

  it('calls onUpdateQuantity when quantity changes', () => {
    const onUpdateQuantity = vi.fn()
    render(
      <CartItemRow
        item={baseItem}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={onUpdateQuantity}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    const select = screen.getByLabelText('Quantity for Handmade Basket')
    fireEvent.change(select, { target: { value: '3' } })

    expect(onUpdateQuantity).toHaveBeenCalledWith('item1', 3)
  })

  it('calls onRemoveItem when Remove button is clicked', () => {
    const onRemoveItem = vi.fn()
    render(
      <CartItemRow
        item={baseItem}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={onRemoveItem}
        onCustomizationChange={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText('Remove'))
    expect(onRemoveItem).toHaveBeenCalledWith('item1')
  })

  it('shows loading spinner when updating this item', () => {
    render(
      <CartItemRow
        item={baseItem}
        isLast={false}
        updating="item1"
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    expect(screen.getByTestId('loading-spinner')).toBeTruthy()
    expect(screen.queryByLabelText('Quantity for Handmade Basket')).toBeNull()
  })

  it('renders variant details when present', () => {
    const itemWithVariant: CartItemWithProduct = {
      ...baseItem,
      variantId: 'var1',
      variant: {
        id: 'var1',
        productId: 'prod1',
        sku: 'Crimson - Red',
        price: 1299,
        stock: 5,
        image: '/img/red.jpg',
        images: [],
        deletedAt: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    }

    render(
      <CartItemRow
        item={itemWithVariant}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    expect(screen.getByText('Crimson - Red')).toBeTruthy()
    expect(screen.getByText('₹1299.00')).toBeTruthy()
  })

  it('renders pre-computed variantLabel when provided', () => {
    const itemWithLabel: CartItemWithProduct = {
      ...baseItem,
      variantLabel: 'Color: Red / Size: L',
      variant: {
        id: 'var1',
        productId: 'prod1',
        sku: null,
        price: 1299,
        stock: 5,
        image: null,
        images: [],
        deletedAt: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    }

    render(
      <CartItemRow
        item={itemWithLabel}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    expect(screen.getByText('Color: Red / Size: L')).toBeTruthy()
  })

  it('builds variant label from optionValues and product options', () => {
    const itemWithOptions: CartItemWithProduct = {
      ...baseItem,
      product: {
        ...baseItem.product,
        options: [
          {
            id: 'opt1',
            productId: 'prod1',
            name: 'Color',
            sortOrder: 0,
            createdAt: '2024-01-01T00:00:00Z',
            values: [
              {
                id: 'oval1',
                optionId: 'opt1',
                value: 'Blue',
                sortOrder: 0,
                createdAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
          {
            id: 'opt2',
            productId: 'prod1',
            name: 'Size',
            sortOrder: 1,
            createdAt: '2024-01-01T00:00:00Z',
            values: [
              {
                id: 'oval2',
                optionId: 'opt2',
                value: 'XL',
                sortOrder: 0,
                createdAt: '2024-01-01T00:00:00Z',
              },
            ],
          },
        ],
      },
      variant: {
        id: 'var1',
        productId: 'prod1',
        sku: null,
        price: 1499,
        stock: 3,
        image: null,
        images: [],
        deletedAt: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        optionValues: [
          {
            id: 'oval1',
            optionId: 'opt1',
            value: 'Blue',
            sortOrder: 0,
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            id: 'oval2',
            optionId: 'opt2',
            value: 'XL',
            sortOrder: 0,
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
    }

    render(
      <CartItemRow
        item={itemWithOptions}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    expect(screen.getByText('Color: Blue / Size: XL')).toBeTruthy()
  })

  it('falls back to SKU when no variantLabel or option data is available', () => {
    const itemWithSkuOnly: CartItemWithProduct = {
      ...baseItem,
      variantLabel: undefined,
      product: {
        ...baseItem.product,
        options: undefined,
      },
      variant: {
        ...fallbackVariant,
        sku: 'SKU-123',
        optionValues: undefined,
      },
    }

    render(
      <CartItemRow
        item={itemWithSkuOnly}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    expect(screen.getByText('SKU-123')).toBeTruthy()
  })

  it('renders customization note input', () => {
    render(
      <CartItemRow
        item={baseItem}
        isLast={false}
        updating={null}
        customizationNote="Please gift wrap"
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={vi.fn()}
      />
    )

    const input = screen.getByLabelText(
      'Customization note for Handmade Basket'
    )
    expect((input as HTMLInputElement).value).toBe('Please gift wrap')
  })

  it('calls onCustomizationChange when note changes', () => {
    const onCustomizationChange = vi.fn()
    render(
      <CartItemRow
        item={baseItem}
        isLast={false}
        updating={null}
        customizationNote=""
        formatPrice={mockFormatPrice}
        onUpdateQuantity={vi.fn()}
        onRemoveItem={vi.fn()}
        onCustomizationChange={onCustomizationChange}
      />
    )

    const input = screen.getByLabelText(
      'Customization note for Handmade Basket'
    )
    fireEvent.change(input, { target: { value: 'Blue color' } })

    expect(onCustomizationChange).toHaveBeenCalledWith('item1', 'Blue color')
  })
})
