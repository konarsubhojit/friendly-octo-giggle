import type { CheckoutPaymentInput, PaymentProvider } from '@/lib/types'

/** A payment order created at the gateway, handed to the client to pay. */
export interface GatewayOrder {
  readonly provider: PaymentProvider
  readonly orderId: string
  /** Amount in major units (e.g. rupees). */
  readonly amount: number
  readonly currency: string
}

export interface CreateGatewayOrderInput {
  /** Amount in major units (e.g. rupees). */
  readonly amount: number
  readonly currency: string
  /** Caller-side reference (checkout request id) for reconciliation. */
  readonly receipt: string
}

/**
 * A payment verified against the gateway.
 *
 * `paidAt` is `null` for providers that settle later (Cash on Delivery); the
 * order is stored as `PENDING` until settlement is confirmed.
 */
export interface VerifiedPayment {
  readonly provider: PaymentProvider
  readonly paymentOrderId: string
  readonly paymentTransactionId: string
  /** Amount in major units already collected — `0` until settlement. */
  readonly amountPaid: number
  readonly paidAt: Date | null
}

export interface VerifyPaymentInput {
  readonly payment: CheckoutPaymentInput
  /** Order total in major units the payment must match. */
  readonly expectedAmount: number
  /** Stable caller-side reference used to derive references for offline providers. */
  readonly reference?: string
}

export type PaymentWebhookEventType =
  | 'payment.captured'
  | 'payment.failed'
  | 'refund.processed'
  | 'refund.failed'
  | 'unhandled'

/** A gateway webhook delivery normalized into provider-agnostic fields. */
export interface PaymentWebhookEvent {
  readonly provider: PaymentProvider
  /** Stable id used to make webhook processing exactly-once. */
  readonly eventId: string
  readonly eventType: string
  readonly type: PaymentWebhookEventType
  readonly paymentId: string
  readonly paymentOrderId: string
  /** Captured amount in minor units, when the event carries one. */
  readonly amountInMinorUnits: number | null
  /** Gateway refund id, present only for refund events. */
  readonly refundId?: string
}

export interface VerifyWebhookInput {
  readonly payload: string
  readonly headers: Headers
}

export interface RefundInput {
  readonly paymentTransactionId: string
  /** Amount in major units to refund. */
  readonly amount: number
}

export interface PaymentRefund {
  readonly provider: PaymentProvider
  readonly refundId: string
  /** Refunded amount in major units. */
  readonly amount: number
  readonly status: string
}

/**
 * Contract every payment provider implements. Order creation, checkout and
 * webhook handling depend only on this interface, so adding a provider means
 * adding an implementation and registering it — no changes to order services.
 */
export interface PaymentGateway {
  readonly provider: PaymentProvider
  /** Throws `PaymentConfigurationError` when credentials are missing. */
  ensureConfigured(): void
  createOrder(input: CreateGatewayOrderInput): Promise<GatewayOrder>
  verifyPayment(input: VerifyPaymentInput): Promise<VerifiedPayment>
  /** Verifies the delivery signature and normalizes the event. */
  verifyWebhook(input: VerifyWebhookInput): PaymentWebhookEvent
  refund(input: RefundInput): Promise<PaymentRefund>
}
