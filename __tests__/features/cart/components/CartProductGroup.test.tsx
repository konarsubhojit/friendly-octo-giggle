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

vi.mock('@/features/cart/components/CartItemRow', () => ({
  CartItemRow: ({
    item,
    customizationNote,
    onUpdateQuantity,
    onRemoveItem,
    onCustomizationChange,
  }: {
    item: { id: string; product: { name: string } }
    customizationNote: string
    onUpdateQuantity: (id: string, qty: number) => void
    onRemoveItem: (id: string) => void
    onCustomizationChange: (id: string, note: string) => void
  }) => (
    <div data-testid={`cart-item-row-${item.id}`}>
      <span>{item.product.name}</span>
      <span data-testid={`note-${item.id}`}>{customizationNote}</span>
      <button onClick={() => onUpdateQuantity(item.id, 3)}>UpdateQty</button>
      <button onClick={() => onRemoveItem(item.id)}>Remove</button>
      <button onClick={() => onCustomizationChange(item.id, 'note')}>
        Note
      </button>
    </div>
  ),
}))

import { CartProductGroup } from '@/features/cart/components/CartProductGroup'
import type { CartItemWithProduct } from '@/lib/types'

const mockFormatPrice = (amount: number) => `₹${amount.toFixed(2)}`

const makeItem = (
  itemId: string,
  variantId: string,
  variantLabel: string | null = null
): CartItemWithProduct => ({
  id: itemId,
  cartId: 'cart1',
  productId: 'prod1',
  variantId,
  quantity: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  variantLabel,
  product: {
    id: 'prod1',
    name: 'Handmade Basket',
    description: 'A basket',
    image: '/img/basket.jpg',
    images: [],
    category: 'Home',
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  variant: {
    id: variantId,
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
})

const defaultProps = {
  updating: null,
  customizationNotes: {},
  formatPrice: mockFormatPrice,
  onUpdateQuantity: vi.fn(),
  onRemoveItem: vi.fn(),
  onCustomizationChange: vi.fn(),
  isLastGroup: false,
}

describe('CartProductGroup', () => {
  describe('single-item group', () => {
    it('delegates to CartItemRow for a single item', () => {
      const item = makeItem('item1', 'v1')
      render(
        <CartProductGroup
          {...defaultProps}
          items={[item]}
          isLastGroup={false}
        />
      )
      expect(screen.getByTestId('cart-item-row-item1')).toBeTruthy()
    })

    it('passes customizationNote to CartItemRow', () => {
      const item = makeItem('item1', 'v1')
      render(
        <CartProductGroup
          {...defaultProps}
          items={[item]}
          customizationNotes={{ item1: 'gift wrap' }}
        />
      )
      expect(screen.getByTestId('note-item1').textContent).toBe('gift wrap')
    })

    it('passes callbacks to CartItemRow', () => {
      const onUpdateQuantity = vi.fn()
      const onRemoveItem = vi.fn()
      const onCustomizationChange = vi.fn()
      const item = makeItem('item1', 'v1')
      render(
        <CartProductGroup
          {...defaultProps}
          items={[item]}
          onUpdateQuantity={onUpdateQuantity}
          onRemoveItem={onRemoveItem}
          onCustomizationChange={onCustomizationChange}
        />
      )

      fireEvent.click(screen.getByText('UpdateQty'))
      expect(onUpdateQuantity).toHaveBeenCalledWith('item1', 3)

      fireEvent.click(screen.getByText('Remove'))
      expect(onRemoveItem).toHaveBeenCalledWith('item1')

      fireEvent.click(screen.getByText('Note'))
      expect(onCustomizationChange).toHaveBeenCalledWith('item1', 'note')
    })
  })

  describe('multi-variant group', () => {
    const items = [
      makeItem('item1', 'v1', 'Color: Red / Size: L'),
      makeItem('item2', 'v2', 'Color: Blue / Size: M'),
    ]

    it('renders product header with product name link and variant count', () => {
      render(
        <CartProductGroup {...defaultProps} items={items} isLastGroup={false} />
      )

      const link = screen.getByRole('link', { name: 'Handmade Basket' })
      expect(link.getAttribute('href')).toBe('/products/prod1')
      expect(screen.getByText('2 variants')).toBeTruthy()
    })

    it('renders variant label for each variant row', () => {
      render(
        <CartProductGroup {...defaultProps} items={items} isLastGroup={false} />
      )

      expect(screen.getByText('Color: Red / Size: L')).toBeTruthy()
      expect(screen.getByText('Color: Blue / Size: M')).toBeTruthy()
    })

    it('renders price for each variant row', () => {
      render(
        <CartProductGroup {...defaultProps} items={items} isLastGroup={false} />
      )

      const prices = screen.getAllByText('₹1299.00')
      expect(prices.length).toBeGreaterThanOrEqual(2)
    })

    it('calls onUpdateQuantity with correct itemId', () => {
      const onUpdateQuantity = vi.fn()
      render(
        <CartProductGroup
          {...defaultProps}
          items={items}
          onUpdateQuantity={onUpdateQuantity}
        />
      )

      const qtySels = screen.getAllByRole('combobox')
      fireEvent.change(qtySels[0], { target: { value: '3' } })
      expect(onUpdateQuantity).toHaveBeenCalledWith('item1', 3)

      fireEvent.change(qtySels[1], { target: { value: '2' } })
      expect(onUpdateQuantity).toHaveBeenCalledWith('item2', 2)
    })

    it('calls onRemoveItem with correct itemId', () => {
      const onRemoveItem = vi.fn()
      render(
        <CartProductGroup
          {...defaultProps}
          items={items}
          onRemoveItem={onRemoveItem}
        />
      )

      const removeButtons = screen.getAllByText('Remove')
      fireEvent.click(removeButtons[0])
      expect(onRemoveItem).toHaveBeenCalledWith('item1')

      fireEvent.click(removeButtons[1])
      expect(onRemoveItem).toHaveBeenCalledWith('item2')
    })

    it('calls onCustomizationChange with correct itemId when note changes', () => {
      const onCustomizationChange = vi.fn()
      render(
        <CartProductGroup
          {...defaultProps}
          items={items}
          onCustomizationChange={onCustomizationChange}
        />
      )

      const noteInputs = screen.getAllByRole('textbox')
      fireEvent.change(noteInputs[0], { target: { value: 'Please gift wrap' } })
      expect(onCustomizationChange).toHaveBeenCalledWith(
        'item1',
        'Please gift wrap'
      )

      fireEvent.change(noteInputs[1], { target: { value: 'No ribbon' } })
      expect(onCustomizationChange).toHaveBeenCalledWith('item2', 'No ribbon')
    })

    it('passes customizationNote for each item from the notes map', () => {
      render(
        <CartProductGroup
          {...defaultProps}
          items={items}
          customizationNotes={{ item1: 'wrap it', item2: 'fast delivery' }}
        />
      )

      const inputs = screen.getAllByRole('textbox')
      expect((inputs[0] as HTMLInputElement).value).toBe('wrap it')
      expect((inputs[1] as HTMLInputElement).value).toBe('fast delivery')
    })
  })
})
