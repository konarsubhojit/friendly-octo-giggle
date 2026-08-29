import { afterEach, describe, expect, it } from 'vitest'

import {
  __resetProviderResolutionForTests,
  getProvider,
} from '@/lib/providers/resolution'
import {
  __resetCatalogSearchClientForTests,
  getSearchCapabilities,
  isSearchAvailable,
} from '@/lib/search'

const env = { ...process.env }

const resetClients = () => {
  __resetProviderResolutionForTests()
  __resetCatalogSearchClientForTests()
}

afterEach(() => {
  process.env = { ...env }
  resetClients()
})

describe('catalog search provider factory', () => {
  it('uses PostgreSQL without external search credentials', () => {
    delete process.env.SEARCH_PROVIDER
    delete process.env.UPSTASH_SEARCH_REST_URL
    delete process.env.UPSTASH_SEARCH_REST_TOKEN
    delete process.env.ALGOLIA_APP_ID
    delete process.env.ALGOLIA_ADMIN_API_KEY
    delete process.env.ALGOLIA_PRODUCTS_INDEX
    resetClients()

    expect(getProvider('search')).toBe('postgres')
    expect(isSearchAvailable()).toBe(true)
    expect(getSearchCapabilities()).toMatchObject({
      provider: 'postgres',
      typoTolerance: false,
    })
  })

  it('uses canonical Algolia credentials without exposing an admin key', () => {
    process.env.SEARCH_PROVIDER = 'algolia'
    process.env.ALGOLIA_APP_ID = 'application-id'
    process.env.ALGOLIA_ADMIN_API_KEY = 'admin-key'
    process.env.ALGOLIA_PRODUCTS_INDEX = 'friendly-products-test'
    resetClients()

    expect(getProvider('search')).toBe('algolia')
    expect(isSearchAvailable()).toBe(true)
    expect(getSearchCapabilities()).toMatchObject({
      provider: 'algolia',
      typoTolerance: true,
      facets: true,
    })
    expect(Object.keys(process.env)).not.toContain(
      'NEXT_PUBLIC_ALGOLIA_ADMIN_API_KEY'
    )
  })
})
