import type { CheckoutPaymentInput } from '@/lib/types'
import { PaymentVerificationError } from './errors'
import type { PaymentGateway, VerifiedPayment } from './gateway'
import { getPaymentGateway } from './registry'

export { PaymentConfigurationError, PaymentVerificationError } from './errors'
export type {
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
export { getPaymentGateway, listPaymentGateways } from './registry'
export {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_CAPABILITIES,
  isPaymentProvider,
  requiresPaymentSignature,
  settlesPaymentOnDelivery,
} from './providers'
export type {
  PaymentProviderCapabilities,
  PaymentProviderName,
} from './providers'
export { verifyRazorpayWebhookSignature } from './razorpay'

/**
 * Assert that the gateway backing a provider is registered and configured.
 *
 * @throws {PaymentConfigurationError} for unknown or misconfigured providers.
 */
export const ensurePaymentProviderConfigured = (provider: string): void => {
  getPaymentGateway(provider).ensureConfigured()
}

/**
 * Resolve a gateway for a payment attempt, surfacing an unknown provider as a
 * verification failure (the caller supplied it) rather than a configuration one.
 */
const resolveGatewayForPayment = (provider: string): PaymentGateway => {
  try {
    return getPaymentGateway(provider)
  } catch {
    throw new PaymentVerificationError('Unsupported payment provider')
  }
}

/**
 * Verify a checkout payment through the provider's gateway.
 *
 * Callers stay provider-agnostic: the returned `paidAt` is `null` for providers
 * that settle after checkout (e.g. Cash on Delivery).
 */
export const verifyCheckoutPayment = async ({
  payment,
  expectedAmount,
  reference,
}: {
  payment: CheckoutPaymentInput
  expectedAmount: number
  reference?: string
}): Promise<VerifiedPayment> =>
  resolveGatewayForPayment(payment.provider).verifyPayment({
    payment,
    expectedAmount,
    reference,
  })
