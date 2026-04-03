import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
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

vi.mock('@/features/product/hooks/useRecentlyViewed', () => ({
  useRecentlyViewed: vi.fn(),
}))

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({
    formatPrice: (amount: number) => `₹${amount.toFixed(2)}`,
  }),
}))

vi.mock('@/components/ui/GradientHeading', () => ({
  GradientHeading: ({
    children,
    as: Tag = 'h2',
  }: {
    children: React.ReactNode
    as?: string
  }) => {
    const Element = Tag as keyof JSX.IntrinsicElements
    return <Element>{children}</Element>
  },
}))

import RecentlyViewed from '@/features/product/components/RecentlyViewed'
import { useRecentlyViewed } from '@/features/product/hooks/useRecentlyViewed'

describe('RecentlyViewed', () => {
  it('renders null when no recently viewed products', () => {
    vi.mocked(useRecentlyViewed).mockReturnValue({
      recentlyViewed: [],
      trackProduct: vi.fn(),
      clearHistory: vi.fn(),
    })

    const { container } = render(<RecentlyViewed />)
    expect(container.innerHTML).toBe('')
  })

  it('renders products when available', () => {
    vi.mocked(useRecentlyViewed).mockReturnValue({
      recentlyViewed: [
        {
          id: 'p1',
          name: 'Handmade Basket',
          image: '/img/basket.jpg',
          price: 999,
          category: 'Home',
          viewedAt: Date.now(),
        },
        {
          id: 'p2',
          name: 'Candle Set',
          image: '/img/candle.jpg',
          price: 499,
          category: 'Gifts',
          viewedAt: Date.now(),
        },
      ],
      trackProduct: vi.fn(),
      clearHistory: vi.fn(),
    })

    render(<RecentlyViewed />)

    expect(screen.getByText('Recently Viewed')).toBeTruthy()
    expect(screen.getByText('Handmade Basket')).toBeTruthy()
    expect(screen.getByText('Candle Set')).toBeTruthy()
  })

  it('renders formatted prices', () => {
    vi.mocked(useRecentlyViewed).mockReturnValue({
      recentlyViewed: [
        {
          id: 'p1',
          name: 'Product',
          image: '/img/p.jpg',
          price: 1299,
          category: 'Cat',
          viewedAt: Date.now(),
        },
      ],
      trackProduct: vi.fn(),
      clearHistory: vi.fn(),
    })

    render(<RecentlyViewed />)
    expect(screen.getByText('₹1299.00')).toBeTruthy()
  })

  it('renders links to product pages', () => {
    vi.mocked(useRecentlyViewed).mockReturnValue({
      recentlyViewed: [
        {
          id: 'abc1234',
          name: 'Product',
          image: '/img/p.jpg',
          price: 100,
          category: 'Cat',
          viewedAt: Date.now(),
        },
      ],
      trackProduct: vi.fn(),
      clearHistory: vi.fn(),
    })

    render(<RecentlyViewed />)
    const links = screen.getAllByRole('link')
    const productLink = links.find(
      (l) => l.getAttribute('href') === '/products/abc1234'
    )
    expect(productLink).toBeTruthy()
  })

  it('renders product images with alt text', () => {
    vi.mocked(useRecentlyViewed).mockReturnValue({
      recentlyViewed: [
        {
          id: 'p1',
          name: 'Beautiful Item',
          image: '/img/item.jpg',
          price: 100,
          category: 'Cat',
          viewedAt: Date.now(),
        },
      ],
      trackProduct: vi.fn(),
      clearHistory: vi.fn(),
    })

    render(<RecentlyViewed />)
    const img = screen.getByAltText('Beautiful Item')
    expect(img).toBeTruthy()
  })
})
