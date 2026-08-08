// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecommendationRail } from '@/features/recommendations/components/RecommendationRail'
import type { RecommendationItem } from '@/features/recommendations/validations'

vi.mock('@/contexts/CurrencyContext', () => ({
  useCurrency: () => ({ formatPrice: (value: number) => `₹${value}` }),
}))

// jsdom ships no IntersectionObserver. The tracker uses it for the one-shot
// impression beacon, which is not what these tests assert, so a null observer
// is enough to let the tree mount.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return []
      }
    }
  )
})

const item = (id: string, name = `Product ${id}`): RecommendationItem => ({
  id,
  name,
  description: 'A product',
  image: `/${id}.jpg`,
  category: 'Kitchen',
  price: 499,
  inStock: true,
})

describe('RecommendationRail', () => {
  it('renders nothing when there are no products', () => {
    const { container } = render(
      <RecommendationRail
        title="You might also like"
        surface="product"
        products={[]}
        fallback={false}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the heading and each product when there are products', () => {
    render(
      <RecommendationRail
        title="You might also like"
        surface="product"
        anchorProductId="aaaaaaa"
        products={[item('bbbbbbb', 'Ceramic Mug'), item('ccccccc', 'Tea Pot')]}
        fallback={false}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'You might also like' })
    ).toBeInTheDocument()
    expect(screen.getByText('Ceramic Mug')).toBeInTheDocument()
    expect(screen.getByText('Tea Pot')).toBeInTheDocument()
  })

  it('does not render the anchor product, which the selection service already excluded', () => {
    render(
      <RecommendationRail
        title="You might also like"
        surface="product"
        anchorProductId="aaaaaaa"
        products={[item('bbbbbbb', 'Ceramic Mug')]}
        fallback={false}
      />
    )

    expect(
      screen.queryByRole('link', { name: /Product aaaaaaa/ })
    ).not.toBeInTheDocument()
  })

  it('renders no stock magnitude or sold count', () => {
    const { container } = render(
      <RecommendationRail
        title="You might also like"
        surface="cart"
        products={[item('bbbbbbb')]}
        fallback={false}
      />
    )

    expect(container.textContent).not.toMatch(/\d+\s*(in stock|left|sold)/i)
    expect(screen.queryByText(/only \d+ left/i)).not.toBeInTheDocument()
  })

  it('formats the price through the currency context rather than a raw symbol', () => {
    render(
      <RecommendationRail
        title="You might also like"
        surface="home"
        products={[item('bbbbbbb')]}
        fallback
      />
    )

    expect(screen.getByText('₹499')).toBeInTheDocument()
  })

  it('links each product to its detail page', () => {
    render(
      <RecommendationRail
        title="You might also like"
        surface="zero_result"
        products={[item('bbbbbbb', 'Ceramic Mug')]}
        fallback={false}
      />
    )

    expect(
      screen.getByRole('link', { name: 'View Ceramic Mug' })
    ).toHaveAttribute('href', '/products/bbbbbbb')
  })
})
