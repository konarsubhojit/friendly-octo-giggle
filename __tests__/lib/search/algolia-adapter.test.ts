import { afterEach, describe, expect, it, vi } from 'vitest'

const { mockSearchSingleIndex, mockSaveObjects } = vi.hoisted(() => ({
  mockSearchSingleIndex: vi.fn(),
  mockSaveObjects: vi.fn(),
}))

vi.mock('algoliasearch', () => ({
  algoliasearch: vi.fn(() => ({
    saveObjects: mockSaveObjects,
    searchSingleIndex: mockSearchSingleIndex,
  })),
}))

import { AlgoliaCatalogSearchClient } from '@/lib/search/algolia-adapter'

const env = { ...process.env }

afterEach(() => {
  process.env = { ...env }
  vi.clearAllMocks()
})

describe('AlgoliaCatalogSearchClient', () => {
  it('uses canonical credentials, maps hits, and applies category filters', async () => {
    process.env.ALGOLIA_APP_ID = 'app-id'
    process.env.ALGOLIA_ADMIN_API_KEY = 'admin-key'
    process.env.ALGOLIA_PRODUCTS_INDEX = 'friendly-products-test'
    mockSearchSingleIndex.mockResolvedValue({
      hits: [
        {
          objectID: 'p1',
          name: 'Cotton Shirt',
          description: 'Soft cotton',
          category: 'Clothing',
          image: '/shirt.jpg',
        },
      ],
    })
    const client = new AlgoliaCatalogSearchClient()

    await expect(
      client.searchProducts('cotton', { limit: 5, category: 'Clothing' })
    ).resolves.toEqual([
      {
        id: 'p1',
        score: 1,
        content: {
          name: 'Cotton Shirt',
          description: 'Soft cotton',
          category: 'Clothing',
        },
        metadata: { image: '/shirt.jpg' },
      },
    ])

    expect(mockSearchSingleIndex).toHaveBeenCalledWith({
      indexName: 'friendly-products-test',
      searchParams: {
        query: 'cotton',
        hitsPerPage: 5,
        filters: 'category:"Clothing"',
        attributesToHighlight: ['name', 'description'],
      },
    })
  })

  it('batches idempotent object upserts at the provider limit', async () => {
    process.env.ALGOLIA_APP_ID = 'app-id'
    process.env.ALGOLIA_ADMIN_API_KEY = 'admin-key'
    process.env.ALGOLIA_PRODUCTS_INDEX = 'friendly-products-test'
    mockSaveObjects.mockResolvedValue({})
    const client = new AlgoliaCatalogSearchClient()
    const products = Array.from({ length: 1001 }, (_, index) => ({
      id: `p${index}`,
      name: 'Product',
      description: 'Description',
      category: 'Category',
      image: '/image.jpg',
    }))

    await expect(client.indexProducts(products)).resolves.toBe(true)
    expect(mockSaveObjects).toHaveBeenCalledTimes(2)
    expect(mockSaveObjects.mock.calls[0]?.[0].objects).toHaveLength(1000)
    expect(mockSaveObjects.mock.calls[1]?.[0].objects).toHaveLength(1)
  })
})
