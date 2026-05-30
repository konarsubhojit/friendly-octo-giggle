import {
  processCheckoutRequestById,
  recoverCheckoutRequestAfterRetryExhaustion,
} from '@/features/cart/services/checkout-service'
import { handleCallback } from '@/lib/queue'
import { CheckoutQueueMessageSchema } from '@/features/cart/validations'

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
