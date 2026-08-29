import {
  products,
  productVariants,
  productOptions,
  productOptionValues,
  productVariantOptionValues,
  productShares,
  categories,
  users,
  adminAuditLogs,
  adminSavedViews,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  addresses,
  notificationPreferences,
  pushSubscriptions,
  orders,
  orderItems,
  refunds,
  returnRequests,
  returnItems,
  returnEvidence,
  carts,
  cartItems,
  wishlists,
  reviews,
  reviewVotes,
  failedEmails,
  userRoleEnum,
  orderStatusEnum,
  checkoutRequestStatusEnum,
  emailTypeEnum,
  failedEmailStatusEnum,
  usersRelations,
  adminSavedViewsRelations,
  accountsRelations,
  passwordHistoryRelations,
  addressesRelations,
  notificationPreferencesRelations,
  pushSubscriptionsRelations,
  sessionsRelations,
  productsRelations,
  productVariantsRelations,
  productOptionsRelations,
  productOptionValuesRelations,
  productVariantOptionValuesRelations,
  checkoutRequests,
  checkoutRequestsRelations,
  stockReservations,
  stockReservationsRelations,
  stockReservationStatusEnum,
  coupons,
  couponRedemptions,
  couponsRelations,
  couponRedemptionsRelations,
  discountTypeEnum,
  ordersRelations,
  orderItemsRelations,
  refundsRelations,
  returnRequestsRelations,
  returnItemsRelations,
  returnEvidenceRelations,
  cartsRelations,
  cartItemsRelations,
  wishlistsRelations,
  reviewsRelations,
  reviewVotesRelations,
  productSharesRelations,
  categoriesRelations,
} from './schema'
import { withReplicas } from 'drizzle-orm/pg-core'
import { env } from './env'
import { createDatabaseConnections } from './db/factory'
import type { DatabaseConnections } from './db/factory'

// All schema tables and relations collected into one object for Drizzle relational queries
const schema = {
  userRoleEnum,
  orderStatusEnum,
  checkoutRequestStatusEnum,
  emailTypeEnum,
  failedEmailStatusEnum,
  discountTypeEnum,
  stockReservationStatusEnum,
  users,
  adminAuditLogs,
  adminSavedViews,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  addresses,
  notificationPreferences,
  pushSubscriptions,
  products,
  productVariants,
  productOptions,
  productOptionValues,
  productVariantOptionValues,
  productShares,
  categories,
  checkoutRequests,
  stockReservations,
  coupons,
  couponRedemptions,
  orders,
  orderItems,
  refunds,
  returnRequests,
  returnItems,
  returnEvidence,
  carts,
  cartItems,
  wishlists,
  failedEmails,
  usersRelations,
  adminSavedViewsRelations,
  categoriesRelations,
  accountsRelations,
  passwordHistoryRelations,
  addressesRelations,
  notificationPreferencesRelations,
  pushSubscriptionsRelations,
  sessionsRelations,
  productsRelations,
  productVariantsRelations,
  productOptionsRelations,
  productOptionValuesRelations,
  productVariantOptionValuesRelations,
  checkoutRequestsRelations,
  stockReservationsRelations,
  couponsRelations,
  couponRedemptionsRelations,
  ordersRelations,
  orderItemsRelations,
  refundsRelations,
  returnRequestsRelations,
  returnItemsRelations,
  returnEvidenceRelations,
  cartsRelations,
  cartItemsRelations,
  wishlistsRelations,
  reviews,
  reviewsRelations,
  reviewVotes,
  reviewVotesRelations,
  productSharesRelations,
}

// ─── Connection Pool (singleton for serverless) ─────────

const globalForDb = globalThis as unknown as {
  databaseConnections: DatabaseConnections<typeof schema> | undefined
  databaseShutdownRegistered: boolean | undefined
}

const databaseConnections = (globalForDb.databaseConnections ??=
  createDatabaseConnections(env, schema))

export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    await globalForDb.databaseConnections?.close()
  } finally {
    globalForDb.databaseConnections = undefined
  }
}

const registerShutdownHandler = () => {
  if (globalForDb.databaseShutdownRegistered || env.NODE_ENV === 'test') return
  globalForDb.databaseShutdownRegistered = true

  const closeAndExit = (signal: NodeJS.Signals) => {
    void closeDatabaseConnections().finally(() => {
      process.kill(process.pid, signal)
    })
  }

  process.once('SIGINT', closeAndExit)
  process.once('SIGTERM', closeAndExit)
  process.once('beforeExit', () => {
    void closeDatabaseConnections()
  })
}

registerShutdownHandler()

// ─── Drizzle Instance ───────────────────────────────────

export const primaryDrizzleDb = databaseConnections.primary.db
export const readDrizzleDb = databaseConnections.read.db
export const drizzleDb = withReplicas(primaryDrizzleDb, [readDrizzleDb])

// Export type for use in other files
export type DrizzleDb = typeof drizzleDb

// Re-export query helpers for backward compatibility
export { db, StockConflictError, CouponConflictError } from './db-queries'
export type { ProductListOptions } from './db-queries'
