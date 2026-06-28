// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { Provider } from 'react-redux'
import { configureStore } from '@reduxjs/toolkit'
import WishlistClient from '@/app/[locale]/(public)/wishlist/WishlistClient'
import wishlistReducer from '@/features/wishlist/store/wishlistSlice'
import type { Product } from '@/lib/types'

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: (amount: number) => `₹${amount}` }),
}))

vi.mock('@/components/layout/Footer', () => ({
  default: () => <footer>footer</footer>,
}))

const makeProduct = (id: string, name: string): Product =>
  ({
    id,
    name,
    description: 'A lovely handmade item',
    price: 999,
    image: '/item.jpg',
    images: [],
    stock: 5,
    category: 'Flowers',
    variants: [],
    deletedAt: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  }) as unknown as Product

const renderWishlist = (products: Product[]) => {
  const store = configureStore({ reducer: { wishlist: wishlistReducer } })
  return render(
    <Provider store={store}>
      <WishlistClient
        initialProducts={products}
        initialProductIds={products.map((p) => p.id)}
      />
    </Provider>
  )
}

describe('WishlistClient', () => {
  it('renders the empty state when there are no saved products', () => {
    renderWishlist([])
    expect(screen.getByText('No saved items yet')).toBeInTheDocument()
    expect(screen.getByText('Your wishlist is empty')).toBeInTheDocument()
  })

  it('renders saved products from the server-provided initial data', () => {
    renderWishlist([
      makeProduct('prd0001', 'Knitted Bouquet'),
      makeProduct('prd0002', 'Crochet Bear'),
    ])
    expect(screen.getByText('Knitted Bouquet')).toBeInTheDocument()
    expect(screen.getByText('Crochet Bear')).toBeInTheDocument()
    expect(screen.getByText('2 saved items')).toBeInTheDocument()
  })

  it('uses the singular label for a single saved item', () => {
    renderWishlist([makeProduct('prd0001', 'Knitted Bouquet')])
    expect(screen.getByText('1 saved item')).toBeInTheDocument()
  })
})
