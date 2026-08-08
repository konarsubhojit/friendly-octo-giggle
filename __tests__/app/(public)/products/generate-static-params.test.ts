import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFindBestsellers = vi.fn()
const mockFindById = vi.fn()
const mockLogError = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    products: {
      findBestsellers: mockFindBestsellers,
      findById: mockFindById,
    },
  },
}))

// `"use cache"` is an inert string literal under Vitest, but `cacheLife` and
// `cacheTag` throw when called outside a real cache scope.
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logError: mockLogError,
}))

vi.mock('@/lib/edge-config', () => ({
  isAiEnabled: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/app/(public)/products/[id]/ProductClient', () => ({
  default: () => null,
}))

const importPage = async () =>
  import('@/app/(public)/products/[id]/page') as Promise<{
    generateStaticParams: () => Promise<Array<{ id: string }>>
    generateMetadata: (args: {
      params: Promise<{ id: string }>
    }) => Promise<{ title?: string }>
  }>

/**
 * The prerendered product set (FR-011) and its build-time degradation
 * (spec US4 acceptance 3). Cache Components rejects an empty
 * `generateStaticParams`, so "prerender nothing" is expressed as a single
 * stand-in id that no real product can hold.
 */
describe('products/[id] generateStaticParams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prerenders a bounded set of bestseller ids without the Redis cache', async () => {
    mockFindBestsellers.mockResolvedValue([
      { id: 'aaaaaaa' },
      { id: 'bbbbbbb' },
    ])

    const { generateStaticParams } = await importPage()
    const params = await generateStaticParams()

    expect(mockFindBestsellers).toHaveBeenCalledWith({
      limit: 20,
      withCache: false,
    })
    expect(params).toEqual([{ id: 'aaaaaaa' }, { id: 'bbbbbbb' }])
  })

  it('degrades to the stand-in id when the database is unreachable', async () => {
    mockFindBestsellers.mockRejectedValue(new Error('connection refused'))

    const { generateStaticParams } = await importPage()
    const params = await generateStaticParams()

    expect(params).toEqual([{ id: '__no_products__' }])
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'product_static_params' })
    )
  })

  it('degrades to the stand-in id when the catalog is empty', async () => {
    mockFindBestsellers.mockResolvedValue([])

    const { generateStaticParams } = await importPage()
    const params = await generateStaticParams()

    expect(params).toEqual([{ id: '__no_products__' }])
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it('resolves the stand-in id without querying the database', async () => {
    const { generateMetadata } = await importPage()
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: '__no_products__' }),
    })

    expect(metadata).toEqual({ title: 'Product Not Found' })
    expect(mockFindById).not.toHaveBeenCalled()
  })

  it('reads a real product id through the cached scope', async () => {
    mockFindById.mockResolvedValue({
      id: 'ccccccc',
      name: 'Daisy Chain',
      description: 'A long description for the metadata field.',
    })

    const { generateMetadata } = await importPage()
    const metadata = await generateMetadata({
      params: Promise.resolve({ id: 'ccccccc' }),
    })

    expect(mockFindById).toHaveBeenCalledWith('ccccccc', false)
    expect(metadata.title).toContain('Daisy Chain')
  })
})
