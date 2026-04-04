import { describe, it, expect } from 'vitest'
import { buildProductContext, trimHistory } from '@/lib/ai/product-rag'
import type { Product } from '@/lib/types'

const baseProduct: Product = {
  id: 'abc1234',
  name: 'Handmade Basket',
  description: 'A beautiful handmade basket crafted with care.',
  price: 29.99,
  image: '/img/basket.jpg',
  images: ['/img/basket.jpg'],
  stock: 10,
  category: 'Home Decor',
  deletedAt: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
}

describe('buildProductContext', () => {
  it('includes basic product information', () => {
    const context = buildProductContext(baseProduct)

    expect(context).toContain('Name: Handmade Basket')
    expect(context).toContain('Category: Home Decor')
    expect(context).toContain('Price (INR): ₹29.99')
    expect(context).toContain('Stock: 10 units')
  })

  it('includes description', () => {
    const context = buildProductContext(baseProduct)
    expect(context).toContain(
      'Description: A beautiful handmade basket crafted with care.'
    )
  })

  it('truncates long descriptions to 400 chars', () => {
    const longDesc = 'A'.repeat(500)
    const product = { ...baseProduct, description: longDesc }
    const context = buildProductContext(product)

    const descLine = context
      .split('\n')
      .find((l) => l.startsWith('Description:'))
    expect(descLine).toBeDefined()
    expect(descLine!.length).toBeLessThan(420)
    expect(descLine).toContain('…')
  })

  it('shows out of stock message when stock is 0', () => {
    const product = { ...baseProduct, stock: 0 }
    const context = buildProductContext(product)
    expect(context).toContain('Out of stock')
  })

  it('includes variations when present', () => {
    const product: Product = {
      ...baseProduct,
      variations: [
        {
          id: 'var1',
          productId: 'abc1234',
          styleId: null,
          name: 'Red',
          designName: 'Crimson',
          variationType: 'colour',
          image: null,
          images: [],
          price: 34.99,
          stock: 5,
          deletedAt: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'var2',
          productId: 'abc1234',
          styleId: null,
          name: 'Modern',
          designName: 'Minimalist',
          variationType: 'styling',
          image: null,
          images: [],
          price: 39.99,
          stock: 0,
          deletedAt: null,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ],
    }

    const context = buildProductContext(product)
    expect(context).toContain('Variations (2):')
    expect(context).toContain('[Colour] Red / Crimson: ₹34.99, 5 in stock')
    expect(context).toContain(
      '[Styling] Modern / Minimalist: ₹39.99, out of stock'
    )
  })

  it('does not include variations section when empty', () => {
    const context = buildProductContext(baseProduct)
    expect(context).not.toContain('Variations')
  })

  it('uses provided currency formatter and code when supplied', () => {
    const context = buildProductContext(baseProduct, {
      currencyCode: 'USD',
      formatPrice: (price) => `USD-${price.toFixed(1)}`,
    })

    expect(context).toContain('Price (USD): USD-30.0')
  })
})

describe('trimHistory', () => {
  const messages = [
    { role: 'user', content: 'msg1' },
    { role: 'assistant', content: 'msg2' },
    { role: 'user', content: 'msg3' },
    { role: 'assistant', content: 'msg4' },
    { role: 'user', content: 'msg5' },
  ]

  it('returns all messages when within limit', () => {
    const result = trimHistory(messages, 10)
    expect(result).toEqual(messages)
    expect(result).toBe(messages)
  })

  it('returns exact count when at limit', () => {
    const result = trimHistory(messages, 5)
    expect(result).toBe(messages)
  })

  it('trims oldest messages keeping the most recent', () => {
    const result = trimHistory(messages, 3)
    expect(result).toHaveLength(3)
    expect(result[0].content).toBe('msg3')
    expect(result[2].content).toBe('msg5')
  })

  it('returns single message when max is 1', () => {
    const result = trimHistory(messages, 1)
    expect(result).toHaveLength(1)
    expect(result[0].content).toBe('msg5')
  })

  it('works with empty array', () => {
    const result = trimHistory([], 5)
    expect(result).toEqual([])
  })
})
