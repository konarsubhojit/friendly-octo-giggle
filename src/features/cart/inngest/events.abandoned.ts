import { eventType } from 'inngest'
import { z } from 'zod'

/**
 * One idle cart is due one recovery reminder.
 *
 * Emitted per cart by the nightly scan so each reminder is its own durable
 * run — a single slow provider can no longer stall the rest of the batch.
 */
export const abandonedCartReminderDue = eventType(
  'cart/abandoned-reminder.due',
  {
    schema: z.object({
      cartId: z.string().min(1),
      userId: z.string().min(1),
      /** 1 for the 24-hour nudge, 2 for the 72-hour follow-up. */
      reminderNumber: z.union([z.literal(1), z.literal(2)]),
    }),
  }
)
