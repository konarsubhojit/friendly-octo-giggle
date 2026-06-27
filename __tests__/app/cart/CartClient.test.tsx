// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import CartClient from '@/app/[locale]/(public)/cart/CartClient'
import cartReducer from '@/features/cart/store/cartSlice'
import type { Cart } from '@/lib/types'

const mockUseSession = vi.fn(() => ({ status: 'unauthenticated' }))

vi.mock('next-auth/react', () => ({
  useSession: () => mockUseSession(),
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: (amount: number) => `₹${amount}` }),
}))

const mockCart = {
  id: 'cart0001',
  userId: 'user-1',
  sessionId: null,
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
  items: [
    {
      id: 'citem0001',
      cartId: 'cart0001',
      productId: 'prd0001',
      variantId: 'var0001',
      quantity: 2,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      customizationNote: null,
      product: {
        id: 'prd0001',
        name: 'Hand-knitted Flower Bouquet',
        description: 'Bouquet',
        price: 1499,
        image: '/flower.jpg',
        images: [],
        stock: 10,
        category: 'Flowers',
        deletedAt: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      variant: {
        id: 'var0001',
        productId: 'prd0001',
        sku: null,
        price: 100,
        stock: 10,
        image: null,
        images: [],
        sortOrder: 0,
        deletedAt: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
    },
  ],
} as unknown as Cart

const renderCart = (initialCart: Cart | null) => {
  const store = configureStore({ reducer: { cart: cartReducer } })
  return render(
    <Provider store={store}>
      <CartClient initialCart={initialCart} />
    </Provider>
  )
}

describe('CartClient', () => {
  it('renders the empty state when the server provides no cart', () => {
    renderCart(null)
    expect(screen.getByText('Your cart is empty')).toBeInTheDocument()
  })

  it('renders cart contents from the server-provided initial cart', () => {
    renderCart(mockCart)
    expect(screen.getByText('Shopping Cart')).toBeInTheDocument()
    expect(screen.getByText('Order Summary')).toBeInTheDocument()
    expect(screen.getByText('Hand-knitted Flower Bouquet')).toBeInTheDocument()
  })
})
