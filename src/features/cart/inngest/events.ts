import { eventType } from 'inngest'
import { CheckoutQueueMessageSchema } from '@/features/cart/validations'

/**
 * Event that asks for a checkout request to be turned into an order.
 *
 * The payload deliberately carries only the checkout request id: every step
 * re-reads the row, so a retry can never act on data captured at publish time.
 *
 * Kept separate from the function definition so publishers can import the event
 * without pulling in the processing pipeline (and creating an import cycle).
 */
export const checkoutRequestCreated = eventType('checkout/request.created', {
  schema: CheckoutQueueMessageSchema,
})
