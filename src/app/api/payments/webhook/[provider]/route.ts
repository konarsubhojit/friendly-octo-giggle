import { NextRequest, NextResponse } from 'next/server'
import { handlePaymentWebhook } from '@/features/payments/services/payment-webhook-service'

export const dynamic = 'force-dynamic'

/** Provider-scoped webhook endpoint — dispatches to the registered gateway. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const { provider } = await params
  return handlePaymentWebhook(request, provider.toUpperCase())
}
