import { describe, it, expect, vi, beforeEach } from 'vitest'

const revalidateTagMock = vi.fn()
const logErrorMock = vi.fn()

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTagMock(...args),
}))

vi.mock('@/lib/logger', () => ({
  logError: (...args: unknown[]) => logErrorMock(...args),
}))

describe('cache tag helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds an entity-keyed product tag', async () => {
    const { productTag } = await import('@/lib/cache-tags')
    expect(productTag('abc1234')).toBe('product:abc1234')
  })

  it('exposes stable listing tags', async () => {
    const { productListTag, bestsellersTag, categoriesTag } = await import(
      '@/lib/cache-tags'
    )
    expect(productListTag()).toBe('products:list')
    expect(bestsellersTag()).toBe('products:bestsellers')
    expect(categoriesTag()).toBe('categories:list')
  })

  it('declares the cache-life profiles used by cached scopes', async () => {
    const { CACHE_LIFE_PROFILES } = await import('@/lib/cache-tags')
    expect(CACHE_LIFE_PROFILES).toEqual({
      CATALOG: 'catalog',
      PRODUCT: 'product',
      TAXONOMY: 'taxonomy',
    })
  })
})

describe('revalidateCacheTags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('revalidates each tag with its cache-life profile', async () => {
    const {
      revalidateCacheTags,
      productTag,
      productListTag,
      bestsellersTag,
      categoriesTag,
    } = await import('@/lib/cache-tags')

    revalidateCacheTags(
      [productTag('p1'), productListTag(), bestsellersTag(), categoriesTag()],
      'product_update'
    )

    expect(revalidateTagMock.mock.calls).toEqual([
      ['product:p1', 'product'],
      ['products:list', 'catalog'],
      ['products:bestsellers', 'catalog'],
      ['categories:list', 'taxonomy'],
    ])
  })

  it('de-duplicates repeated ids so a tag is revalidated once', async () => {
    const { revalidateCacheTags, productTag } = await import('@/lib/cache-tags')

    revalidateCacheTags(
      [productTag('p1'), productTag('p1'), productTag('p2')],
      'bulk_update'
    )

    expect(revalidateTagMock).toHaveBeenCalledTimes(2)
    expect(revalidateTagMock).toHaveBeenCalledWith('product:p1', 'product')
    expect(revalidateTagMock).toHaveBeenCalledWith('product:p2', 'product')
  })

  it('ignores empty tag values', async () => {
    const { revalidateCacheTags } = await import('@/lib/cache-tags')

    revalidateCacheTags(['', 'products:list'], 'product_create')

    expect(revalidateTagMock).toHaveBeenCalledTimes(1)
    expect(revalidateTagMock).toHaveBeenCalledWith('products:list', 'catalog')
  })

  it('logs a failing revalidation with operation context and does not throw', async () => {
    const { revalidateCacheTags, productTag } = await import('@/lib/cache-tags')
    revalidateTagMock.mockImplementationOnce(() => {
      throw new Error('outside of a request scope')
    })

    expect(() =>
      revalidateCacheTags(
        [productTag('p1'), productTag('p2')],
        'product_delete'
      )
    ).not.toThrow()

    expect(logErrorMock).toHaveBeenCalledTimes(1)
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        context: 'cache_tag_revalidation',
        additionalInfo: { tag: 'product:p1', operation: 'product_delete' },
      })
    )
    // A failure on one tag must not stop the remaining tags.
    expect(revalidateTagMock).toHaveBeenCalledTimes(2)
  })
})
