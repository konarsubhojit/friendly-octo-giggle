import { searchRankedProducts } from './postgres-ranking'
import type {
  CatalogSearchCapabilities,
  CatalogSearchClient,
  ProductIndexDocument,
  ProductSearchResult,
} from './types'

const capabilities: CatalogSearchCapabilities = {
  provider: 'postgres',
  // similarity() from pg_trgm backs the ranked query, so typo tolerance is real.
  typoTolerance: true,
  facets: false,
  // ts_headline could provide this, but it is not implemented.
  highlighting: false,
  suggestions: false,
  rankingModes: ['relevance'],
}

export class PostgresCatalogSearchClient implements CatalogSearchClient {
  isAvailable(): boolean {
    return true
  }

  capabilities(): CatalogSearchCapabilities {
    return capabilities
  }

  async indexProduct(_product: ProductIndexDocument): Promise<boolean> {
    return true
  }

  async indexProducts(
    _products: readonly ProductIndexDocument[]
  ): Promise<boolean> {
    return true
  }

  async removeProduct(_productId: string): Promise<void> {}

  async searchProducts(
    query: string,
    options: { readonly limit?: number; readonly category?: string } = {}
  ): Promise<ProductSearchResult[]> {
    const rows = await searchRankedProducts(query, {
      limit: options.limit,
      category: options.category,
    })

    return rows.map((row) => ({
      id: row.id,
      score: row.score,
      content: {
        name: row.name,
        description: row.description,
        category: row.category,
      },
      metadata: { image: row.image },
    }))
  }

  async resetIndex(_indexName: 'products'): Promise<void> {}

  async getIndexInfo(_indexName: 'products'): Promise<unknown> {
    return { provider: 'postgres', indexed: false }
  }
}
