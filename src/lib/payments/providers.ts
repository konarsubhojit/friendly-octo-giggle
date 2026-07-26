/**
 * Registered payment providers and their capabilities.
 *
 * This module is intentionally dependency-free (no env, no crypto, no network)
 * so it can be imported from schema definitions, validation schemas and client
 * bundles. Gateway implementations live in sibling modules and read their
 * capabilities from here, keeping the provider list a single source of truth.
 *
 * Adding a provider means adding an entry here plus a `PaymentGateway`
 * implementation registered in `./registry`.
 */
export const PAYMENT_PROVIDERS = ['RAZORPAY', 'COD'] as const

export type PaymentProviderName = (typeof PAYMENT_PROVIDERS)[number]

export interface PaymentProviderCapabilities {
  /** Checkout must supply a gateway-signed payment reference. */
  readonly requiresSignature: boolean
  /** Payment is collected on delivery rather than at checkout. */
  readonly settlesOnDelivery: boolean
}

export const PAYMENT_PROVIDER_CAPABILITIES: Record<
  PaymentProviderName,
  PaymentProviderCapabilities
> = {
  RAZORPAY: { requiresSignature: true, settlesOnDelivery: false },
  COD: { requiresSignature: false, settlesOnDelivery: true },
}

export const isPaymentProvider = (
  value: unknown
): value is PaymentProviderName =>
  typeof value === 'string' &&
  (PAYMENT_PROVIDERS as readonly string[]).includes(value)

/**
 * Whether checkout must supply a signed payment reference for a provider.
 * Unknown providers are treated as requiring a signature (fail closed).
 */
export const requiresPaymentSignature = (provider: string): boolean =>
  isPaymentProvider(provider)
    ? PAYMENT_PROVIDER_CAPABILITIES[provider].requiresSignature
    : true

/** Whether a provider collects payment at delivery time (e.g. Cash on Delivery). */
export const settlesPaymentOnDelivery = (
  provider: string | null | undefined
): boolean =>
  isPaymentProvider(provider)
    ? PAYMENT_PROVIDER_CAPABILITIES[provider].settlesOnDelivery
    : false
