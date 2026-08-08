'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCurrency } from '@/contexts/CurrencyContext'
import { PRODUCT_CARD_BLUR_DATA_URL } from '@/lib/image-placeholder'
import type {
  RecommendationItem,
  RecommendationSurface,
} from '@/features/recommendations/validations'

interface RecommendationTrackerProps {
  readonly surface: RecommendationSurface
  readonly anchorProductId: string | null
  readonly products: readonly RecommendationItem[]
  readonly fallback: boolean
}

type EventType = 'impression' | 'click'

/**
 * Fire an analytics beacon.
 *
 * `sendBeacon` survives the navigation a click triggers, which `fetch` does
 * not; the `fetch` path exists only for browsers without it. Failures are
 * swallowed deliberately — analytics must never surface an error to a shopper.
 */
const sendEvent = (
  type: EventType,
  surface: RecommendationSurface,
  anchorProductId: string | null,
  productIds: readonly string[],
  fallback: boolean
): void => {
  const payload = JSON.stringify({
    type,
    surface,
    anchorProductId,
    productIds,
    fallback,
  })

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/recommendations/event',
        new Blob([payload], { type: 'application/json' })
      )
      return
    }

    void fetch('/api/recommendations/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Ignored: a dropped analytics event is not worth a broken rail.
  }
}

/**
 * The interactive leaf of a recommendation rail.
 *
 * Owns everything that genuinely needs the browser: currency formatting via
 * `useCurrency`, the click beacons, and the one-shot impression beacon fired
 * when the rail first scrolls into view. The surrounding rail stays a Server
 * Component.
 */
export function RecommendationTracker({
  surface,
  anchorProductId,
  products,
  fallback,
}: RecommendationTrackerProps) {
  const { formatPrice } = useCurrency()
  const listRef = useRef<HTMLUListElement>(null)
  const impressionSent = useRef(false)

  const productIds = products.map((product) => product.id).join(',')

  useEffect(() => {
    const node = listRef.current
    if (!node || impressionSent.current || productIds.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (impressionSent.current) return

        impressionSent.current = true
        sendEvent(
          'impression',
          surface,
          anchorProductId,
          productIds.split(','),
          fallback
        )
        observer.disconnect()
      },
      { threshold: 0.3 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [surface, anchorProductId, productIds, fallback])

  return (
    <ul
      ref={listRef}
      aria-label="Recommended products"
      className="flex items-stretch gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scroll-smooth scrollbar-hide list-none"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {products.map((product, index) => (
        <li key={product.id} className="snap-start flex-none w-48 sm:w-52">
          <Link
            href={`/products/${product.id}`}
            aria-label={`View ${product.name}`}
            onClick={() =>
              sendEvent(
                'click',
                surface,
                anchorProductId,
                [product.id],
                fallback
              )
            }
            className="group flex h-full flex-col rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] shadow-warm hover:shadow-warm-lg transition-all duration-300 overflow-hidden"
          >
            <div className="relative aspect-square shrink-0 bg-gradient-to-br from-[var(--accent-cream)] to-[var(--accent-blush)]">
              <Image
                src={product.image}
                alt={product.name}
                fill
                className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                sizes="(max-width: 640px) 192px, 208px"
                loading={index < 2 ? undefined : 'lazy'}
                decoding="async"
                placeholder="blur"
                blurDataURL={PRODUCT_CARD_BLUR_DATA_URL}
              />
            </div>
            <div className="p-3">
              <h3 className="text-sm font-semibold text-[var(--foreground)] line-clamp-1">
                {product.name}
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {formatPrice(product.price)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
