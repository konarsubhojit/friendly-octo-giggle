import {
  processCheckoutRequestById,
  recoverCheckoutRequestAfterRetryExhaustion,
} from "@/lib/checkout-service";
import { handleCallback } from "@/lib/queue";
import { CheckoutQueueMessageSchema } from "@/lib/validations";

const MAX_CHECKOUT_CONSUMER_ATTEMPTS = 5;

export const POST = handleCallback(
  async (message, metadata) => {
    const { checkoutRequestId } = CheckoutQueueMessageSchema.parse(message);

    try {
      await processCheckoutRequestById(checkoutRequestId);
    } catch (error) {
      if (metadata.deliveryCount >= MAX_CHECKOUT_CONSUMER_ATTEMPTS) {
        await recoverCheckoutRequestAfterRetryExhaustion({
          checkoutRequestId,
          deliveryCount: metadata.deliveryCount,
          error,
        });
        return;
      }

      throw error;
    }
  },
  {
    visibilityTimeoutSeconds: 600,
  },
);
