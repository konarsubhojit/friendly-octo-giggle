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
    image: text('image').notNull(),
    images: json('images').$type<string[]>().default([]).notNull(),
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

// ─── Product Options (dynamic variant dimensions) ──────

export const productOptions = pgTable(
  'ProductOption',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    productId: varchar('productId', { length: 7 })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sortOrder').notNull().default(0),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('ProductOption_productId_idx').on(t.productId),
    unique('ProductOption_productId_name_key').on(t.productId, t.name),
  ]
)

export const productOptionValues = pgTable(
  'ProductOptionValue',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    optionId: varchar('optionId', { length: 7 })
      .notNull()
      .references(() => productOptions.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    sortOrder: integer('sortOrder').notNull().default(0),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('ProductOptionValue_optionId_idx').on(t.optionId),
    unique('ProductOptionValue_optionId_value_key').on(t.optionId, t.value),
  ]
)

// ─── Product Variants (purchasable combinations) ─────────

export const productVariants = pgTable(
  'ProductVariant',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    productId: varchar('productId', { length: 7 })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    sku: text('sku'),
    price: doublePrecision('price').notNull(),
    stock: integer('stock').notNull(),
    image: text('image'),
    images: json('images').$type<string[]>().default([]).notNull(),
    deletedAt: timestamp('deletedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('ProductVariant_productId_idx').on(t.productId),
    index('ProductVariant_deletedAt_idx').on(t.deletedAt),
  ]
)

export const productVariantOptionValues = pgTable(
  'ProductVariantOptionValue',
  {
    variantId: varchar('variantId', { length: 7 })
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    optionValueId: varchar('optionValueId', { length: 7 })
      .notNull()
      .references(() => productOptionValues.id, { onDelete: 'cascade' }),
  },
  (t) => [
    unique('ProductVariantOptionValue_pk').on(t.variantId, t.optionValueId),
    index('ProductVariantOptionValue_variantId_idx').on(t.variantId),
    index('ProductVariantOptionValue_optionValueId_idx').on(t.optionValueId),
  ]
)

// ─── Order Tables ────────────────────────────────────────

export interface CheckoutRequestItemRecord {
  productId: string
  variantId: string
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
    addressLine1: text('addressLine1'),
    addressLine2: text('addressLine2'),
    addressLine3: text('addressLine3'),
    pinCode: text('pinCode'),
    city: text('city'),
    state: text('state'),
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
    addressLine1: text('addressLine1'),
    addressLine2: text('addressLine2'),
    addressLine3: text('addressLine3'),
    pinCode: text('pinCode'),
    city: text('city'),
    state: text('state'),
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
    variantId: varchar('variantId', { length: 7 })
      .notNull()
      .references(() => productVariants.id),
    quantity: integer('quantity').notNull(),
    price: doublePrecision('price').notNull(),
    customizationNote: text('customizationNote'),
  },
  (t) => [
    index('OrderItem_orderId_idx').on(t.orderId),
    index('OrderItem_productId_idx').on(t.productId),
    index('OrderItem_variantId_idx').on(t.variantId),
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
    variantId: varchar('variantId', { length: 7 })
      .notNull()
      .references(() => productVariants.id),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    unique('CartItem_cartId_productId_variantId_key').on(
      t.cartId,
      t.productId,
      t.variantId
    ),
    index('CartItem_cartId_idx').on(t.cartId),
    index('CartItem_productId_idx').on(t.productId),
    index('CartItem_variantId_idx').on(t.variantId),
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
    variantId: varchar('variantId', { length: 7 }).references(
      () => productVariants.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('ProductShare_productId_idx').on(t.productId),
    index('ProductShare_variantId_idx').on(t.variantId),
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
  options: many(productOptions),
  variants: many(productVariants),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
  wishlists: many(wishlists),
  reviews: many(reviews),
}))

export const productOptionsRelations = relations(
  productOptions,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productOptions.productId],
      references: [products.id],
    }),
    values: many(productOptionValues),
  })
)

export const productOptionValuesRelations = relations(
  productOptionValues,
  ({ one, many }) => ({
    option: one(productOptions, {
      fields: [productOptionValues.optionId],
      references: [productOptions.id],
    }),
    variantLinks: many(productVariantOptionValues),
  })
)

export const productVariantsRelations = relations(
  productVariants,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
    optionValues: many(productVariantOptionValues),
    orderItems: many(orderItems),
    cartItems: many(cartItems),
  })
)

export const productVariantOptionValuesRelations = relations(
  productVariantOptionValues,
  ({ one }) => ({
    variant: one(productVariants, {
      fields: [productVariantOptionValues.variantId],
      references: [productVariants.id],
    }),
    optionValue: one(productOptionValues, {
      fields: [productVariantOptionValues.optionValueId],
      references: [productOptionValues.id],
    }),
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
  variant: one(productVariants, {
    fields: [orderItems.variantId],
    references: [productVariants.id],
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
  variant: one(productVariants, {
    fields: [cartItems.variantId],
    references: [productVariants.id],
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
  variant: one(productVariants, {
    fields: [productShares.variantId],
    references: [productVariants.id],
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
