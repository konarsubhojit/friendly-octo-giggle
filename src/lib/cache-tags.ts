/**
 * Cache Components tag vocabulary.
 *
 * `"use cache"` scopes are invalidated by tag, not by key. Every tag string in
 * the application is produced here so the read side (`cacheTag(...)` inside a
 * cached scope) and the write side (`revalidateCacheTags(...)` inside a
 * mutation) can never drift apart.
 *
 * Redis keys live in `src/lib/cache.ts` and are a separate concern: Redis owns
 * cross-instance data reuse for route handlers, Cache Components owns render
 * output for the prerendered public shell. A cached scope must never nest a
 * Redis read.
 */

import { revalidateTag } from 'next/cache'
import { logError } from './logger'

/**
 * Named `cacheLife` profiles declared in `next.config.ts`.
 *
 * Every `"use cache"` scope must name one of these; an implicit lifetime is a
 * defect, not a default.
 */
export const CACHE_LIFE_PROFILES = {
  /** Catalog listings and bestsellers. */
  CATALOG: 'catalog',
  /** A single product detail record. */
  PRODUCT: 'product',
  /** Category taxonomy, which changes rarely. */
  TAXONOMY: 'taxonomy',
} as const

export type CacheLifeProfile =
  (typeof CACHE_LIFE_PROFILES)[keyof typeof CACHE_LIFE_PROFILES]

const PRODUCT_TAG_PREFIX = 'product:'
const PRODUCT_LIST_TAG = 'products:list'
const BESTSELLERS_TAG = 'products:bestsellers'
const CATEGORIES_TAG = 'categories:list'

/** Tag for a single product's cached detail scope. */
export const productTag = (id: string): string => `${PRODUCT_TAG_PREFIX}${id}`

/** Tag for any cached scope whose result depends on catalog membership. */
export const productListTag = (): string => PRODUCT_LIST_TAG

/** Tag for cached bestseller rails, which change when orders are placed. */
export const bestsellersTag = (): string => BESTSELLERS_TAG

/** Tag for cached category taxonomy reads. */
export const categoriesTag = (): string => CATEGORIES_TAG

/**
 * Resolve the `cacheLife` profile that bounds a tag's staleness.
 *
 * `revalidateTag` requires a profile as its second argument in Next.js 16.2;
 * it caps how long an already-delivered client cache may keep serving the
 * superseded value. Pairing each tag with the profile its scopes declare keeps
 * the two consistent by construction.
 */
const profileForTag = (tag: string): CacheLifeProfile => {
  if (tag === CATEGORIES_TAG) return CACHE_LIFE_PROFILES.TAXONOMY
  if (tag.startsWith(PRODUCT_TAG_PREFIX)) return CACHE_LIFE_PROFILES.PRODUCT
  return CACHE_LIFE_PROFILES.CATALOG
}

/**
 * Revalidate one or more cache tags, de-duplicating repeats.
 *
 * A tag revalidation failure must never fail the write that triggered it: the
 * database is already updated and the `cacheLife` bound still guarantees
 * eventual freshness. Failures are therefore logged with operation context and
 * swallowed, never rethrown (FR-012).
 *
 * @param tags - Tags produced by the helpers in this module.
 * @param context - Logging context identifying the originating write.
 */
export const revalidateCacheTags = (
  tags: readonly string[],
  context: string
): void => {
  const uniqueTags = [...new Set(tags.filter(Boolean))]

  for (const tag of uniqueTags) {
    try {
      revalidateTag(tag, profileForTag(tag))
    } catch (error) {
      logError({
        error,
        context: 'cache_tag_revalidation',
        additionalInfo: { tag, operation: context },
      })
    }
  }
}
