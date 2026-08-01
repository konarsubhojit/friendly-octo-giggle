import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  numeric,
  pgEnum,
  index,
  unique,
  json,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'
import type { AdapterAccountType } from '@auth/core/adapters'
import { generateShortId, generateOrderId } from './short-id'
import { MONEY_DECIMAL_PLACES } from './money'
import { PAYMENT_PROVIDERS } from './payments/providers'
import { SHIPPING_METHODS } from './shipping/methods'
import { USER_ROLES } from './constants/roles'

// ─── Money columns ───────────────────────────────────────
// Monetary values are stored as exact decimals (never floating point) so that
// totals, refunds and reconciliation never drift. Drizzle maps them back to
// JavaScript numbers; use the helpers in `lib/money.ts` for any arithmetic.

const MONEY_PRECISION = 12

const money = (name: string) =>
  numeric(name, {
    precision: MONEY_PRECISION,
    scale: MONEY_DECIMAL_PLACES,
    mode: 'number',
  })

// ─── Enums ───────────────────────────────────────────────

export const userRoleEnum = pgEnum('UserRole', USER_ROLES)

export const emailTypeEnum = pgEnum('EmailType', [
  'order_confirmation',
  'order_status_update',
  'order_refund_update',
  'abandoned_cart_reminder',
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

export const paymentStatusEnum = pgEnum('PaymentStatus', [
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED',
])

export const paymentProviderEnum = pgEnum('PaymentProvider', PAYMENT_PROVIDERS)

export const refundStatusEnum = pgEnum('RefundStatus', [
  'PENDING',
  'PROCESSED',
  'FAILED',
])

export const discountTypeEnum = pgEnum('DiscountType', [
  'PERCENTAGE',
  'FIXED_AMOUNT',
  'FREE_SHIPPING',
  'BOGO',
])

export const shippingMethodEnum = pgEnum('ShippingMethod', SHIPPING_METHODS)

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
  lockedUntil: timestamp('lockedUntil', { mode: 'date' }),
  sessionVersion: integer('sessionVersion').default(0).notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
})

/**
 * Per-user notification preference centre.
 *
 * One row per user; absent rows fall back to `DEFAULT_NOTIFICATION_PREFERENCES`
 * in `features/account/services/notification-preferences.ts`.
 */
export const notificationPreferences = pgTable('NotificationPreference', {
  userId: text('userId')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  transactionalEmail: boolean('transactionalEmail').notNull().default(true),
  transactionalPush: boolean('transactionalPush').notNull().default(false),
  transactionalSms: boolean('transactionalSms').notNull().default(false),
  marketingEmail: boolean('marketingEmail').notNull().default(false),
  marketingPush: boolean('marketingPush').notNull().default(false),
  marketingSms: boolean('marketingSms').notNull().default(false),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
})

/**
 * Web Push subscriptions (RFC 8291) owned by a user.
 * Endpoints are unique so re-subscribing the same browser updates in place.
 */
export const pushSubscriptions = pgTable(
  'PushSubscription',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('userAgent'),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [index('PushSubscription_userId_idx').on(t.userId)]
)

export const addresses = pgTable(
  'Address',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    addressLine1: text('addressLine1').notNull(),
    addressLine2: text('addressLine2'),
    addressLine3: text('addressLine3'),
    pinCode: text('pinCode').notNull(),
    city: text('city').notNull(),
    state: text('state').notNull(),
    isDefault: boolean('isDefault').notNull().default(false),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('Address_userId_idx').on(t.userId),
    uniqueIndex('Address_one_default_per_user_idx')
      .on(t.userId)
      .where(sql`${t.isDefault} = true`),
  ]
)

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
    price: money('price').notNull(),
    stock: integer('stock').notNull(),
    /** Shipping weight of one unit; null falls back to the engine default. */
    weightGrams: integer('weightGrams'),
    image: text('image'),
    images: json('images').$type<string[]>().default([]).notNull(),
    sortOrder: integer('sortOrder').notNull().default(0),
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

// ─── Promotion Tables ────────────────────────────────────

/**
 * A redeemable discount code.
 *
 * `usageCount` is the authoritative global redemption counter: it is bumped
 * with a conditional `UPDATE ... WHERE usageCount < usageLimit` inside the
 * order transaction, which both enforces the cap and serialises concurrent
 * redemptions of the same coupon (the row lock is held until commit).
 */
export const coupons = pgTable(
  'Coupon',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    /** Always persisted upper-cased so lookups are case-insensitive. */
    code: text('code').notNull().unique(),
    description: text('description'),
    discountType: discountTypeEnum('discountType').notNull(),
    /** Percentage (0-100) for PERCENTAGE, otherwise a monetary amount. */
    discountValue: money('discountValue').notNull().default(0),
    /** Optional ceiling applied to the computed discount. */
    maxDiscountAmount: money('maxDiscountAmount'),
    /** Cart subtotal required before the coupon applies. */
    minCartValue: money('minCartValue').notNull().default(0),
    /** When non-empty, only items in these categories are discountable. */
    scopedCategories: json('scopedCategories')
      .$type<string[]>()
      .notNull()
      .default([]),
    /** When non-empty, only these products are discountable. */
    scopedProductIds: json('scopedProductIds')
      .$type<string[]>()
      .notNull()
      .default([]),
    /** Global redemption cap; null means unlimited. */
    usageLimit: integer('usageLimit'),
    /** Per-user redemption cap; null means unlimited. */
    perUserLimit: integer('perUserLimit'),
    usageCount: integer('usageCount').notNull().default(0),
    /** When false the coupon may not be combined with any other coupon. */
    stackable: boolean('stackable').notNull().default(false),
    isActive: boolean('isActive').notNull().default(true),
    startsAt: timestamp('startsAt', { mode: 'date' }),
    endsAt: timestamp('endsAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('Coupon_isActive_idx').on(t.isActive),
    index('Coupon_endsAt_idx').on(t.endsAt),
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
    couponCode: text('couponCode'),
    shippingMethod: shippingMethodEnum('shippingMethod'),
    paymentProvider: paymentProviderEnum('paymentProvider'),
    paymentOrderId: text('paymentOrderId'),
    paymentTransactionId: text('paymentTransactionId'),
    paymentSignature: text('paymentSignature'),
    status: checkoutRequestStatusEnum('status').default('PENDING').notNull(),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('CheckoutRequest_userId_idx').on(t.userId),
    index('CheckoutRequest_status_idx').on(t.status),
    index('CheckoutRequest_createdAt_idx').on(t.createdAt),
    uniqueIndex('CheckoutRequest_paymentTransactionId_key').on(
      t.paymentTransactionId
    ),
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
    subtotalAmount: money('subtotalAmount').default(0).notNull(),
    shippingAmount: money('shippingAmount').default(0).notNull(),
    taxAmount: money('taxAmount').default(0).notNull(),
    shippingMethod: shippingMethodEnum('shippingMethod'),
    totalAmount: money('totalAmount').notNull(),
    /** Total discount applied; the pre-discount subtotal is total + discount. */
    discountAmount: money('discountAmount').default(0).notNull(),
    couponId: varchar('couponId', { length: 7 }).references(() => coupons.id, {
      onDelete: 'set null',
    }),
    /** Denormalised so the code survives coupon deletion (exports, emails). */
    couponCode: text('couponCode'),
    paymentStatus: paymentStatusEnum('paymentStatus')
      .default('PENDING')
      .notNull(),
    paymentProvider: paymentProviderEnum('paymentProvider'),
    paymentOrderId: text('paymentOrderId'),
    paymentTransactionId: text('paymentTransactionId'),
    amountPaid: money('amountPaid').default(0).notNull(),
    paidAt: timestamp('paidAt', { mode: 'date' }),
    status: orderStatusEnum('status').default('PENDING').notNull(),
    /**
     * Set the first time the order's stock is returned to inventory
     * (cancellation or full refund). Restocking is guarded by this column so a
     * cancellation followed by a refund can never credit the same item twice.
     */
    stockRestoredAt: timestamp('stockRestoredAt', { mode: 'date' }),
    trackingNumber: text('trackingNumber'),
    shippingProvider: text('shippingProvider'),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('Order_userId_idx').on(t.userId),
    index('Order_status_idx').on(t.status),
    index('Order_createdAt_idx').on(t.createdAt),
    index('Order_paymentStatus_idx').on(t.paymentStatus),
    unique('Order_paymentTransactionId_key').on(t.paymentTransactionId),
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
    price: money('price').notNull(),
    customizationNote: text('customizationNote'),
  },
  (t) => [
    index('OrderItem_orderId_idx').on(t.orderId),
    index('OrderItem_productId_idx').on(t.productId),
    index('OrderItem_variantId_idx').on(t.variantId),
  ]
)

/**
 * One row per refund attempt against an order.
 *
 * Rows are inserted before the gateway is called so a refund that fails
 * mid-flight is still visible to operators, and `gatewayRefundId` is unique so
 * a `refund.processed` webhook can reconcile the row exactly once.
 */
export const refunds = pgTable(
  'Refund',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    orderId: varchar('orderId', { length: 10 })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: paymentProviderEnum('provider').notNull(),
    /** Gateway payment the refund was issued against. */
    paymentTransactionId: text('paymentTransactionId').notNull(),
    /** Gateway refund id; null until the gateway accepts the refund. */
    gatewayRefundId: text('gatewayRefundId'),
    amount: money('amount').notNull(),
    status: refundStatusEnum('status').default('PENDING').notNull(),
    /** Operator-supplied reason, surfaced in exports and audit logs. */
    reason: text('reason'),
    /** Gateway or validation failure detail for `FAILED` refunds. */
    errorMessage: text('errorMessage'),
    /** Admin who issued the refund; null for customer-initiated cancellations. */
    initiatedById: text('initiatedById').references(() => users.id, {
      onDelete: 'set null',
    }),
    processedAt: timestamp('processedAt', { mode: 'date' }),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('Refund_orderId_idx').on(t.orderId),
    index('Refund_status_idx').on(t.status),
    index('Refund_createdAt_idx').on(t.createdAt),
    uniqueIndex('Refund_gatewayRefundId_key').on(t.gatewayRefundId),
  ]
)

/**
 * One row per coupon applied to an order. Inserted in the same transaction as
 * the order, so a redemption can never be recorded for an order that failed.
 */
export const couponRedemptions = pgTable(
  'CouponRedemption',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    couponId: varchar('couponId', { length: 7 })
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    userId: text('userId').references(() => users.id, { onDelete: 'set null' }),
    orderId: varchar('orderId', { length: 10 })
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    discountAmount: money('discountAmount').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    unique('CouponRedemption_couponId_orderId_key').on(t.couponId, t.orderId),
    index('CouponRedemption_couponId_idx').on(t.couponId),
    index('CouponRedemption_userId_idx').on(t.userId),
    index('CouponRedemption_createdAt_idx').on(t.createdAt),
  ]
)

// ─── Payment Webhook Deduplication ───────────────────────// One row per delivered gateway webhook event. The unique (provider, eventId)
// constraint makes processing idempotent: a duplicate delivery loses the race
// on insert and is short-circuited instead of re-running side effects.
// `processedAt` records when the side effects committed, so a delivery that
// died mid-flight can be reclaimed by a later retry instead of being silently
// swallowed as a duplicate.

export const webhookEvents = pgTable(
  'WebhookEvent',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    provider: paymentProviderEnum('provider').notNull(),
    eventId: text('eventId').notNull(),
    eventType: text('eventType').notNull(),
    receivedAt: timestamp('receivedAt', { mode: 'date' })
      .defaultNow()
      .notNull(),
    processedAt: timestamp('processedAt', { mode: 'date' }),
  },
  (t) => [
    unique('WebhookEvent_provider_eventId_key').on(t.provider, t.eventId),
    index('WebhookEvent_receivedAt_idx').on(t.receivedAt),
  ]
)

export const adminAuditLogs = pgTable(
  'AdminAuditLog',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Role the actor held when the action was performed. */
    role: userRoleEnum('role'),
    entity: text('entity').notNull(),
    entityId: text('entityId').notNull(),
    action: text('action').notNull(),
    diff: json('diff').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    index('AdminAuditLog_userId_idx').on(t.userId),
    index('AdminAuditLog_entity_idx').on(t.entity),
    index('AdminAuditLog_createdAt_idx').on(t.createdAt),
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

// ─── Abandoned Cart Reminder Table ──────────────────────

/**
 * Tracks abandoned-cart reminder emails sent per cart.
 * Cap is enforced by allowing at most two rows per cart
 * (reminderNumber = 1 for the 24-hour nudge, 2 for the 72-hour follow-up).
 */
export const abandonedCartReminders = pgTable(
  'AbandonedCartReminder',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    cartId: varchar('cartId', { length: 7 })
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 1 = first reminder (24 h), 2 = second reminder (72 h). */
    reminderNumber: integer('reminderNumber').notNull(),
    sentAt: timestamp('sentAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    unique('AbandonedCartReminder_cartId_reminderNumber_key').on(
      t.cartId,
      t.reminderNumber
    ),
    index('AbandonedCartReminder_cartId_idx').on(t.cartId),
    index('AbandonedCartReminder_userId_idx').on(t.userId),
    index('AbandonedCartReminder_sentAt_idx').on(t.sentAt),
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
    isVerifiedBuyer: boolean('isVerifiedBuyer').default(false).notNull(),
    helpfulCount: integer('helpfulCount').default(0).notNull(),
    notHelpfulCount: integer('notHelpfulCount').default(0).notNull(),
    isFeatured: boolean('isFeatured').default(false).notNull(),
    isHidden: boolean('isHidden').default(false).notNull(),
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

export const reviewVotes = pgTable(
  'ReviewVote',
  {
    id: varchar('id', { length: 7 })
      .primaryKey()
      .$defaultFn(() => generateShortId()),
    reviewId: varchar('reviewId', { length: 7 })
      .notNull()
      .references(() => reviews.id, { onDelete: 'cascade' }),
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    vote: integer('vote').notNull(),
    createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    unique('ReviewVote_reviewId_userId_key').on(t.reviewId, t.userId),
    index('ReviewVote_reviewId_idx').on(t.reviewId),
    index('ReviewVote_userId_idx').on(t.userId),
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
  addresses: many(addresses),
  checkoutRequests: many(checkoutRequests),
  orders: many(orders),
  cart: one(carts),
  passwordHistory: many(passwordHistory),
  wishlists: many(wishlists),
  reviewVotes: many(reviewVotes),
  adminAuditLogs: many(adminAuditLogs),
  notificationPreference: one(notificationPreferences),
  pushSubscriptions: many(pushSubscriptions),
  abandonedCartReminders: many(abandonedCartReminders),
}))

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
)

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
)

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
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
  coupon: one(coupons, {
    fields: [orders.couponId],
    references: [coupons.id],
  }),
  items: many(orderItems),
  refunds: many(refunds),
}))

export const refundsRelations = relations(refunds, ({ one }) => ({
  order: one(orders, { fields: [refunds.orderId], references: [orders.id] }),
  initiatedBy: one(users, {
    fields: [refunds.initiatedById],
    references: [users.id],
  }),
}))

export const couponsRelations = relations(coupons, ({ many }) => ({
  redemptions: many(couponRedemptions),
}))

export const couponRedemptionsRelations = relations(
  couponRedemptions,
  ({ one }) => ({
    coupon: one(coupons, {
      fields: [couponRedemptions.couponId],
      references: [coupons.id],
    }),
    user: one(users, {
      fields: [couponRedemptions.userId],
      references: [users.id],
    }),
    order: one(orders, {
      fields: [couponRedemptions.orderId],
      references: [orders.id],
    }),
  })
)

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
  reminders: many(abandonedCartReminders),
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

export const abandonedCartRemindersRelations = relations(
  abandonedCartReminders,
  ({ one }) => ({
    cart: one(carts, {
      fields: [abandonedCartReminders.cartId],
      references: [carts.id],
    }),
    user: one(users, {
      fields: [abandonedCartReminders.userId],
      references: [users.id],
    }),
  })
)

export const wishlistsRelations = relations(wishlists, ({ one }) => ({
  user: one(users, { fields: [wishlists.userId], references: [users.id] }),
  product: one(products, {
    fields: [wishlists.productId],
    references: [products.id],
  }),
}))

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
  order: one(orders, { fields: [reviews.orderId], references: [orders.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
  votes: many(reviewVotes),
}))

export const reviewVotesRelations = relations(reviewVotes, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewVotes.reviewId],
    references: [reviews.id],
  }),
  user: one(users, { fields: [reviewVotes.userId], references: [users.id] }),
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

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  user: one(users, {
    fields: [adminAuditLogs.userId],
    references: [users.id],
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
