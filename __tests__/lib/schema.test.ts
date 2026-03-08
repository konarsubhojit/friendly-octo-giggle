import { describe, it, expect } from "vitest";
import * as schema from "@/lib/schema";

describe("schema", () => {
  it("exports all table definitions", () => {
    expect(schema.users).toBeDefined();
    expect(schema.accounts).toBeDefined();
    expect(schema.sessions).toBeDefined();
    expect(schema.verificationTokens).toBeDefined();
    expect(schema.products).toBeDefined();
    expect(schema.productVariations).toBeDefined();
    expect(schema.orders).toBeDefined();
    expect(schema.orderItems).toBeDefined();
    expect(schema.carts).toBeDefined();
    expect(schema.cartItems).toBeDefined();
  });

  it("exports all relation definitions", () => {
    expect(schema.usersRelations).toBeDefined();
    expect(schema.accountsRelations).toBeDefined();
    expect(schema.sessionsRelations).toBeDefined();
    expect(schema.productsRelations).toBeDefined();
    expect(schema.productVariationsRelations).toBeDefined();
    expect(schema.ordersRelations).toBeDefined();
    expect(schema.orderItemsRelations).toBeDefined();
    expect(schema.cartsRelations).toBeDefined();
    expect(schema.cartItemsRelations).toBeDefined();
  });

  it("exports enum definitions", () => {
    expect(schema.userRoleEnum).toBeDefined();
    expect(schema.orderStatusEnum).toBeDefined();
  });

  it("users table has expected columns", () => {
    const cols = Object.keys(schema.users);
    expect(cols).toContain("id");
    expect(cols).toContain("email");
    expect(cols).toContain("role");
  });

  it("products table has expected columns", () => {
    const cols = Object.keys(schema.products);
    expect(cols).toContain("id");
    expect(cols).toContain("name");
    expect(cols).toContain("price");
    expect(cols).toContain("stock");
    expect(cols).toContain("category");
  });

  it("orders table has expected columns", () => {
    const cols = Object.keys(schema.orders);
    expect(cols).toContain("id");
    expect(cols).toContain("userId");
    expect(cols).toContain("status");
    expect(cols).toContain("totalAmount");
  });

  it("carts table has expected columns", () => {
    const cols = Object.keys(schema.carts);
    expect(cols).toContain("id");
    expect(cols).toContain("userId");
    expect(cols).toContain("sessionId");
  });
});
