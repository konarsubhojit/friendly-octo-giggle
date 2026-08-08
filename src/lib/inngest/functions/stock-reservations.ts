import { cron } from 'inngest'
import { inngest } from '@/lib/inngest/client'
import { SCORE_NAMES } from '@/lib/inngest/scores'
import { logBusinessEvent } from '@/lib/logger'
import {
  RESERVATION_EXPIRY_BATCH_SIZE,
  expireDueReservations,
} from '@/features/orders/services/stock-reservation'

/**
 * Two retries. A sweep that fails is not urgent — the next run is five minutes
 * away and claims exactly the same rows — but a transient connection error
 * should not cost a whole interval either.
 */
export const RESERVATION_EXPIRY_RETRIES = 2

/**
 * Return units held by checkout requests that never completed.
 *
 * Without this sweep a request that dies between acceptance and commit holds
 * its stock forever, which turns the overselling this feature prevents into
 * permanent under-selling. The claim-shaped update means two runs overlapping
 * — or a retry of the same run — settle each reservation exactly once, so the
 * schedule can be tightened without risking double release.
 */
export const expireStockReservationsFunction = inngest.createFunction(
  {
    id: 'expire-stock-reservations',
    name: 'Expire stock reservations',
    triggers: [cron('*/5 * * * *')],
    retries: RESERVATION_EXPIRY_RETRIES,
  },
  async ({ step }) => {
    const settlement = await step.run('expire-due-reservations', () =>
      expireDueReservations(RESERVATION_EXPIRY_BATCH_SIZE)
    )

    // A full batch means the backlog outran one interval; the dashboard needs
    // to see that, because the next run inherits whatever was left behind.
    const drained = settlement.reservations < RESERVATION_EXPIRY_BATCH_SIZE

    await step.score('score-expiry-sweep', {
      name: SCORE_NAMES.reservationExpirySweepDrained,
      value: drained,
    })

    if (settlement.reservations > 0) {
      logBusinessEvent({
        event: 'cron_stock_reservations_expired',
        details: {
          reservations: settlement.reservations,
          quantity: settlement.quantity,
          drained,
        },
        success: true,
      })
    }

    return { ...settlement, drained }
  }
)
