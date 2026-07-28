import { NextRequest, NextResponse } from 'next/server'
import { handlePaymentWebhook } from '@/features/payments/services/payment-webhook-service'

export const dynamic = 'force-dynamic'

/**
 * Bounds how long this route can hold a `PROCESSING` claim on a checkout
 * request. Must stay at or below `STALE_PROCESSING_CLAIM_MS` (see
 * `lib/db-queries`) so a killed invocation's claim becomes reclaimable by the
 * next delivery instead of stranding the request.
 */
export const maxDuration = 30

/**
 * Legacy webhook endpoint kept for the already-registered Razorpay URL.
 * New providers register `/api/payments/webhook/[provider]`.
 */
const DEFAULT_WEBHOOK_PROVIDER = 'RAZORPAY'

export async function POST(request: NextRequest): Promise<NextResponse> {
  return handlePaymentWebhook(request, DEFAULT_WEBHOOK_PROVIDER)
}
