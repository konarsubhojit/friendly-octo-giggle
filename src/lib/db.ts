import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import {
  products,
  productVariations,
  productShares,
  categories,
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  orders,
  orderItems,
  carts,
  cartItems,
  wishlists,
  reviews,
  failedEmails,
  userRoleEnum,
  orderStatusEnum,
  checkoutRequestStatusEnum,
  emailTypeEnum,
  failedEmailStatusEnum,
  usersRelations,
  accountsRelations,
  passwordHistoryRelations,
  sessionsRelations,
  productsRelations,
  productVariationsRelations,
  checkoutRequests,
  checkoutRequestsRelations,
  ordersRelations,
  orderItemsRelations,
  cartsRelations,
  cartItemsRelations,
  wishlistsRelations,
  reviewsRelations,
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
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  products,
  productVariations,
  productShares,
  categories,
  checkoutRequests,
  orders,
  orderItems,
  carts,
  cartItems,
  wishlists,
  failedEmails,
  usersRelations,
  categoriesRelations,
  accountsRelations,
  passwordHistoryRelations,
  sessionsRelations,
  productsRelations,
  productVariationsRelations,
  checkoutRequestsRelations,
  ordersRelations,
  orderItemsRelations,
  cartsRelations,
  cartItemsRelations,
  wishlistsRelations,
  reviews,
  reviewsRelations,
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
export { db } from './db-queries'
export type { ProductListOptions } from './db-queries'
