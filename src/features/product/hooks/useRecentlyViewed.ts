'use client'

import { useCallback } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

const RECENTLY_VIEWED_KEY = 'kiyon_recently_viewed'
const RECENTLY_VIEWED_MAX = 12

export interface RecentlyViewedProduct {
  id: string
  name: string
  image: string
  price: number
  category: string
  viewedAt: number
}

export const useRecentlyViewed = (): {
  recentlyViewed: RecentlyViewedProduct[]
  trackProduct: (product: RecentlyViewedProduct) => void
  clearHistory: () => void
} => {
  const [recentlyViewed, setRecentlyViewed] = useLocalStorage<
    RecentlyViewedProduct[]
  >(RECENTLY_VIEWED_KEY, [])

  const trackProduct = useCallback(
    (product: RecentlyViewedProduct) => {
      setRecentlyViewed((prev) => {
        const filtered = prev.filter((p) => p.id !== product.id)
        return [{ ...product, viewedAt: Date.now() }, ...filtered].slice(
          0,
          RECENTLY_VIEWED_MAX
        )
      })
    },
    [setRecentlyViewed]
  )

  const clearHistory = useCallback(() => {
    setRecentlyViewed([])
  }, [setRecentlyViewed])

  return { recentlyViewed, trackProduct, clearHistory }
}
