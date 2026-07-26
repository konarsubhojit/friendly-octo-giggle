import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'
import { fromMinorUnits, toMinorUnits } from '@/lib/money'
import { PaymentConfigurationError, PaymentVerificationError } from './errors'
import type {
  CreateGatewayOrderInput,
  GatewayOrder,
  PaymentGateway,
  PaymentRefund,
  PaymentWebhookEvent,
  PaymentWebhookEventType,
  RefundInput,
  VerifiedPayment,
  VerifyPaymentInput,
  VerifyWebhookInput,
} from './gateway'

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1'

interface RazorpayPaymentResponse {
  id: string
  order_id: string
  amount: number
  status: string
  captured_at?: number
}

interface RazorpayOrderResponse {
  id: string
  amount: number
  currency: string
}

interface RazorpayRefundResponse {
  id: string
  amount: number
  status: string
}

interface RazorpayWebhookPayload {
  event?: string
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

/**
 * Convert an order total to the gateway's minor units (paise). Wraps the shared
 * money helper so out-of-range totals surface as a payment verification error.
 */
const toGatewayAmount = (amount: number): number => {
  try {
    return toMinorUnits(amount)
  } catch {
    throw new PaymentVerificationError('Order amount is out of supported range')
  }
}

const ensureRazorpayConfigured = (): { keyId: string; keySecret: string } => {
  const keyId = env.RAZORPAY_KEY_ID
  const keySecret = env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    throw new PaymentConfigurationError(
      'Payment provider is not configured. Please contact support.'
    )
  }

  return { keyId, keySecret }
}

const authHeader = (keyId: string, keySecret: string): string =>
  `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`

const signaturesMatch = (expected: string, actual: string): boolean => {
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  )
}

const verifyRazorpaySignature = ({
  orderId,
  paymentId,
  signature,
  keySecret,
}: {
  orderId: string
  paymentId: string
  signature: string
  keySecret: string
}) => {
  const expected = createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  if (!signaturesMatch(expected, signature)) {
    throw new PaymentVerificationError('Invalid payment signature')
  }
}

/**
 * Verify a Razorpay webhook delivery signature.
 *
 * Exported separately from the gateway so callers that only need signature
 * verification (e.g. tooling and tests) do not depend on the full gateway.
 */
export const verifyRazorpayWebhookSignature = ({
  payload,
  signature,
}: {
  payload: string
  signature: string
}) => {
  const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET
  if (!webhookSecret) {
    throw new PaymentConfigurationError(
      'Payment webhook is not configured. Please contact support.'
    )
  }

  const expected = createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex')

  if (!signaturesMatch(expected, signature)) {
    throw new PaymentVerificationError('Invalid webhook signature', 401)
  }
}

const normalizeWebhookEventType = (
  eventType: string
): PaymentWebhookEventType => {
  if (eventType === 'payment.captured' || eventType === 'payment.failed') {
    return eventType
  }
  return 'unhandled'
}

export const razorpayGateway: PaymentGateway = {
  provider: 'RAZORPAY',

  ensureConfigured: () => {
    ensureRazorpayConfigured()
  },

  createOrder: async ({
    amount,
    currency,
    receipt,
  }: CreateGatewayOrderInput): Promise<GatewayOrder> => {
    const { keyId, keySecret } = ensureRazorpayConfigured()

    const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(keyId, keySecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: toGatewayAmount(amount),
        currency,
        receipt,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new PaymentVerificationError('Unable to create payment order', 502)
    }

    const order = (await response.json()) as RazorpayOrderResponse

    return {
      provider: 'RAZORPAY',
      orderId: order.id,
      amount: fromMinorUnits(order.amount),
      currency: order.currency,
    }
  },

  verifyPayment: async ({
    payment,
    expectedAmount,
  }: VerifyPaymentInput): Promise<VerifiedPayment> => {
    const { keyId, keySecret } = ensureRazorpayConfigured()

    if (!payment.orderId || !payment.paymentId || !payment.signature) {
      throw new PaymentVerificationError('Payment details are incomplete')
    }

    verifyRazorpaySignature({
      orderId: payment.orderId,
      paymentId: payment.paymentId,
      signature: payment.signature,
      keySecret,
    })

    const response = await fetch(
      `${RAZORPAY_API_BASE}/payments/${payment.paymentId}`,
      {
        headers: {
          Authorization: authHeader(keyId, keySecret),
        },
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      throw new PaymentVerificationError(
        'Unable to verify payment transaction',
        502
      )
    }

    const details = (await response.json()) as RazorpayPaymentResponse

    if (details.status !== 'captured') {
      throw new PaymentVerificationError('Payment has not been captured')
    }

    if (details.order_id !== payment.orderId) {
      throw new PaymentVerificationError('Payment order mismatch')
    }

    const expectedAmountInPaise = toGatewayAmount(expectedAmount)
    if (details.amount !== expectedAmountInPaise) {
      throw new PaymentVerificationError(
        'Paid amount does not match order total'
      )
    }

    if (!details.captured_at) {
      throw new PaymentVerificationError('Payment capture timestamp is missing')
    }

    return {
      provider: 'RAZORPAY',
      paymentOrderId: payment.orderId,
      paymentTransactionId: payment.paymentId,
      amountPaid: fromMinorUnits(details.amount),
      paidAt: new Date(details.captured_at * 1000),
    }
  },

  verifyWebhook: ({
    payload,
    headers,
  }: VerifyWebhookInput): PaymentWebhookEvent => {
    const signature = headers.get('x-razorpay-signature')
    if (!signature) {
      throw new PaymentVerificationError('Missing webhook signature')
    }

    verifyRazorpayWebhookSignature({ payload, signature })

    let body: RazorpayWebhookPayload
    try {
      body = JSON.parse(payload) as RazorpayWebhookPayload
    } catch {
      // A signed-but-unparseable body will never become valid, so answer 400
      // to stop the gateway retrying it forever.
      throw new PaymentVerificationError('Invalid webhook payload')
    }

    const entity = body.payload?.payment?.entity
    const eventType = body.event ?? ''
    const paymentId = entity?.id
    const paymentOrderId = entity?.order_id

    if (!paymentId || !paymentOrderId) {
      throw new PaymentVerificationError('Invalid payment webhook payload')
    }

    const type = normalizeWebhookEventType(eventType)

    if (type === 'payment.captured' && typeof entity?.amount !== 'number') {
      throw new PaymentVerificationError(
        'Invalid payment amount in webhook payload'
      )
    }

    return {
      provider: 'RAZORPAY',
      // Razorpay sends a stable event id header. When it is absent (older
      // integrations, manual replays) fall back to a deterministic key so
      // duplicates are still collapsed.
      eventId:
        headers.get('x-razorpay-event-id')?.trim() ||
        `${eventType}:${paymentId}`,
      eventType,
      type,
      paymentId,
      paymentOrderId,
      amountInMinorUnits:
        typeof entity?.amount === 'number' ? entity.amount : null,
    }
  },

  refund: async ({
    paymentTransactionId,
    amount,
  }: RefundInput): Promise<PaymentRefund> => {
    const { keyId, keySecret } = ensureRazorpayConfigured()

    const response = await fetch(
      `${RAZORPAY_API_BASE}/payments/${paymentTransactionId}/refund`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader(keyId, keySecret),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: toGatewayAmount(amount) }),
        cache: 'no-store',
      }
    )

    if (!response.ok) {
      throw new PaymentVerificationError('Unable to refund payment', 502)
    }

    const refund = (await response.json()) as RazorpayRefundResponse

    return {
      provider: 'RAZORPAY',
      refundId: refund.id,
      amount: fromMinorUnits(refund.amount),
      status: refund.status,
    }
  },
}
