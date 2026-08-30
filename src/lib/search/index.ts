// Product search: Upstash Search client + cached service layer
export {
  isSearchAvailable,
  getSearchCapabilities,
  indexProduct,
  indexProducts,
  removeProduct,
  searchProducts,
  resetIndex,
  getIndexInfo,
} from './client'
export { __resetCatalogSearchClientForTests } from './factory'
export type {
  CatalogSearchCapabilities,
  CatalogSearchClient,
  CatalogSearchProvider,
  ProductContent,
  ProductIndexDocument,
  ProductMetadata,
  ProductSearchResult,
} from './types'

export { searchProductIds, searchProductIdsCached } from './product-search'
