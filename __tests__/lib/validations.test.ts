import { describe, it, expect } from "vitest";
import {
  ProductSchema,
  ProductInputSchema,
  ProductUpdateSchema,
  OrderStatusEnum,
  OrderItemSchema,
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  AddToCartSchema,
  UpdateCartItemSchema,
  EnvSchema,
  ApiErrorSchema,
} from "@/lib/validations";

// Helpers
const validUUID = "550e8400-e29b-41d4-a716-446655440000";
const validISO = "2024-01-01T00:00:00.000Z";

describe("ProductSchema", () => {
  const validProduct = {
    id: validUUID,
    name: "Test Product",
    description: "A test product description",
    price: 29.99,
    image: "https://example.com/image.jpg",
    stock: 10,
    category: "Electronics",
    createdAt: validISO,
    updatedAt: validISO,
  };

  it("accepts valid product", () => {
    expect(ProductSchema.parse(validProduct)).toEqual(validProduct);
  });

  it("rejects invalid UUID", () => {
    expect(() =>
      ProductSchema.parse({ ...validProduct, id: "not-a-uuid" }),
    ).toThrow();
  });

  it("rejects empty name", () => {
    expect(() => ProductSchema.parse({ ...validProduct, name: "" })).toThrow();
  });

  it("rejects negative price", () => {
    expect(() => ProductSchema.parse({ ...validProduct, price: -5 })).toThrow();
  });

  it("rejects zero price", () => {
    expect(() => ProductSchema.parse({ ...validProduct, price: 0 })).toThrow();
  });

  it("rejects negative stock", () => {
    expect(() => ProductSchema.parse({ ...validProduct, stock: -1 })).toThrow();
  });

  it("accepts zero stock", () => {
    expect(ProductSchema.parse({ ...validProduct, stock: 0 }).stock).toBe(0);
  });

  it("rejects non-integer stock", () => {
    expect(() =>
      ProductSchema.parse({ ...validProduct, stock: 1.5 }),
    ).toThrow();
  });

  it("rejects invalid image URL", () => {
    expect(() =>
      ProductSchema.parse({ ...validProduct, image: "not-a-url" }),
    ).toThrow();
  });

  it("rejects invalid datetime format", () => {
    expect(() =>
      ProductSchema.parse({ ...validProduct, createdAt: "2024-01-01" }),
    ).toThrow();
  });

  it("rejects name exceeding 200 chars", () => {
    expect(() =>
      ProductSchema.parse({ ...validProduct, name: "x".repeat(201) }),
    ).toThrow();
  });
});

describe("ProductInputSchema", () => {
  it("accepts valid input without id/timestamps", () => {
    const input = {
      name: "New Product",
      description: "Description",
      price: 9.99,
      image: "https://example.com/img.png",
      stock: 5,
      category: "Books",
    };
    expect(ProductInputSchema.parse(input)).toEqual(input);
  });

  it("rejects extra id field", () => {
    const input = {
      id: validUUID,
      name: "Product",
      description: "Desc",
      price: 10,
      image: "https://example.com/img.png",
      stock: 5,
      category: "Books",
    };
    const parsed = ProductInputSchema.parse(input);
    expect(parsed).not.toHaveProperty("id");
  });
});

describe("ProductUpdateSchema", () => {
  it("accepts partial update", () => {
    expect(ProductUpdateSchema.parse({ name: "Updated" })).toEqual({
      name: "Updated",
    });
  });

  it("accepts empty object", () => {
    expect(ProductUpdateSchema.parse({})).toEqual({});
  });
});

describe("OrderStatusEnum", () => {
  it.each(["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"])(
    "accepts %s",
    (status) => {
      expect(OrderStatusEnum.parse(status)).toBe(status);
    },
  );

  it("rejects invalid status", () => {
    expect(() => OrderStatusEnum.parse("UNKNOWN")).toThrow();
  });
});

describe("OrderItemSchema", () => {
  const validItem = {
    productId: validUUID,
    quantity: 2,
    price: 19.99,
  };

  it("accepts valid order item", () => {
    expect(OrderItemSchema.parse(validItem)).toEqual({
      ...validItem,
      customizationNote: undefined,
    });
  });

  it("accepts item with customization note", () => {
    const item = { ...validItem, customizationNote: "Gift wrap please" };
    expect(OrderItemSchema.parse(item).customizationNote).toBe(
      "Gift wrap please",
    );
  });

  it("accepts null customization note", () => {
    const item = { ...validItem, customizationNote: null };
    expect(OrderItemSchema.parse(item).customizationNote).toBeNull();
  });

  it("rejects zero quantity", () => {
    expect(() =>
      OrderItemSchema.parse({ ...validItem, quantity: 0 }),
    ).toThrow();
  });

  it("rejects negative quantity", () => {
    expect(() =>
      OrderItemSchema.parse({ ...validItem, quantity: -1 }),
    ).toThrow();
  });

  it("rejects non-integer quantity", () => {
    expect(() =>
      OrderItemSchema.parse({ ...validItem, quantity: 1.5 }),
    ).toThrow();
  });

  it("rejects customization note exceeding 500 chars", () => {
    expect(() =>
      OrderItemSchema.parse({
        ...validItem,
        customizationNote: "x".repeat(501),
      }),
    ).toThrow();
  });
});

describe("CreateOrderSchema", () => {
  const validOrder = {
    customerName: "John Doe",
    customerEmail: "john@example.com",
    customerAddress: "123 Main Street, Anytown, USA 12345",
    items: [{ productId: validUUID, quantity: 1, price: 29.99 }],
  };

  it("accepts valid order", () => {
    const parsed = CreateOrderSchema.parse(validOrder);
    expect(parsed.customerName).toBe("John Doe");
  });

  it("rejects empty items array", () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, items: [] }),
    ).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, customerEmail: "not-email" }),
    ).toThrow();
  });

  it("rejects short address", () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, customerAddress: "short" }),
    ).toThrow();
  });

  it("rejects empty name", () => {
    expect(() =>
      CreateOrderSchema.parse({ ...validOrder, customerName: "" }),
    ).toThrow();
  });
});

describe("UpdateOrderStatusSchema", () => {
  it("accepts valid status update", () => {
    const result = UpdateOrderStatusSchema.parse({ status: "SHIPPED" });
    expect(result.status).toBe("SHIPPED");
  });

  it("accepts with optional tracking fields", () => {
    const result = UpdateOrderStatusSchema.parse({
      status: "SHIPPED",
      trackingNumber: "TRK123",
      shippingProvider: "FedEx",
    });
    expect(result.trackingNumber).toBe("TRK123");
  });
});

describe("AddToCartSchema", () => {
  it("accepts valid input", () => {
    const result = AddToCartSchema.parse({ productId: validUUID, quantity: 1 });
    expect(result.productId).toBe(validUUID);
  });

  it("accepts with variationId", () => {
    const result = AddToCartSchema.parse({
      productId: validUUID,
      variationId: validUUID,
      quantity: 2,
    });
    expect(result.variationId).toBe(validUUID);
  });

  it("accepts null variationId", () => {
    const result = AddToCartSchema.parse({
      productId: validUUID,
      variationId: null,
      quantity: 1,
    });
    expect(result.variationId).toBeNull();
  });

  it("rejects non-integer quantity", () => {
    expect(() =>
      AddToCartSchema.parse({ productId: validUUID, quantity: 1.5 }),
    ).toThrow();
  });

  it("rejects zero quantity", () => {
    expect(() =>
      AddToCartSchema.parse({ productId: validUUID, quantity: 0 }),
    ).toThrow();
  });
});

describe("UpdateCartItemSchema", () => {
  it("accepts valid quantity", () => {
    expect(UpdateCartItemSchema.parse({ quantity: 3 }).quantity).toBe(3);
  });

  it("rejects zero quantity", () => {
    expect(() => UpdateCartItemSchema.parse({ quantity: 0 })).toThrow();
  });
});

describe("EnvSchema", () => {
  it("accepts valid env", () => {
    const result = EnvSchema.parse({ DATABASE_URL: "postgres://localhost/db" });
    expect(result.DATABASE_URL).toBe("postgres://localhost/db");
  });

  it("rejects missing DATABASE_URL", () => {
    expect(() => EnvSchema.parse({})).toThrow();
  });

  it("accepts optional NODE_ENV", () => {
    const result = EnvSchema.parse({
      DATABASE_URL: "postgres://localhost/db",
      NODE_ENV: "test",
    });
    expect(result.NODE_ENV).toBe("test");
  });

  it("rejects invalid NODE_ENV", () => {
    expect(() =>
      EnvSchema.parse({
        DATABASE_URL: "postgres://localhost/db",
        NODE_ENV: "staging",
      }),
    ).toThrow();
  });
});

describe("ApiErrorSchema", () => {
  it("accepts valid error response", () => {
    const result = ApiErrorSchema.parse({
      error: "Something failed",
      success: false,
    });
    expect(result.error).toBe("Something failed");
  });

  it("accepts with details", () => {
    const result = ApiErrorSchema.parse({
      error: "Validation failed",
      success: false,
      details: { name: "Required" },
    });
    expect(result.details).toEqual({ name: "Required" });
  });

  it("rejects success: true", () => {
    expect(() =>
      ApiErrorSchema.parse({ error: "fail", success: true }),
    ).toThrow();
  });
});
