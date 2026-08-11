import { describe, expect, it, vi, beforeEach } from 'vitest'

const searchProductIdsCachedMock = vi.hoisted(() => vi.fn())
const searchProductIdsMock = vi.hoisted(() => vi.fn())
const findMinimalByIdsMock = vi.hoisted(() => vi.fn())
const findByIdMock = vi.hoisted(() => vi.fn())
const productsFindManyMock = vi.hoisted(() => vi.fn())
const productsFindFirstMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/search', () => ({
  searchProductIdsCached: searchProductIdsCachedMock,
  searchProductIds: searchProductIdsMock,
}))

vi.mock('@/lib/db', () => ({
  db: {
    products: {
      findMinimalByIds: findMinimalByIdsMock,
      findById: findByIdMock,
    },
  },
  drizzleDb: {
    query: {
      products: {
        findMany: productsFindManyMock,
        findFirst: productsFindFirstMock,
      },
    },
  },
}))

import { dispatchToolCall } from '@/features/ai/services/chat-tools'
import {
  GetProductDetailsArgs,
  SearchCatalogArgs,
} from '@/features/ai/services/chat-tools-catalog'

const toolContext = {
  identity: { userId: 'user-1', isAuthenticated: true },
  currencyCode: 'INR' as const,
  formatPrice: (priceInINR: number) => `₹${priceInINR}`,
}

describe('chat-tools-catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchProductIdsCachedMock.mockResolvedValue(['prod-1', 'prod-2'])
    searchProductIdsMock.mockResolvedValue(null)
    findMinimalByIdsMock.mockResolvedValue([
      {
        id: 'prod-1',
        name: 'Travel Bag',
        category: 'bags',
        description: 'A durable travel bag',
        price: 1999,
        stock: 9,
      },
    ])
    findByIdMock.mockResolvedValue(null)
    productsFindManyMock.mockResolvedValue([])
    productsFindFirstMock.mockResolvedValue({
      id: 'prod-1',
      name: 'Travel Bag',
      category: 'bags',
      description: 'A durable travel bag',
      variants: [{ price: 1999, stock: 9 }],
    })
  })

  it('validates search_catalog argument bounds', () => {
    expect(
      SearchCatalogArgs.safeParse({
        query: 'bags',
        limit: 8,
      }).success
    ).toBe(true)
    expect(
      SearchCatalogArgs.safeParse({
        query: '',
      }).success
    ).toBe(false)
    expect(
      SearchCatalogArgs.safeParse({
        query: 'bags',
        limit: 9,
      }).success
    ).toBe(false)
  })

  it('validates get_product_details lookup bounds', () => {
    expect(
      GetProductDetailsArgs.safeParse({
        productIdsOrNames: ['prod-1', 'prod-2', 'prod-3', 'prod-4'],
      }).success
    ).toBe(true)
    expect(
      GetProductDetailsArgs.safeParse({
        productIdsOrNames: [],
      }).success
    ).toBe(false)
    expect(
      GetProductDetailsArgs.safeParse({
        productIdsOrNames: ['1', '2', '3', '4', '5'],
      }).success
    ).toBe(false)
  })

  it('searches grounded catalog products and excludes missing/deleted ids', async () => {
    const output = await dispatchToolCall(
      'search_catalog',
      { query: 'travel bag', limit: 6 },
      toolContext
    )

    expect(searchProductIdsCachedMock).toHaveBeenCalledWith('travel bag', {
      limit: 6,
      category: undefined,
    })
    expect(findMinimalByIdsMock).toHaveBeenCalledWith(
      ['prod-1', 'prod-2'],
      undefined
    )
    expect(output).toContain('[Travel Bag](/products/prod-1)')
    expect(output).not.toContain('prod-2')
    expect(output).not.toMatch(/\b9\b.*stock/i)
  })

  it('falls back to direct product lookup details when requested', async () => {
    findByIdMock.mockResolvedValueOnce({
      id: 'prod-1',
      name: 'Travel Bag',
      category: 'bags',
      description: 'A durable travel bag',
      variants: [{ price: 1999, stock: 2 }],
    })

    const output = await dispatchToolCall(
      'get_product_details',
      { productIdsOrNames: ['prod-1'] },
      toolContext
    )

    expect(findByIdMock).toHaveBeenCalledWith('prod-1', false)
    expect(output).toContain('[Travel Bag](/products/prod-1)')
    expect(output).toContain('Price: ₹1999')
    expect(output).toContain('Availability: Low Stock')
    expect(output).not.toMatch(/\b2\b.*stock/i)
  })
})
