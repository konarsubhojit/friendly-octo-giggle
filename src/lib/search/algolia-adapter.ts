import { algoliasearch } from 'algoliasearch'
import { logError } from '@/lib/logger'
import type {
  CatalogSearchCapabilities,
  CatalogSearchClient,
  ProductIndexDocument,
  ProductSearchResult,
} from './types'

const BATCH_SIZE = 1000

const capabilities: CatalogSearchCapabilities = {
  provider: 'algolia',
  typoTolerance: true,
  facets: true,
  highlighting: true,
  suggestions: true,
  rankingModes: [
    'relevance',
    'price_asc',
    'price_desc',
    'newest',
    'best_selling',
    'top_rated',
  ],
}

const credentials = () => ({
  appId: process.env.ALGOLIA_APP_ID,
  adminKey: process.env.ALGOLIA_ADMIN_API_KEY ?? process.env.ALGOLIA_API_KEY,
  indexName:
    process.env.ALGOLIA_PRODUCTS_INDEX ?? process.env.ALGOLIA_INDEX_NAME,
})

export class AlgoliaCatalogSearchClient implements CatalogSearchClient {
  isAvailable(): boolean {
    const { appId, adminKey, indexName } = credentials()
    return Boolean(appId?.trim() && adminKey?.trim() && indexName?.trim())
  }

  capabilities(): CatalogSearchCapabilities {
    return capabilities
  }

  private getClient() {
    const { appId, adminKey } = credentials()
    if (!appId || !adminKey) throw new Error('Algolia is not configured')
    return algoliasearch(appId, adminKey)
  }

  private getIndexName(): string {
    const { indexName } = credentials()
    if (!indexName) throw new Error('Algolia is not configured')
    return indexName
  }

  async indexProduct(
    product: ProductIndexDocument,
    options?: { readonly throwOnError?: boolean }
  ): Promise<boolean> {
    return this.indexProducts([product], options)
  }

  async indexProducts(
    products: readonly ProductIndexDocument[],
    options: { readonly throwOnError?: boolean } = {}
  ): Promise<boolean> {
    if (!this.isAvailable()) return false
    if (products.length === 0) return true

    try {
      const client = this.getClient()
      const indexName = this.getIndexName()
      for (let offset = 0; offset < products.length; offset += BATCH_SIZE) {
        await client.saveObjects({
          indexName,
          objects: products
            .slice(offset, offset + BATCH_SIZE)
            .map((product) => ({
              objectID: product.id,
              ...product,
            })),
          waitForTasks: true,
        })
      }
      return true
    } catch (error) {
      logError({
        error,
        context: 'search',
        additionalInfo: { operation: 'algolia:indexProducts' },
      })
      if (options.throwOnError) throw error
      return false
    }
  }

  async removeProduct(productId: string): Promise<void> {
    if (!this.isAvailable()) return
    try {
      await this.getClient().deleteObject({
        indexName: this.getIndexName(),
        objectID: productId,
      })
    } catch (error) {
      logError({
        error,
        context: 'search',
        additionalInfo: { operation: 'algolia:removeProduct', id: productId },
      })
    }
  }

  async searchProducts(
    query: string,
    options: { readonly limit?: number; readonly category?: string } = {}
  ): Promise<ProductSearchResult[]> {
    if (!this.isAvailable()) return []
    try {
      const result = await this.getClient().searchSingleIndex({
        indexName: this.getIndexName(),
        searchParams: {
          query,
          hitsPerPage: options.limit ?? 20,
          ...(options.category?.trim()
            ? {
                filters: `category:"${options.category
                  .trim()
                  .replaceAll('"', '\\"')}"`,
              }
            : {}),
          attributesToHighlight: ['name', 'description'],
        },
      })

      return result.hits.map((hit) => {
        const product = hit as typeof hit & Partial<ProductIndexDocument>
        return {
          id: String(hit.objectID),
          score: 1,
          content: {
            name: product.name ?? '',
            description: product.description ?? '',
            category: product.category ?? '',
          },
          metadata: { image: product.image ?? '' },
        }
      })
    } catch (error) {
      logError({
        error,
        context: 'search',
        additionalInfo: { operation: 'algolia:searchProducts', query },
      })
      return []
    }
  }

  async resetIndex(_indexName: 'products'): Promise<void> {
    if (!this.isAvailable()) return
    try {
      await this.getClient().clearObjects({ indexName: this.getIndexName() })
    } catch (error) {
      logError({
        error,
        context: 'search',
        additionalInfo: { operation: 'algolia:resetIndex' },
      })
    }
  }

  async getIndexInfo(_indexName: 'products'): Promise<unknown> {
    if (!this.isAvailable()) throw new Error('Algolia is not configured')
    return this.getClient().getSettings({ indexName: this.getIndexName() })
  }
}
