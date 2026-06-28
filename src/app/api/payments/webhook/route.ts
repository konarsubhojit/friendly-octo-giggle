import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { primaryDrizzleDb } from '@/lib/db'
import { checkoutRequests, orders } from '@/lib/schema'
import {
  PaymentConfigurationError,
  PaymentVerificationError,
  verifyRazorpayWebhookSignature,
} from '@/lib/payments'
import { logError } from '@/lib/logger'
import { processCheckoutRequestById } from '@/features/cart/services/checkout-service'

export const dynamic = 'force-dynamic'

interface RazorpayWebhookEvent {
  event: string
  payload?: {
    payment?: {
      entity?: {
        id?: string
        order_id?: string
        amount?: number
      }
    }
  }
}

const handleCapturedPayment = async ({
  paymentId,
  paymentOrderId,
  amount,
}: {
  paymentId: string
  paymentOrderId: string
  amount: number
}) => {
  const [existingOrder] = await primaryDrizzleDb
    .select({
      id: orders.id,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(eq(orders.paymentTransactionId, paymentId))
    .limit(1)

  if (existingOrder) {
    if (existingOrder.paymentStatus !== 'PAID') {
      await primaryDrizzleDb
        .update(orders)
        .set({
          paymentStatus: 'PAID',
          amountPaid: amount / 100,
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(orders.id, existingOrder.id))
    }
    return
  }

  const [checkoutRequest] = await primaryDrizzleDb
    .select({
      id: checkoutRequests.id,
      status: checkoutRequests.status,
    })
    .from(checkoutRequests)
    .where(
      and(
        eq(checkoutRequests.paymentTransactionId, paymentId),
        eq(checkoutRequests.paymentOrderId, paymentOrderId)
      )
    )
    .limit(1)

  if (
    checkoutRequest &&
    checkoutRequest.status !== 'COMPLETED' &&
    checkoutRequest.status !== 'FAILED' &&
    checkoutRequest.status !== 'PROCESSING'
  ) {
    await processCheckoutRequestById(checkoutRequest.id)
  }
}

const handleFailedPayment = async ({ paymentId }: { paymentId: string }) => {
  await Promise.all([
    primaryDrizzleDb
      .update(checkoutRequests)
      .set({
        status: 'FAILED',
        errorMessage: 'Payment failed',
        updatedAt: new Date(),
      })
      .where(eq(checkoutRequests.paymentTransactionId, paymentId)),
    primaryDrizzleDb
      .update(orders)
      .set({
        paymentStatus: 'FAILED',
        updatedAt: new Date(),
      })
      .where(eq(orders.paymentTransactionId, paymentId)),
  ])
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-razorpay-signature')
    if (!signature) {
      return NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 400 }
      )
    }

    verifyRazorpayWebhookSignature({ payload: rawBody, signature })

    const event = JSON.parse(rawBody) as RazorpayWebhookEvent
    const paymentEntity = event.payload?.payment?.entity
    const paymentId = paymentEntity?.id
    const paymentOrderId = paymentEntity?.order_id

    if (!paymentId || !paymentOrderId) {
      return NextResponse.json(
        { error: 'Invalid payment webhook payload' },
        { status: 400 }
      )
    }

    if (event.event === 'payment.captured') {
      if (typeof paymentEntity.amount !== 'number') {
        return NextResponse.json(
          { error: 'Invalid payment amount in webhook payload' },
          { status: 400 }
        )
      }
      await handleCapturedPayment({
        paymentId,
        paymentOrderId,
        amount: paymentEntity.amount,
      })
    }

    if (event.event === 'payment.failed') {
      await handleFailedPayment({ paymentId })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (
      error instanceof PaymentVerificationError ||
      error instanceof PaymentConfigurationError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    logError({ error, context: 'payment_webhook_processing_failed' })
    return NextResponse.json(
      { error: 'Failed to process payment webhook' },
      { status: 500 }
    )
  }
}
