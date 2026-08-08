import ProductDetailSkeleton from '@/components/skeletons/ProductDetailSkeleton'

/**
 * Route-level loading UI. Shares the same skeleton the page renders as its
 * `Suspense` fallback so a navigation and a streamed render look identical.
 */
export default function ProductDetailLoading() {
  return <ProductDetailSkeleton />
}
