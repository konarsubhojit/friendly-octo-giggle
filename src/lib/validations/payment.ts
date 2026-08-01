import { z } from 'zod'
import {
  PAYMENT_PROVIDERS,
  requiresPaymentSignature,
} from '@/lib/payments/providers'

/** Providers accepted at checkout, derived from the registered gateways. */
export const PaymentProviderSchema = z.enum(PAYMENT_PROVIDERS)

const REQUIRED_SIGNED_FIELDS = [
  ['orderId', 'Payment order ID is required'],
  ['paymentId', 'Payment transaction ID is required'],
  ['signature', 'Payment signature is required'],
] as const

/**
 * A payment reference supplied at checkout.
 *
 * Gateway references are only mandatory for providers that sign them (e.g.
 * Razorpay); offline providers such as Cash on Delivery have their references
 * generated server-side.
 */
export const PaymentReferenceSchema = z
  .object({
    provider: PaymentProviderSchema,
    orderId: z.string().min(1).max(200).optional(),
    paymentId: z.string().min(1).max(200).optional(),
    signature: z.string().min(1).max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (!requiresPaymentSignature(value.provider)) return

    for (const [field, message] of REQUIRED_SIGNED_FIELDS) {
      if (!value[field]) {
        ctx.addIssue({ code: 'custom', path: [field], message })
      }
    }
  })

export type PaymentReferenceInput = z.infer<typeof PaymentReferenceSchema>
