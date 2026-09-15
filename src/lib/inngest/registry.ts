/**
 * Every Inngest function served by this application.
 *
 * The serve handler reads this list and nothing else, so registering a
 * function is a one-line change here rather than an edit to a route file, and
 * "is this function actually served?" is answerable by a single test against
 * this array instead of by reading the route.
 *
 * An unregistered function is silently dead — it compiles, it publishes
 * events, and it never runs — which is exactly the failure this list exists to
 * make visible.
 */

import { processCheckoutRequestFunction } from '@/features/cart/inngest/checkout'
import {
  scanAbandonedCartsFunction,
  sendAbandonedCartReminderFunction,
} from '@/features/cart/inngest/abandoned-cart'
import { cartRecoveryScorer } from '@/features/cart/inngest/scorers'
import {
  sendOrderConfirmationEmailFunction,
  sendOrderRefundEmailFunction,
  sendOrderStatusEmailFunction,
  sendReturnStatusEmailFunction,
} from '@/features/orders/inngest/emails'
import {
  indexOrderForSearchFunction,
  invalidateOrderCachesFunction,
} from '@/features/orders/inngest/side-effects'
import { sendAuthEmailFunction } from '@/features/auth/inngest/emails'
import { computeProductAffinityFunction } from '@/features/recommendations/inngest/affinity'
import {
  retryFailedEmailsFunction,
  retrySingleEmailFunction,
} from '@/lib/inngest/functions/email-retry'
import { activityRetentionFunction } from '@/lib/inngest/functions/activity-retention'
import { refreshExchangeRatesFunction } from '@/lib/inngest/functions/exchange-rates'
import { expireStockReservationsFunction } from '@/lib/inngest/functions/stock-reservations'

export const eventFunctions = [
  processCheckoutRequestFunction,
  sendOrderConfirmationEmailFunction,
  sendOrderStatusEmailFunction,
  sendOrderRefundEmailFunction,
  sendReturnStatusEmailFunction,
  sendAuthEmailFunction,
  indexOrderForSearchFunction,
  invalidateOrderCachesFunction,
  retrySingleEmailFunction,
  sendAbandonedCartReminderFunction,
  cartRecoveryScorer,
] as const

export const cronFunctions = [
  activityRetentionFunction,
  retryFailedEmailsFunction,
  scanAbandonedCartsFunction,
  refreshExchangeRatesFunction,
  expireStockReservationsFunction,
  computeProductAffinityFunction,
] as const

export const cronJobFlags = {
  'activity-retention': 'enableActivityRetentionJob',
  'retry-failed-emails': 'enableFailedEmailRetryJob',
  'scan-abandoned-carts': 'enableAbandonedCartScanJob',
  'refresh-exchange-rates': 'enableExchangeRateRefreshJob',
  'expire-stock-reservations': 'enableStockReservationExpiryJob',
  'compute-product-affinity': 'enableProductAffinityJob',
} as const

export const inngestFunctions = [...eventFunctions, ...cronFunctions] as const
