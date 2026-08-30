import { getProvider } from '@/lib/providers/resolution'
import { AlgoliaCatalogSearchClient } from './algolia-adapter'
import { PostgresCatalogSearchClient } from './postgres-adapter'
import * as upstash from './upstash-adapter'
import type {
  CatalogSearchCapabilities,
  CatalogSearchClient,
  ProductIndexDocument,
  ProductSearchResult,
} from './types'

class UpstashCatalogSearchClient implements CatalogSearchClient {
  isAvailable = upstash.isSearchAvailable

  capabilities(): CatalogSearchCapabilities {
    return {
      provider: 'upstash',
      typoTolerance: true,
      facets: false,
      highlighting: false,
      suggestions: false,
      rankingModes: ['relevance'],
    }
  }

  indexProduct = upstash.indexProduct
  indexProducts = upstash.indexProducts
  removeProduct = upstash.removeProduct
  searchProducts = upstash.searchProducts as (
    query: string,
    options?: { readonly limit?: number; readonly category?: string }
  ) => Promise<ProductSearchResult[]>
  resetIndex = upstash.resetIndex
  getIndexInfo = upstash.getIndexInfo
}

let client: CatalogSearchClient | undefined

export const getCatalogSearchClient = (): CatalogSearchClient => {
  client ??= (() => {
    switch (getProvider('search')) {
      case 'algolia':
        return new AlgoliaCatalogSearchClient()
      case 'upstash':
        return new UpstashCatalogSearchClient()
      case 'postgres':
        return new PostgresCatalogSearchClient()
      default:
        throw new Error('Unknown catalog search provider')
    }
  })()
  return client
}

export const __resetCatalogSearchClientForTests = (): void => {
  client = undefined
}

export type { ProductIndexDocument }
