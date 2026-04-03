// Product search: Upstash Search client + cached service layer
export {
  isSearchAvailable,
  indexProduct,
  indexProducts,
  removeProduct,
  searchProducts,
  resetIndex,
  getIndexInfo,
} from './client'
export type {
  ProductSearchResult,
  ProductContent,
  ProductMetadata,
} from './client'

export { searchProductIds, searchProductIdsCached } from './product-search'
