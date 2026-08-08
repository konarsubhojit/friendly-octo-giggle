import { NextRequest } from 'next/server'
import { apiSuccess, handleApiError, parseJsonBody } from '@/lib/api-utils'
import { recordRecommendationEvent } from '@/features/recommendations/services/events'
import { RecommendationEventSchema } from '@/features/recommendations/validations'

/**
 * Record a recommendation rail impression or click.
 *
 * Mirrors `/api/search/click`: validated, logged, not persisted. Click-through
 * rate is derived from log aggregation rather than an events table.
 *
 * Rate limiting is applied at the edge in `src/proxy.ts`, which buckets
 * `/api/recommendations` alongside the other unauthenticated write paths.
 */
export async function POST(request: NextRequest) {
  try {
    const event = await parseJsonBody(request, RecommendationEventSchema)

    recordRecommendationEvent(event)

    return apiSuccess({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
