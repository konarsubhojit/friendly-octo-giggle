import { generateShortId } from '@/lib/short-id'
import { PaymentVerificationError } from './errors'
import type {
  CreateGatewayOrderInput,
  GatewayOrder,
  PaymentGateway,
  PaymentRefund,
  RefundInput,
  VerifiedPayment,
  VerifyPaymentInput,
} from './gateway'

const COD_REFERENCE_PREFIX = 'cod_'

/**
 * Build the payment reference for a Cash on Delivery order.
 *
 * Derived from the caller's reference (the checkout request id) so a retried
 * checkout resolves to the same reference and the unique payment-transaction
 * constraint keeps order creation idempotent.
 */
const buildReference = (reference?: string): string =>
  `${COD_REFERENCE_PREFIX}${reference?.trim() || generateShortId()}`

/**
 * Cash on Delivery: no external gateway call, no signature, and no money
 * collected at checkout. The order is created as `PENDING` and settles to
 * `PAID` when delivery is confirmed.
 */
export const codGateway: PaymentGateway = {
  provider: 'COD',

  ensureConfigured: () => {
    // Cash on Delivery requires no credentials.
  },

  createOrder: async ({
    amount,
    currency,
    receipt,
  }: CreateGatewayOrderInput): Promise<GatewayOrder> => ({
    provider: 'COD',
    orderId: buildReference(receipt),
    amount,
    currency,
  }),

  // References are always derived server-side: a client-supplied reference
  // could be pointed at another provider's transaction and have the order
  // marked PAID by that provider's webhook.
  verifyPayment: async ({
    reference,
  }: VerifyPaymentInput): Promise<VerifiedPayment> => {
    const codReference = buildReference(reference)

    return {
      provider: 'COD',
      paymentOrderId: codReference,
      paymentTransactionId: codReference,
      amountPaid: 0,
      paidAt: null,
    }
  },

  verifyWebhook: () => {
    throw new PaymentVerificationError(
      'Cash on Delivery does not support webhooks',
      400
    )
  },

  refund: async ({ amount }: RefundInput): Promise<PaymentRefund> => {
    throw new PaymentVerificationError(
      `Cash on Delivery refunds of ${amount} must be settled manually`,
      400
    )
  },
}
