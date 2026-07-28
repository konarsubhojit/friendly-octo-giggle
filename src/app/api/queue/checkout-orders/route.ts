import {
  processCheckoutRequestById,
  recoverCheckoutRequestAfterRetryExhaustion,
} from '@/features/cart/services/checkout-service'
import { handleCallback } from '@/lib/queue'
import { CheckoutQueueMessageSchema } from '@/features/cart/validations'

/**
 * Mirrors the `maxDuration` declared for this consumer in `vercel.json`. Must
 * stay at or below `STALE_PROCESSING_CLAIM_MS` (see `lib/db-queries`) so a
 * killed invocation's claim is reclaimable by the next delivery.
 */
export const maxDuration = 30

const MAX_CHECKOUT_CONSUMER_ATTEMPTS = 5

const checkoutOrdersCallbackHandler = handleCallback(
  async (message, metadata) => {
    const { checkoutRequestId } = CheckoutQueueMessageSchema.parse(message)

    try {
      await processCheckoutRequestById(checkoutRequestId)
    } catch (error) {
      if (metadata.deliveryCount >= MAX_CHECKOUT_CONSUMER_ATTEMPTS) {
        await recoverCheckoutRequestAfterRetryExhaustion({
          checkoutRequestId,
          deliveryCount: metadata.deliveryCount,
          error,
        })
        return
      }

      throw error
    }
  },
  {
    visibilityTimeoutSeconds: 600,
  }
)

export const POST = async (request: Request) =>
  checkoutOrdersCallbackHandler(request)
