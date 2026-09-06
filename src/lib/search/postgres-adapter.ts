import { db } from '@/lib/db'
import type {
  CatalogSearchCapabilities,
  CatalogSearchClient,
  ProductIndexDocument,
  ProductSearchResult,
} from './types'

const capabilities: CatalogSearchCapabilities = {
  provider: 'postgres',
  typoTolerance: false,
  facets: false,
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
    const products = await db.products.findAllMinimal({
      search: query,
      category: options.category?.trim() || undefined,
      limit: options.limit ?? 20,
      offset: 0,
    })

    return products.map((product) => ({
      id: product.id,
      score: 1,
      content: {
        name: product.name,
        description: product.description,
        category: product.category,
      },
      metadata: { image: product.image },
    }))
  }

  async resetIndex(_indexName: 'products'): Promise<void> {}

  async getIndexInfo(_indexName: 'products'): Promise<unknown> {
    return { provider: 'postgres', indexed: false }
  }
}
