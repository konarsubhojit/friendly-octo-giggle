import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'
import type { CheckoutPaymentInput, PaymentProvider } from '@/lib/types'

export class PaymentConfigurationError extends Error {
  readonly status: number

  constructor(message: string, status = 503) {
    super(message)
    this.name = 'PaymentConfigurationError'
    this.status = status
  }
}

export class PaymentVerificationError extends Error {
  readonly status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'PaymentVerificationError'
    this.status = status
  }
}

interface RazorpayPaymentResponse {
  id: string
  order_id: string
  amount: number
  status: string
  captured_at?: number
}

const toMinorUnits = (amount: number): number => {
  const [whole, fraction = ''] = amount.toFixed(2).split('.')
  const normalized = Number.parseInt(
    `${whole}${fraction.padEnd(2, '0').slice(0, 2)}`,
    10
  )
  if (!Number.isSafeInteger(normalized)) {
    throw new PaymentVerificationError('Order amount is out of supported range')
  }
  return normalized
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
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  const isValid =
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)

  if (!isValid) {
    throw new PaymentVerificationError('Invalid payment signature')
  }
}

export const ensurePaymentProviderConfigured = (provider: PaymentProvider) => {
  if (provider === 'RAZORPAY') {
    ensureRazorpayConfigured()
    return
  }

  throw new PaymentConfigurationError('Unsupported payment provider', 400)
}

export const verifyCheckoutPayment = async ({
  payment,
  expectedAmount,
}: {
  payment: CheckoutPaymentInput
  expectedAmount: number
}): Promise<{
  provider: PaymentProvider
  paymentOrderId: string
  paymentTransactionId: string
  amountPaid: number
  paidAt: Date
}> => {
  if (payment.provider !== 'RAZORPAY') {
    throw new PaymentVerificationError('Unsupported payment provider')
  }

  const { keyId, keySecret } = ensureRazorpayConfigured()

  verifyRazorpaySignature({
    orderId: payment.orderId,
    paymentId: payment.paymentId,
    signature: payment.signature,
    keySecret,
  })

  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  const response = await fetch(
    `https://api.razorpay.com/v1/payments/${payment.paymentId}`,
    {
      headers: {
        Authorization: `Basic ${authHeader}`,
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

  const expectedAmountInPaise = toMinorUnits(expectedAmount)
  if (details.amount !== expectedAmountInPaise) {
    throw new PaymentVerificationError('Paid amount does not match order total')
  }

  if (!details.captured_at) {
    throw new PaymentVerificationError('Payment capture timestamp is missing')
  }

  return {
    provider: payment.provider,
    paymentOrderId: payment.orderId,
    paymentTransactionId: payment.paymentId,
    amountPaid: details.amount / 100,
    paidAt: new Date(details.captured_at * 1000),
  }
}

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
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signature)
  const valid =
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)

  if (!valid) {
    throw new PaymentVerificationError('Invalid webhook signature', 401)
  }
}
