import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { processAbandonedCartReminders } from '@/features/cart/services/abandoned-cart-service'
import { logBusinessEvent, logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const isVercelCron = (request: NextRequest): boolean => {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    return request.headers.get('authorization') === `Bearer ${cronSecret}`
  }
  return request.headers.get('user-agent')?.startsWith('vercel-cron') ?? false
}

export const GET = async (request: NextRequest) => {
  if (!isVercelCron(request)) {
    return apiError('Unauthorized', 401)
  }

  try {
    const result = await processAbandonedCartReminders()

    if (result.firstReminders === 0 && result.secondReminders === 0) {
      logBusinessEvent({
        event: 'cron_abandoned_cart_skip',
        details: { reason: 'no_eligible_carts' },
        success: true,
      })
      return apiSuccess({
        firstReminders: 0,
        secondReminders: 0,
        errors: 0,
        results: [],
      })
    }

    logBusinessEvent({
      event: 'cron_abandoned_cart_complete',
      details: {
        firstReminders: result.firstReminders,
        secondReminders: result.secondReminders,
        errors: result.errors,
      },
      success: true,
    })

    return apiSuccess(result)
  } catch (error) {
    logError({ error, context: 'cron_abandoned_cart' })
    return apiError('Abandoned cart cron failed', 500)
  }
}
