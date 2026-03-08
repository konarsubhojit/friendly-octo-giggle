import { describe, it, expect } from "vitest";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  products,
  productVariations,
  orders,
  orderItems,
  carts,
  cartItems,
  usersRelations,
  accountsRelations,
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
});
