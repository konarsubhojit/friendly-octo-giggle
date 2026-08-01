/**
 * The in-progress checkout handed between the shipping, review and payment
 * steps via session storage.
 *
 * Shared so all three steps agree on the shape — in particular the chosen
 * shipping method, which drives the quoted delivery charge and therefore the
 * total the customer is asked to pay.
 */
import { z } from 'zod'
import {
  DEFAULT_SHIPPING_METHOD,
  SHIPPING_METHODS,
} from '@/lib/shipping/methods'

export const PENDING_CHECKOUT_KEY = 'pending_checkout'

export const PendingCheckoutSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string().default(''),
  addressLine3: z.string().default(''),
  pinCode: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  shippingMethod: z.enum(SHIPPING_METHODS).default(DEFAULT_SHIPPING_METHOD),
  customizationNotes: z.record(z.string(), z.string()).default({}),
  /** Promo code carried to the payment step; the discount is recomputed server-side. */
  couponCode: z.string().nullish(),
})

export type PendingCheckout = z.infer<typeof PendingCheckoutSchema>

/**
 * Read the pending checkout, discarding anything that no longer matches the
 * schema so a stale payload cannot carry a bad address into an order.
 */
export function readPendingCheckout(): PendingCheckout | null {
  if (globalThis.window === undefined) return null
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const result = PendingCheckoutSchema.safeParse(parsed)
    if (!result.success) {
      sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
      return null
    }
    return result.data
  } catch {
    return null
  }
}

export function clearPendingCheckout(): void {
  if (globalThis.window === undefined) return
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
}

/** Persist the applied promo code so the payment step submits it with the order. */
export function persistCouponCode(code: string | null): void {
  if (globalThis.window === undefined) return
  const current = readPendingCheckout()
  if (!current) return
  sessionStorage.setItem(
    PENDING_CHECKOUT_KEY,
    JSON.stringify({ ...current, couponCode: code })
  )
}

/** Delivery destination for the shipping and tax engines. */
export function getPendingCheckoutDestination(
  pendingCheckout: Pick<PendingCheckout, 'state' | 'pinCode'> | null | undefined
) {
  if (!pendingCheckout) return null
  return { state: pendingCheckout.state, pinCode: pendingCheckout.pinCode }
}
