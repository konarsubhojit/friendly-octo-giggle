import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  doublePrecision,
  pgEnum,
  index,
  unique,
  json,
  boolean,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import type { AdapterAccountType } from '@auth/core/adapters'
import { generateShortId, generateOrderId } from './short-id'

// ─── Enums ───────────────────────────────────────────────

export const userRoleEnum = pgEnum('UserRole', ['CUSTOMER', 'ADMIN'])

export const emailTypeEnum = pgEnum('EmailType', [
  'order_confirmation',
  'order_status_update',
])

export const failedEmailStatusEnum = pgEnum('FailedEmailStatus', [
  'pending',
  'failed',
  'sent',
])
export const orderStatusEnum = pgEnum('OrderStatus', [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
])

export const checkoutRequestStatusEnum = pgEnum('CheckoutRequestStatus', [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
])

// ─── Auth Tables (NextAuth compatible) ───────────────────

export const users = pgTable('User', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  passwordHash: text('passwordHash'),
  phoneNumber: varchar('phoneNumber', { length: 20 }).unique(),
  currencyPreference: varchar('currencyPreference', { length: 3 })
    .default('INR')
    .notNull(),
  role: userRoleEnum('role').default('CUSTOMER').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
})

export const accounts = pgTable(
  'Account',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => [
    unique('Account_provider_providerAccountId_key').on(
      t.provider,
      t.providerAccountId
    ),
    index('Account_userId_idx').on(t.userId),
  ]
)

export const sessions = pgTable(
  'Session',
  {
    sessionToken: text('sessionToken').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => [index('Session_userId_idx').on(t.userId)]
)

export const verificationTokens = pgTable(
  'VerificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull().unique(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (t) => [
    unique('VerificationToken_identifier_token_key').on(t.identifier, t.token),
  ]
)

// ─── Password History Table ──────────────────────────────

export const passwordHistory = pgTable(
  'PasswordHistory',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    passwordHash: text('passwordHash').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [index('PasswordHistory_userId_idx').on(t.userId)]
)

// ─── Product Tables ──────────────────────────────────────

export const categories = pgTable('Category', {
  id: varchar('id', { length: 7 })
    .primaryKey()
    .$defaultFn(() => generateShortId()),
  name: text('name').notNull().unique(),
  sortOrder: integer('sortOrder').notNull().default(0),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  deletedAt: timestamp('deletedAt', { mode: 'date' }),
})

export const products = pgTable(
  'Product',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    name: text('name').notNull(),
    description: text('description').notNull(),
    price: doublePrecision('price').notNull(),
    image: text('image').notNull(),
    images: json('images').$type<string[]>().default([]).notNull(),
    stock: integer('stock').notNull(),
    category: text('category').notNull(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('Product_category_idx').on(t.category),
    index('Product_createdAt_idx').on(t.createdAt),
    index('Product_deletedAt_idx').on(t.deletedAt),
  ]
)

export const productVariations = pgTable(
  'ProductVariation',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    productId: varchar('productId', { length: 7 })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    styleId: varchar('styleId', { length: 7 }), // Self-ref: null for styles & base-product colours; set for colours under a style
    name: text('name').notNull(),
    designName: text('designName').notNull(),
    variationType: text('variationType', { enum: ['styling', 'colour'] })
      .default('styling')
      .notNull(),
    image: text('image'),
    images: json('images').$type<string[]>().default([]).notNull(),
    price: doublePrecision('price').notNull(),
    stock: integer('stock').notNull(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('ProductVariation_productId_idx').on(t.productId),
    index('ProductVariation_styleId_idx').on(t.styleId),
    unique('ProductVariation_productId_name_key').on(t.productId, t.name),
  ]
)

// ─── Order Tables ────────────────────────────────────────

export interface CheckoutRequestItemRecord {
  productId: string
  variationId?: string | null
  quantity: number
  customizationNote?: string | null
}

export const checkoutRequests = pgTable(
  'CheckoutRequest',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    customerName: text('customerName').notNull(),
    customerEmail: text('customerEmail').notNull(),
    customerAddress: text('customerAddress').notNull(),
    items: json('items').$type<CheckoutRequestItemRecord[]>().notNull(),
    status: checkoutRequestStatusEnum('status').default('PENDING').notNull(),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('CheckoutRequest_userId_idx').on(t.userId),
    index('CheckoutRequest_status_idx').on(t.status),
    index('CheckoutRequest_createdAt_idx').on(t.createdAt),
  ]
)

export const orders = pgTable(
  'Order',
  {
    id: varchar('id', { length: 10 })
      .primaryKey()
      .$defaultFn(() => generateOrderId()),
    userId: text('userId').references(() => users.id),
    customerName: text('customerName').notNull(),
    customerEmail: text('customerEmail').notNull(),
    customerAddress: text('customerAddress').notNull(),
    checkoutRequestId: varchar('checkoutRequestId', { length: 7 }).references(
      () => checkoutRequests.id,
      { onDelete: 'set null' }
    ),
    totalAmount: doublePrecision('totalAmount').notNull(),
    status: orderStatusEnum('status').default('PENDING').notNull(),
    trackingNumber: text('trackingNumber'),
    shippingProvider: text('shippingProvider'),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('Order_userId_idx').on(t.userId),
    index('Order_status_idx').on(t.status),
    index('Order_createdAt_idx').on(t.createdAt),
    unique('Order_checkoutRequestId_key').on(t.checkoutRequestId),
  ]
)

export const orderItems = pgTable(
  'OrderItem',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    orderId: varchar('orderId', { length: 10 })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: varchar('productId', { length: 7 })
      .notNull()
      .references(() => products.id),
    variationId: varchar('variationId', { length: 7 }).references(
      () => productVariations.id
    ),
    quantity: integer('quantity').notNull(),
    price: doublePrecision('price').notNull(),
    customizationNote: text('customizationNote'),
  },
  (t) => [
    index('OrderItem_orderId_idx').on(t.orderId),
    index('OrderItem_productId_idx').on(t.productId),
    index('OrderItem_variationId_idx').on(t.variationId),
  ]
)

// ─── Cart Tables ─────────────────────────────────────────

export const carts = pgTable(
  'Cart',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    userId: text('userId')
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    sessionId: text('sessionId').unique(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [index('Cart_sessionId_idx').on(t.sessionId)]
)

export const cartItems = pgTable(
  'CartItem',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    cartId: varchar('cartId', { length: 7 })
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: varchar('productId', { length: 7 })
      .notNull()
      .references(() => products.id),
    variationId: varchar('variationId', { length: 7 }).references(
      () => productVariations.id
    ),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    unique('CartItem_cartId_productId_variationId_key').on(
      t.cartId,
      t.productId,
      t.variationId
    ),
    index('CartItem_cartId_idx').on(t.cartId),
    index('CartItem_productId_idx').on(t.productId),
    index('CartItem_variationId_idx').on(t.variationId),
  ]
)

// ─── Wishlist Table ──────────────────────────────────────

export const wishlists = pgTable(
  'Wishlist',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: varchar('productId', { length: 7 })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    unique('Wishlist_userId_productId_key').on(t.userId, t.productId),
    index('Wishlist_userId_idx').on(t.userId),
  ]
)

// ─── Review Tables ───────────────────────────────────────

export const reviews = pgTable(
  'Review',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    productId: varchar('productId', { length: 7 })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    orderId: varchar('orderId', { length: 10 }).references(() => orders.id, {
      onDelete: 'set null',
    }),
    userId: text('userId').references(() => users.id, { onDelete: 'set null' }),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    isAnonymous: boolean('isAnonymous').default(false).notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('Review_productId_idx').on(t.productId),
    index('Review_userId_idx').on(t.userId),
    index('Review_productId_rating_idx').on(t.productId, t.rating),
    unique('Review_userId_productId_key').on(t.userId, t.productId),
  ]
)

// ─── Product Share Table ─────────────────────────────────

export const productShares = pgTable(
  'ProductShare',
  {
    key: varchar('key', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    productId: varchar('productId', { length: 7 })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    variationId: varchar('variationId', { length: 7 }).references(
      () => productVariations.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('ProductShare_productId_idx').on(t.productId),
    index('ProductShare_variationId_idx').on(t.variationId),
  ]
)

// ─── Relations ───────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  checkoutRequests: many(checkoutRequests),
  orders: many(orders),
  cart: one(carts),
  passwordHistory: many(passwordHistory),
  wishlists: many(wishlists),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const passwordHistoryRelations = relations(
  passwordHistory,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordHistory.userId],
      references: [users.id],
    }),
  })
)

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const productsRelations = relations(products, ({ many }) => ({
  variations: many(productVariations),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
  wishlists: many(wishlists),
  reviews: many(reviews),
}))

export const productVariationsRelations = relations(
  productVariations,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productVariations.productId],
      references: [products.id],
    }),
    style: one(productVariations, {
      fields: [productVariations.styleId],
      references: [productVariations.id],
      relationName: 'styleColours',
    }),
    colours: many(productVariations, { relationName: 'styleColours' }),
    orderItems: many(orderItems),
    cartItems: many(cartItems),
  })
)

export const checkoutRequestsRelations = relations(
  checkoutRequests,
  ({ one }) => ({
    user: one(users, {
      fields: [checkoutRequests.userId],
      references: [users.id],
    }),
    order: one(orders, {
      fields: [checkoutRequests.id],
      references: [orders.checkoutRequestId],
    }),
  })
)

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  checkoutRequest: one(checkoutRequests, {
    fields: [orders.checkoutRequestId],
    references: [checkoutRequests.id],
  }),
  items: many(orderItems),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variation: one(productVariations, {
    fields: [orderItems.variationId],
    references: [productVariations.id],
  }),
}))

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}))

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
  variation: one(productVariations, {
    fields: [cartItems.variationId],
    references: [productVariations.id],
  }),
}))

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  user: one(users, { fields: [wishlists.userId], references: [users.id] }),
  product: one(products, {
    fields: [wishlists.productId],
    references: [products.id],
  }),
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
}))

export const productSharesRelations = relations(productShares, ({ one }) => ({
  product: one(products, {
    fields: [productShares.productId],
    references: [products.id],
  }),
  variation: one(productVariations, {
    fields: [productShares.variationId],
    references: [productVariations.id],
  }),
}))

export const categoriesRelations = relations(categories, () => ({}))

// ─── Failed Email Types ──────────────────────────────────

export interface EmailAttemptRecord {
  attempt: number
  timestamp: string
  error: string
  provider: string
}

// ─── Failed Email Table ──────────────────────────────────

export const failedEmails = pgTable(
  'FailedEmail',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    recipientEmail: text('recipientEmail').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('bodyHtml').notNull(),
    bodyText: text('bodyText').notNull(),
    emailType: emailTypeEnum('emailType').notNull(),
    referenceId: varchar('referenceId', { length: 7 }).notNull(),
    attemptCount: integer('attemptCount').notNull().default(0),
    lastError: text('lastError'),
    isRetriable: boolean('isRetriable').notNull().default(true),
    status: failedEmailStatusEnum('status').notNull().default('pending'),
    errorHistory: json('errorHistory')
      .$type<EmailAttemptRecord[]>()
      .notNull()
      .default([]),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    lastAttemptedAt: timestamp('lastAttemptedAt', { mode: 'date' }),
    sentAt: timestamp('sentAt', { mode: 'date' }),
  },
  (t) => [
    index('FailedEmail_status_idx').on(t.status),
    index('FailedEmail_referenceId_idx').on(t.referenceId),
    index('FailedEmail_createdAt_idx').on(t.createdAt),
    index('FailedEmail_recipientEmail_status_idx').on(
      t.recipientEmail,
      t.status
    ),
    index('FailedEmail_status_isRetriable_createdAt_idx').on(
      t.status,
      t.isRetriable,
      t.createdAt
    ),
  ]
)
