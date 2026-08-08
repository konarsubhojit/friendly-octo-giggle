import { NextRequest, NextResponse } from 'next/server'
import { handlePaymentWebhook } from '@/features/payments/services/payment-webhook-service'

/**
 * Bounds how long this route can hold a `PROCESSING` claim on a checkout
 * request. Must stay at or below `STALE_PROCESSING_CLAIM_MS` (see
 * `lib/db-queries`) so a killed invocation's claim becomes reclaimable by the
 * next delivery instead of stranding the request.
 */
export const maxDuration = 30

/** Provider-scoped webhook endpoint — dispatches to the registered gateway. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const { provider } = await params
  return handlePaymentWebhook(request, provider.toUpperCase())
}
