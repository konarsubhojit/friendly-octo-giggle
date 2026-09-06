export type CatalogSearchProvider = 'postgres' | 'algolia' | 'upstash'

export type ProductContent = {
  name: string
  description: string
  category: string
}

export type ProductMetadata = {
  image: string
}

export interface ProductIndexDocument {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: string
  readonly image: string
}

export interface ProductSearchResult {
  readonly id: string
  readonly score: number
  readonly content: ProductContent
  readonly metadata: ProductMetadata
}

export interface CatalogSearchCapabilities {
  readonly provider: CatalogSearchProvider
  readonly typoTolerance: boolean
  readonly facets: boolean
  readonly highlighting: boolean
  readonly suggestions: boolean
  readonly rankingModes: readonly string[]
}

export interface CatalogSearchClient {
  isAvailable(): boolean
  capabilities(): CatalogSearchCapabilities
  indexProduct(
    product: ProductIndexDocument,
    options?: { readonly throwOnError?: boolean }
  ): Promise<boolean>
  indexProducts(
    products: readonly ProductIndexDocument[],
    options?: { readonly throwOnError?: boolean }
  ): Promise<boolean>
  removeProduct(productId: string): Promise<void>
  searchProducts(
    query: string,
    options?: { readonly limit?: number; readonly category?: string }
  ): Promise<ProductSearchResult[]>
  resetIndex(indexName: 'products'): Promise<void>
  getIndexInfo(indexName: 'products'): Promise<unknown>
}
