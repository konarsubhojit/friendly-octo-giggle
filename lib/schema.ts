import {
  pgTable,
  text,
  integer,
  timestamp,
  doublePrecision,
  pgEnum,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { AdapterAccountType } from '@auth/core/adapters';

// ─── Enums ───────────────────────────────────────────────

export const userRoleEnum = pgEnum('UserRole', ['CUSTOMER', 'ADMIN']);
export const orderStatusEnum = pgEnum('OrderStatus', [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

// ─── Auth Tables (NextAuth compatible) ───────────────────

export const users = pgTable('User', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  role: userRoleEnum('role').default('CUSTOMER').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
});

export const accounts = pgTable(
  'Account',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
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
    unique('Account_provider_providerAccountId_key').on(t.provider, t.providerAccountId),
    index('Account_userId_idx').on(t.userId),
  ]
);

export const sessions = pgTable('Session', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
}, (t) => [
  index('Session_userId_idx').on(t.userId),
]);

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
);

// ─── Product Tables ──────────────────────────────────────

export const products = pgTable('Product', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description').notNull(),
  price: doublePrecision('price').notNull(),
  image: text('image').notNull(),
  stock: integer('stock').notNull(),
  category: text('category').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
  index('Product_category_idx').on(t.category),
]);

export const productVariations = pgTable('ProductVariation', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  productId: text('productId')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  designName: text('designName').notNull(),
  image: text('image'),
  priceModifier: doublePrecision('priceModifier').default(0).notNull(),
  stock: integer('stock').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
  index('ProductVariation_productId_idx').on(t.productId),
  unique('ProductVariation_productId_name_key').on(t.productId, t.name),
]);

// ─── Order Tables ────────────────────────────────────────

export const orders = pgTable('Order', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').references(() => users.id),
  customerName: text('customerName').notNull(),
  customerEmail: text('customerEmail').notNull(),
  customerAddress: text('customerAddress').notNull(),
  totalAmount: doublePrecision('totalAmount').notNull(),
  status: orderStatusEnum('status').default('PENDING').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
  index('Order_userId_idx').on(t.userId),
]);

export const orderItems = pgTable('OrderItem', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('orderId')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('productId')
    .notNull()
    .references(() => products.id),
  variationId: text('variationId').references(() => productVariations.id),
  quantity: integer('quantity').notNull(),
  price: doublePrecision('price').notNull(),
}, (t) => [
  index('OrderItem_orderId_idx').on(t.orderId),
  index('OrderItem_productId_idx').on(t.productId),
  index('OrderItem_variationId_idx').on(t.variationId),
]);

// ─── Cart Tables ─────────────────────────────────────────

export const carts = pgTable('Cart', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').unique().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('sessionId').unique(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
  index('Cart_sessionId_idx').on(t.sessionId),
]);

export const cartItems = pgTable('CartItem', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  cartId: text('cartId')
    .notNull()
    .references(() => carts.id, { onDelete: 'cascade' }),
  productId: text('productId')
    .notNull()
    .references(() => products.id),
  variationId: text('variationId').references(() => productVariations.id),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('createdAt', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { mode: 'date' }).defaultNow().notNull(),
}, (t) => [
  unique('CartItem_cartId_productId_variationId_key').on(t.cartId, t.productId, t.variationId),
  index('CartItem_cartId_idx').on(t.cartId),
  index('CartItem_productId_idx').on(t.productId),
  index('CartItem_variationId_idx').on(t.variationId),
]);

// ─── Relations ───────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  orders: many(orders),
  cart: one(carts),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  variations: many(productVariations),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
}));

export const productVariationsRelations = relations(productVariations, ({ one, many }) => ({
  product: one(products, { fields: [productVariations.productId], references: [products.id] }),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variation: one(productVariations, { fields: [orderItems.variationId], references: [productVariations.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(users, { fields: [carts.userId], references: [users.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
  variation: one(productVariations, { fields: [cartItems.variationId], references: [productVariations.id] }),
}));
