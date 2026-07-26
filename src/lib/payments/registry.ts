import type { PaymentProvider } from '@/lib/types'
import { PaymentConfigurationError } from './errors'
import type { PaymentGateway } from './gateway'
import { codGateway } from './cod'
import { razorpayGateway } from './razorpay'

/**
 * Registered gateway implementations, keyed by provider.
 *
 * Adding a provider means adding it to `./providers` and registering its
 * implementation here — order creation, checkout and webhook handling all
 * resolve gateways through this registry.
 */
const PAYMENT_GATEWAYS: Record<PaymentProvider, PaymentGateway> = {
  RAZORPAY: razorpayGateway,
  COD: codGateway,
}

/**
 * Resolve the gateway for a provider.
 *
 * @throws {PaymentConfigurationError} when the provider is not registered.
 */
export const getPaymentGateway = (provider: string): PaymentGateway => {
  const gateway = PAYMENT_GATEWAYS[provider as PaymentProvider]

  if (!gateway) {
    throw new PaymentConfigurationError('Unsupported payment provider', 400)
  }

  return gateway
}

export const listPaymentGateways = (): PaymentGateway[] =>
  Object.values(PAYMENT_GATEWAYS)
