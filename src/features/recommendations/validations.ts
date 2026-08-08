import { z } from 'zod'
import type { Product } from '@/lib/types'

/** Where a rail is rendered. Each surface has its own candidate rules. */
export const RECOMMENDATION_SURFACES = [
  'product',
  'cart',
  'home',
  'zero_result',
] as const

export type RecommendationSurface = (typeof RECOMMENDATION_SURFACES)[number]

/**
 * The only shape a recommendation surface returns, on both the scored and the
 * fallback branch.
 *
 * Deliberately narrower than `ProductGridItem`, which carries `stock: number`
 * and `soldCount: number`. Returning those would disclose exact inventory and
 * sales volume, violating FR-010 and SC-003. Stock is read by the eligibility
 * predicate, collapsed to `inStock`, and the numeric value is discarded before
 * the object leaves the selection service.
 */
export type RecommendationItem = Pick<
  Product,
  'id' | 'name' | 'description' | 'image' | 'category'
> & {
  /** Lowest active variant price, in INR (the storage base currency). */
  readonly price: number
  /** Whether any variant has sellable stock. Never a magnitude. */
  readonly inStock: boolean
}

export interface RecommendationResult {
  readonly surface: RecommendationSurface
  /** True when bestsellers were served because scores were unusable. */
  readonly fallback: boolean
  readonly products: readonly RecommendationItem[]
}

/** Short IDs are Base62 and exactly 7 characters (`src/lib/short-id.ts`). */
const shortId = z.string().length(7)

/** Recently-viewed history is capped at 12 entries client-side. */
const MAX_SEEDS = 12

export const PersonalizedQuerySchema = z.object({
  seeds: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : []))
    .pipe(z.array(shortId).max(MAX_SEEDS)),
  limit: z.coerce.number().int().min(1).max(MAX_SEEDS).default(8),
})

export const RecommendationEventSchema = z
  .object({
    type: z.enum(['impression', 'click']),
    surface: z.enum(RECOMMENDATION_SURFACES),
    anchorProductId: shortId.nullable().default(null),
    productIds: z.array(shortId).min(1).max(MAX_SEEDS),
    fallback: z.boolean().default(false),
  })
  .refine(
    (value) => value.type !== 'click' || value.productIds.length === 1,
    'A click event must name exactly one product'
  )

export type RecommendationEventInput = z.infer<typeof RecommendationEventSchema>

export const RecomputeRequestSchema = z.object({
  /** Overrides `AFFINITY_WINDOW_DAYS` for a single manual run. */
  windowDays: z.coerce.number().int().min(7).max(365).optional(),
})
