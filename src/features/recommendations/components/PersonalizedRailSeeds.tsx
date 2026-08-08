'use client'

import { useEffect, useState } from 'react'
import { useRecentlyViewed } from '@/features/product/hooks/useRecentlyViewed'
import { RecommendationRail } from '@/features/recommendations/components/RecommendationRail'
import RecommendationRailSkeleton from '@/components/skeletons/RecommendationRailSkeleton'
import type { RecommendationResult } from '@/features/recommendations/validations'

const TITLE = 'Picked for you'

/**
 * The personalised `/shop` rail.
 *
 * A Client Component out of necessity rather than preference: its recently
 * viewed seeds live in `localStorage` and are simply not available on the
 * server. The rail sits below the fold, so the extra round trip cannot affect
 * the page's Largest Contentful Paint.
 *
 * The seeds are sent as a query parameter and never persisted. A guest gets
 * the anonymous bestseller rail without any per-user read taking place.
 */
export function PersonalizedRailSeeds() {
  const { recentlyViewed } = useRecentlyViewed()
  const [result, setResult] = useState<RecommendationResult | null>(null)

  const seeds = recentlyViewed.map((product) => product.id).join(',')

  useEffect(() => {
    const controller = new AbortController()
    const query = seeds ? `?seeds=${encodeURIComponent(seeds)}` : ''

    fetch(`/api/recommendations/personalized${query}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (body?.success) setResult(body.data as RecommendationResult)
      })
      .catch(() => {
        // A failed rail is not a failed page: leave the skeleton's slot empty
        // rather than surfacing an error over the catalog.
      })

    return () => controller.abort()
  }, [seeds])

  if (!result) return <RecommendationRailSkeleton title={TITLE} />

  return (
    <RecommendationRail
      title={TITLE}
      surface="home"
      products={result.products}
      fallback={result.fallback}
    />
  )
}
