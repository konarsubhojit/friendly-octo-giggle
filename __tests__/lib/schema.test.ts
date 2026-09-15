import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  products,
  productVariants,
  orders,
  orderItems,
  carts,
  cartItems,
  productShares,
  usersRelations,
  accountsRelations,
  passwordHistoryRelations,
  sessionsRelations,
  productsRelations,
  productVariantsRelations,
  ordersRelations,
  orderItemsRelations,
  cartsRelations,
  cartItemsRelations,
  productSharesRelations,
  userRoleEnum,
  orderStatusEnum,
} from '@/lib/schema'

describe('schema', () => {
  it('exports all table definitions', () => {
    expect(users).toBeDefined()
    expect(accounts).toBeDefined()
    expect(sessions).toBeDefined()
    expect(verificationTokens).toBeDefined()
    expect(passwordHistory).toBeDefined()
    expect(products).toBeDefined()
    expect(productVariants).toBeDefined()
    expect(orders).toBeDefined()
    expect(orderItems).toBeDefined()
    expect(carts).toBeDefined()
    expect(cartItems).toBeDefined()
    expect(productShares).toBeDefined()
  })

  it('exports all relation definitions', () => {
    expect(usersRelations).toBeDefined()
    expect(accountsRelations).toBeDefined()
    expect(passwordHistoryRelations).toBeDefined()
    expect(sessionsRelations).toBeDefined()
    expect(productsRelations).toBeDefined()
    expect(productVariantsRelations).toBeDefined()
    expect(ordersRelations).toBeDefined()
    expect(orderItemsRelations).toBeDefined()
    expect(cartsRelations).toBeDefined()
    expect(cartItemsRelations).toBeDefined()
    expect(productSharesRelations).toBeDefined()
  })

  it('exports enum definitions', () => {
    expect(userRoleEnum).toBeDefined()
    expect(orderStatusEnum).toBeDefined()
  })

  it('users table has expected columns', () => {
    const cols = Object.keys(users)
    expect(cols).toContain('id')
    expect(cols).toContain('email')
    expect(cols).toContain('role')
  })

  it('products table has expected columns', () => {
    const cols = Object.keys(products)
    expect(cols).toContain('id')
    expect(cols).toContain('name')
    expect(cols).toContain('category')
    expect(cols).toContain('searchVector')
  })

  it('orders table has expected columns', () => {
    const cols = Object.keys(orders)
    expect(cols).toContain('id')
    expect(cols).toContain('userId')
    expect(cols).toContain('status')
    expect(cols).toContain('totalAmount')
  })

  it('carts table has expected columns', () => {
    const cols = Object.keys(carts)
    expect(cols).toContain('id')
    expect(cols).toContain('userId')
    expect(cols).toContain('sessionId')
  })

  it('accounts table has expected columns', () => {
    const cols = Object.keys(accounts)
    expect(cols).toContain('id')
    expect(cols).toContain('userId')
    expect(cols).toContain('type')
    expect(cols).toContain('provider')
    expect(cols).toContain('providerAccountId')
    expect(cols).toContain('refresh_token')
    expect(cols).toContain('access_token')
    expect(cols).toContain('expires_at')
    expect(cols).toContain('token_type')
    expect(cols).toContain('scope')
    expect(cols).toContain('id_token')
    expect(cols).toContain('session_state')
  })

  it('sessions table has expected columns', () => {
    const cols = Object.keys(sessions)
    expect(cols).toContain('sessionToken')
    expect(cols).toContain('userId')
    expect(cols).toContain('expires')
  })

  it('verificationTokens table has expected columns', () => {
    const cols = Object.keys(verificationTokens)
    expect(cols).toContain('identifier')
    expect(cols).toContain('token')
    expect(cols).toContain('expires')
  })

  it('productVariants table has expected columns', () => {
    const cols = Object.keys(productVariants)
    expect(cols).toContain('id')
    expect(cols).toContain('productId')
    expect(cols).toContain('sku')
    expect(cols).toContain('image')
    expect(cols).toContain('price')
    expect(cols).toContain('stock')
  })

  it('orderItems table has expected columns', () => {
    const cols = Object.keys(orderItems)
    expect(cols).toContain('id')
    expect(cols).toContain('orderId')
    expect(cols).toContain('productId')
    expect(cols).toContain('variantId')
    expect(cols).toContain('quantity')
    expect(cols).toContain('price')
    expect(cols).toContain('customizationNote')
  })

  it('cartItems table has expected columns', () => {
    const cols = Object.keys(cartItems)
    expect(cols).toContain('id')
    expect(cols).toContain('cartId')
    expect(cols).toContain('productId')
    expect(cols).toContain('variantId')
    expect(cols).toContain('quantity')
  })

  it('orders table has all expected columns', () => {
    const cols = Object.keys(orders)
    expect(cols).toContain('customerName')
    expect(cols).toContain('customerEmail')
    expect(cols).toContain('customerAddress')
    expect(cols).toContain('trackingNumber')
    expect(cols).toContain('shippingProvider')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })

  it('products table has all expected columns', () => {
    const cols = Object.keys(products)
    expect(cols).toContain('description')
    expect(cols).toContain('image')
    expect(cols).toContain('deletedAt')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })

  it('product search migration adds only pg_trgm, search vector, and indexes', () => {
    const migrationPath = readdirSync(join(process.cwd(), 'drizzle'))
      .filter((file) => file.endsWith('.sql'))
      .map((file) => join(process.cwd(), 'drizzle', file))
      .find((file) =>
        readFileSync(file, 'utf8').includes('idx_products_search_vector')
      )

    expect(migrationPath).toBeDefined()
    if (!migrationPath) {
      throw new Error('Product search migration was not found')
    }

    const migrationSql = readFileSync(migrationPath, 'utf8')
    expect(migrationSql).toContain('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    expect(migrationSql).toContain(
      'ALTER TABLE "Product" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS'
    )
    expect(migrationSql).toContain(
      "setweight(to_tsvector('english', coalesce(\"name\", '')), 'A')"
    )
    expect(migrationSql).toContain(
      "setweight(to_tsvector('english', coalesce(\"description\", '')), 'B')"
    )
    expect(migrationSql).toContain(
      "setweight(to_tsvector('english', coalesce(\"category\", '')), 'C')"
    )
    expect(migrationSql).toContain(
      'CREATE INDEX "idx_products_search_vector" ON "Product" USING gin ("search_vector")'
    )
    expect(migrationSql).toContain(
      'CREATE INDEX "idx_products_name_trgm" ON "Product" USING gin ("name" gin_trgm_ops)'
    )
    expect(migrationSql).toContain(
      'CREATE INDEX "idx_products_description_trgm" ON "Product" USING gin ("description" gin_trgm_ops)'
    )
    expect(migrationSql).not.toMatch(/\bDROP\b/i)
    expect(migrationSql).not.toContain('unaccent')
    expect(migrationSql).not.toContain('btree_gin')
  })

  it('users table has all expected columns', () => {
    const cols = Object.keys(users)
    expect(cols).toContain('name')
    expect(cols).toContain('emailVerified')
    expect(cols).toContain('image')
    expect(cols).toContain('passwordHash')
    expect(cols).toContain('phoneNumber')
    expect(cols).toContain('createdAt')
    expect(cols).toContain('updatedAt')
  })

  it('passwordHistory table has expected columns', () => {
    const cols = Object.keys(passwordHistory)
    expect(cols).toContain('id')
    expect(cols).toContain('userId')
    expect(cols).toContain('passwordHash')
    expect(cols).toContain('createdAt')
  })

  it('productShares table has expected columns', () => {
    const cols = Object.keys(productShares)
    expect(cols).toContain('key')
    expect(cols).toContain('productId')
    expect(cols).toContain('variantId')
  })
})
