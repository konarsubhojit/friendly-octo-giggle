import { logBusinessEvent } from '@/lib/logger'
import type { RecommendationEventInput } from '@/features/recommendations/validations'

/**
 * Record a rail impression or click.
 *
 * Emitted as a structured log record rather than persisted, matching the
 * existing `/api/search/click` behaviour. Click-through rate is derived by
 * aggregating `recommendation_impression` against `recommendation_click` in
 * the log platform; the application stores no event rows.
 */
export const recordRecommendationEvent = (
  input: RecommendationEventInput
): void => {
  logBusinessEvent({
    event:
      input.type === 'click'
        ? 'recommendation_click'
        : 'recommendation_impression',
    details: {
      surface: input.surface,
      anchorProductId: input.anchorProductId,
      productIds: input.productIds,
      fallback: input.fallback,
    },
    success: true,
  })
}
