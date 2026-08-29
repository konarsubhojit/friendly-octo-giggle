import { getCatalogSearchClient } from './factory'
import type { ProductIndexDocument, ProductSearchResult } from './types'

export const isSearchAvailable = (): boolean =>
  getCatalogSearchClient().isAvailable()

export const getSearchCapabilities = () =>
  getCatalogSearchClient().capabilities()

export const indexProduct = (
  product: ProductIndexDocument,
  options?: { readonly throwOnError?: boolean }
) => getCatalogSearchClient().indexProduct(product, options)

export const indexProducts = (
  products: readonly ProductIndexDocument[],
  options?: { readonly throwOnError?: boolean }
) => getCatalogSearchClient().indexProducts(products, options)

export const removeProduct = (productId: string) =>
  getCatalogSearchClient().removeProduct(productId)

export const searchProducts = (
  query: string,
  options?: { readonly limit?: number; readonly category?: string }
): Promise<ProductSearchResult[]> =>
  getCatalogSearchClient().searchProducts(query, options)

export const resetIndex = (indexName: 'products') =>
  getCatalogSearchClient().resetIndex(indexName)

export const getIndexInfo = (indexName: 'products') =>
  getCatalogSearchClient().getIndexInfo(indexName)
