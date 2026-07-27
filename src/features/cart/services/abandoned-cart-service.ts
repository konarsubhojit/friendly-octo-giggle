/**
 * Abandoned-cart recovery service.
 *
 * Finds carts that have been idle beyond the configured thresholds and sends
 * reminder emails to opted-in users.  A maximum of two reminders are sent per
 * cart (one at 24 h and one at 72 h of inactivity) so users are never spammed
 * for the same cart.  Carts that have already been converted to an order (and
 * therefore deleted by the checkout flow) are automatically excluded because
 * the query only returns rows that still exist in the Cart table.
 */

import {
  eq,
  and,
  lt,
  isNotNull,
  sql,
} from 'drizzle-orm'
import { drizzleDb, primaryDrizzleDb } from '@/lib/db'
import {
  carts,
  cartItems,
  users,
  notificationPreferences,
  abandonedCartReminders,
  productVariants,
  products,
} from '@/lib/schema'
import { sendAbandonedCartReminderEmail } from '@/lib/email'
import {
  formatPriceForCurrency,
  isValidCurrencyCode,
  type CurrencyCode,
} from '@/lib/currency'
import { logBusinessEvent, logError } from '@/lib/logger'
import { env } from '@/lib/env'

// ─── Thresholds ──────────────────────────────────────────

const FIRST_REMINDER_IDLE_MS = 24 * 60 * 60 * 1000 // 24 hours
const SECOND_REMINDER_IDLE_MS = 72 * 60 * 60 * 1000 // 72 hours

/** Maximum number of reminders sent per cron run (safety throttle). */
const MAX_BATCH_SIZE = 50

// ─── Types ───────────────────────────────────────────────

export interface AbandonedCartSendResult {
  readonly cartId: string
  readonly userId: string
  readonly reminderNumber: 1 | 2
  readonly success: boolean
  readonly error?: string
}

export interface AbandonedCartCronResult {
  readonly firstReminders: number
  readonly secondReminders: number
  readonly errors: number
  readonly results: AbandonedCartSendResult[]
}

// ─── Query helpers ───────────────────────────────────────

/**
 * Returns carts whose `updatedAt` is older than `idleThreshold` that:
 *  - belong to an authenticated user (`userId IS NOT NULL`)
 *  - have at least one item
 *  - the user has opted into marketing emails
 *  - have fewer than `maxReminders` reminders already sent
 */
const findIdleCartsForReminder = async (
  idleThresholdMs: number,
  maxReminders: number
): Promise<
  Array<{
    cartId: string
    userId: string
    reminderCount: number
  }>
> => {
  const idleBefore = new Date(Date.now() - idleThresholdMs)

  /*
   * Strategy: join Cart → User → NotificationPreference to gate on opt-in,
   * join CartItem to ensure the cart is non-empty (HAVING count > 0), and
   * join AbandonedCartReminder to count already-sent reminders per cart.
   *
   * Drizzle does not support HAVING with aggregates on joined tables in the
   * relational query API, so we fall back to the SQL query builder here.
   */
  const rows = await drizzleDb
    .select({
      cartId: carts.id,
      userId: carts.userId,
      reminderCount:
        sql<number>`cast(coalesce(count(distinct ${abandonedCartReminders.id}), 0) as int)`.as(
          'reminderCount'
        ),
    })
    .from(carts)
    .innerJoin(users, eq(carts.userId, users.id))
    // Gate on marketing-email opt-in (absent row → default = false, excluded)
    .innerJoin(
      notificationPreferences,
      and(
        eq(notificationPreferences.userId, carts.userId),
        eq(notificationPreferences.marketingEmail, true)
      )
    )
    .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
    .leftJoin(
      abandonedCartReminders,
      eq(abandonedCartReminders.cartId, carts.id)
    )
    .where(
      and(
        isNotNull(carts.userId),
        lt(carts.updatedAt, idleBefore)
      )
    )
    .groupBy(carts.id, carts.userId)
    .having(
      sql`cast(coalesce(count(distinct ${abandonedCartReminders.id}), 0) as int) < ${maxReminders}`
    )
    .limit(MAX_BATCH_SIZE)

  return rows.map((r) => ({
    cartId: r.cartId,
    userId: r.userId as string,
    reminderCount: r.reminderCount,
  }))
}

// ─── Email sending ────────────────────────────────────────

const buildCartUrl = (): string => {
  const base = env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/cart`
}

/**
 * Fetches the cart items with product/variant details needed for the email
 * body.  Returns an empty array when the cart has no items (edge-case guard).
 */
const fetchCartEmailItems = async (
  cartId: string,
  currencyCode: CurrencyCode
) => {
  const rows = await drizzleDb
    .select({
      productName: products.name,
      quantity: cartItems.quantity,
      price: productVariants.price,
      variantId: cartItems.variantId,
    })
    .from(cartItems)
    .innerJoin(products, eq(cartItems.productId, products.id))
    .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
    .where(eq(cartItems.cartId, cartId))

  return rows.map((row) => ({
    name: row.productName,
    quantity: row.quantity,
    price: formatPriceForCurrency(row.price, currencyCode),
    variant: null as string | null, // variant label resolved below
    variantId: row.variantId,
  }))
}

// ─── Reminder recording ───────────────────────────────────

const recordReminder = async (
  cartId: string,
  userId: string,
  reminderNumber: 1 | 2
): Promise<void> => {
  await primaryDrizzleDb.insert(abandonedCartReminders).values({
    cartId,
    userId,
    reminderNumber,
  })
}

// ─── Single-cart processor ────────────────────────────────

const processCart = async (
  cartId: string,
  userId: string,
  reminderNumber: 1 | 2
): Promise<AbandonedCartSendResult> => {
  try {
    // Fetch user details (email, name, currency preference)
    const user = await drizzleDb.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { email: true, name: true, currencyPreference: true },
    })

    if (!user) {
      return {
        cartId,
        userId,
        reminderNumber,
        success: false,
        error: 'user_not_found',
      }
    }

    const currencyCode: CurrencyCode =
      user.currencyPreference && isValidCurrencyCode(user.currencyPreference)
        ? user.currencyPreference
        : 'INR'

    const items = await fetchCartEmailItems(cartId, currencyCode)

    if (items.length === 0) {
      // Cart became empty between the batch query and now — skip silently.
      return {
        cartId,
        userId,
        reminderNumber,
        success: false,
        error: 'cart_empty',
      }
    }

    sendAbandonedCartReminderEmail({
      to: user.email,
      customerName: user.name ?? user.email,
      cartUrl: buildCartUrl(),
      items,
      reminderNumber,
      cartId,
    })

    await recordReminder(cartId, userId, reminderNumber)

    logBusinessEvent({
      event: 'abandoned_cart_reminder_sent',
      details: { cartId, userId, reminderNumber, itemCount: items.length },
      success: true,
    })

    return { cartId, userId, reminderNumber, success: true }
  } catch (error) {
    logError({
      error,
      context: 'abandoned_cart_reminder_send',
      additionalInfo: { cartId, userId, reminderNumber },
    })
    return {
      cartId,
      userId,
      reminderNumber,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ─── Public API ───────────────────────────────────────────

/**
 * Main entry point called by the cron route.
 *
 * Processing order:
 *  1. Find carts eligible for their **first** reminder (idle ≥ 24 h, 0 prior
 *     sends).
 *  2. Find carts eligible for their **second** reminder (idle ≥ 72 h, exactly
 *     1 prior send).
 *  3. Send and record each reminder, collecting results for the response body.
 */
export const processAbandonedCartReminders =
  async (): Promise<AbandonedCartCronResult> => {
    const results: AbandonedCartSendResult[] = []

    // First reminder: 0 reminders sent, idle ≥ 24 h (cap < 1)
    const firstCandidates = await findIdleCartsForReminder(
      FIRST_REMINDER_IDLE_MS,
      1
    )

    // Second reminder: at least 1 reminder sent, idle ≥ 72 h (cap < 2)
    // We further restrict to carts that have already received reminder #1 but
    // not yet #2 using the existing query helper with cap = 2.
    const secondCandidates = await findIdleCartsForReminder(
      SECOND_REMINDER_IDLE_MS,
      2
    )

    // Exclude first-reminder candidates from the second-reminder batch to
    // prevent sending both in the same run.
    const firstCartIds = new Set(firstCandidates.map((c) => c.cartId))
    const pureSecondCandidates = secondCandidates.filter(
      (c) => !firstCartIds.has(c.cartId) && c.reminderCount >= 1
    )

    // Process first reminders
    const firstResults = await Promise.allSettled(
      firstCandidates.map((c) => processCart(c.cartId, c.userId, 1))
    )
    firstResults.forEach((r) => {
      if (r.status === 'fulfilled') results.push(r.value)
      else
        results.push({
          cartId: 'unknown',
          userId: 'unknown',
          reminderNumber: 1,
          success: false,
          error: String(r.reason),
        })
    })

    // Process second reminders
    const secondResults = await Promise.allSettled(
      pureSecondCandidates.map((c) => processCart(c.cartId, c.userId, 2))
    )
    secondResults.forEach((r) => {
      if (r.status === 'fulfilled') results.push(r.value)
      else
        results.push({
          cartId: 'unknown',
          userId: 'unknown',
          reminderNumber: 2,
          success: false,
          error: String(r.reason),
        })
    })

    const firstReminders = results.filter(
      (r) => r.reminderNumber === 1 && r.success
    ).length
    const secondReminders = results.filter(
      (r) => r.reminderNumber === 2 && r.success
    ).length
    const errors = results.filter((r) => !r.success).length

    return { firstReminders, secondReminders, errors, results }
  }
