import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
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
  writePool: Pool | undefined
  readPool: Pool | undefined
}

const createPool = (connectionString: string) =>
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 5000,
  })

const writePool = (globalForDb.writePool ??= createPool(env.DATABASE_URL))
const readPool = (globalForDb.readPool ??= createPool(
  env.READ_DATABASE_URL ?? env.DATABASE_URL
))

if (env.NODE_ENV === 'development') {
  globalForDb.writePool = writePool
  globalForDb.readPool = readPool
}

// ─── Drizzle Instance ───────────────────────────────────

export const primaryDrizzleDb = drizzle(writePool, { schema })
export const readDrizzleDb = drizzle(readPool, { schema })
export const drizzleDb = withReplicas(primaryDrizzleDb, [readDrizzleDb])

// Export type for use in other files
export type DrizzleDb = typeof drizzleDb

// Re-export query helpers for backward compatibility
export { db, StockConflictError, CouponConflictError } from './db-queries'
export type { ProductListOptions } from './db-queries'
