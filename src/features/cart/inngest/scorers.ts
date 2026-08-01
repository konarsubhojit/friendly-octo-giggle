import { createScorer } from 'inngest/experimental'
import { z } from 'zod'
import { inngest } from '@/lib/inngest/client'
import { SCORE_NAMES } from '@/lib/inngest/scores'

/**
 * How long a reminder is credited with a recovery.
 *
 * Long enough to cover a considered purchase, short enough that the attribution
 * is plausible — beyond this an order is more likely a fresh intent than a
 * recovered cart.
 */
export const CART_RECOVERY_WINDOW = '3d'

/**
 * Did this reminder actually recover the cart?
 *
 * The outcome that matters arrives days after the run that sent the email, so
 * it cannot be scored inline. A deferred scorer parks on `order/created` for
 * the same user and writes the result back onto the originating run — which is
 * what makes the reminder-copy experiment measurable against conversion rather
 * than against open rate.
 */
export const cartRecoveryScorer = createScorer(
  inngest,
  {
    id: 'cart-recovery-scorer',
    schema: z.object({
      cartId: z.string().min(1),
      userId: z.string().min(1),
    }),
  },
  async ({ event, step }) => {
    const order = await step.waitForEvent('wait-for-conversion', {
      event: 'order/created',
      timeout: CART_RECOVERY_WINDOW,
      if: `async.data.userId == "${event.data.userId}"`,
    })

    return {
      name: SCORE_NAMES.abandonedCartRecovered,
      value: order !== null,
    }
  }
)
