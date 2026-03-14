import { describe, it, expect } from "vitest";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  passwordHistory,
  products,
  productVariations,
  orders,
  orderItems,
  carts,
  cartItems,
  usersRelations,
  accountsRelations,
  passwordHistoryRelations,
  sessionsRelations,
  productsRelations,
  productVariationsRelations,
  ordersRelations,
  orderItemsRelations,
  cartsRelations,
  cartItemsRelations,
  userRoleEnum,
  orderStatusEnum,
} from "@/lib/schema";

describe("schema", () => {
  it("exports all table definitions", () => {
    expect(users).toBeDefined();
    expect(accounts).toBeDefined();
    expect(sessions).toBeDefined();
    expect(verificationTokens).toBeDefined();
    expect(passwordHistory).toBeDefined();
    expect(products).toBeDefined();
    expect(productVariations).toBeDefined();
    expect(orders).toBeDefined();
    expect(orderItems).toBeDefined();
    expect(carts).toBeDefined();
    expect(cartItems).toBeDefined();
  });

  it("exports all relation definitions", () => {
    expect(usersRelations).toBeDefined();
    expect(accountsRelations).toBeDefined();
    expect(passwordHistoryRelations).toBeDefined();
    expect(sessionsRelations).toBeDefined();
    expect(productsRelations).toBeDefined();
    expect(productVariationsRelations).toBeDefined();
    expect(ordersRelations).toBeDefined();
    expect(orderItemsRelations).toBeDefined();
    expect(cartsRelations).toBeDefined();
    expect(cartItemsRelations).toBeDefined();
  });

  it("exports enum definitions", () => {
    expect(userRoleEnum).toBeDefined();
    expect(orderStatusEnum).toBeDefined();
  });

  it("users table has expected columns", () => {
    const cols = Object.keys(users);
    expect(cols).toContain("id");
    expect(cols).toContain("email");
    expect(cols).toContain("role");
  });

  it("products table has expected columns", () => {
    const cols = Object.keys(products);
    expect(cols).toContain("id");
    expect(cols).toContain("name");
    expect(cols).toContain("price");
    expect(cols).toContain("stock");
    expect(cols).toContain("category");
  });

  it("orders table has expected columns", () => {
    const cols = Object.keys(orders);
    expect(cols).toContain("id");
    expect(cols).toContain("userId");
    expect(cols).toContain("status");
    expect(cols).toContain("totalAmount");
  });

  it("carts table has expected columns", () => {
    const cols = Object.keys(carts);
    expect(cols).toContain("id");
    expect(cols).toContain("userId");
    expect(cols).toContain("sessionId");
  });

  it("accounts table has expected columns", () => {
    const cols = Object.keys(accounts);
    expect(cols).toContain("id");
    expect(cols).toContain("userId");
    expect(cols).toContain("type");
    expect(cols).toContain("provider");
    expect(cols).toContain("providerAccountId");
    expect(cols).toContain("refresh_token");
    expect(cols).toContain("access_token");
    expect(cols).toContain("expires_at");
    expect(cols).toContain("token_type");
    expect(cols).toContain("scope");
    expect(cols).toContain("id_token");
    expect(cols).toContain("session_state");
  });

  it("sessions table has expected columns", () => {
    const cols = Object.keys(sessions);
    expect(cols).toContain("sessionToken");
    expect(cols).toContain("userId");
    expect(cols).toContain("expires");
  });

  it("verificationTokens table has expected columns", () => {
    const cols = Object.keys(verificationTokens);
    expect(cols).toContain("identifier");
    expect(cols).toContain("token");
    expect(cols).toContain("expires");
  });

  it("productVariations table has expected columns", () => {
    const cols = Object.keys(productVariations);
    expect(cols).toContain("id");
    expect(cols).toContain("productId");
    expect(cols).toContain("name");
    expect(cols).toContain("designName");
    expect(cols).toContain("image");
    expect(cols).toContain("priceModifier");
    expect(cols).toContain("stock");
  });

  it("orderItems table has expected columns", () => {
    const cols = Object.keys(orderItems);
    expect(cols).toContain("id");
    expect(cols).toContain("orderId");
    expect(cols).toContain("productId");
    expect(cols).toContain("variationId");
    expect(cols).toContain("quantity");
    expect(cols).toContain("price");
    expect(cols).toContain("customizationNote");
  });

  it("cartItems table has expected columns", () => {
    const cols = Object.keys(cartItems);
    expect(cols).toContain("id");
    expect(cols).toContain("cartId");
    expect(cols).toContain("productId");
    expect(cols).toContain("variationId");
    expect(cols).toContain("quantity");
  });

  it("orders table has all expected columns", () => {
    const cols = Object.keys(orders);
    expect(cols).toContain("customerName");
    expect(cols).toContain("customerEmail");
    expect(cols).toContain("customerAddress");
    expect(cols).toContain("trackingNumber");
    expect(cols).toContain("shippingProvider");
    expect(cols).toContain("createdAt");
    expect(cols).toContain("updatedAt");
  });

  it("products table has all expected columns", () => {
    const cols = Object.keys(products);
    expect(cols).toContain("description");
    expect(cols).toContain("image");
    expect(cols).toContain("deletedAt");
    expect(cols).toContain("createdAt");
    expect(cols).toContain("updatedAt");
  });

  it("users table has all expected columns", () => {
    const cols = Object.keys(users);
    expect(cols).toContain("name");
    expect(cols).toContain("emailVerified");
    expect(cols).toContain("image");
    expect(cols).toContain("passwordHash");
    expect(cols).toContain("phoneNumber");
    expect(cols).toContain("createdAt");
    expect(cols).toContain("updatedAt");
  });

  it("passwordHistory table has expected columns", () => {
    const cols = Object.keys(passwordHistory);
    expect(cols).toContain("id");
    expect(cols).toContain("userId");
    expect(cols).toContain("passwordHash");
    expect(cols).toContain("createdAt");
  });
});
