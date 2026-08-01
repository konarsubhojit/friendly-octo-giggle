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
} from '@/features/orders/inngest/emails'
import {
  indexOrderForSearchFunction,
  invalidateOrderCachesFunction,
} from '@/features/orders/inngest/side-effects'
import { sendAuthEmailFunction } from '@/features/auth/inngest/emails'
import {
  retryFailedEmailsFunction,
  retrySingleEmailFunction,
} from '@/lib/inngest/functions/email-retry'
import { refreshExchangeRatesFunction } from '@/lib/inngest/functions/exchange-rates'

export const inngestFunctions = [
  processCheckoutRequestFunction,
  sendOrderConfirmationEmailFunction,
  sendOrderStatusEmailFunction,
  sendOrderRefundEmailFunction,
  sendAuthEmailFunction,
  indexOrderForSearchFunction,
  invalidateOrderCachesFunction,
  retryFailedEmailsFunction,
  retrySingleEmailFunction,
  scanAbandonedCartsFunction,
  sendAbandonedCartReminderFunction,
  refreshExchangeRatesFunction,
  cartRecoveryScorer,
] as const
