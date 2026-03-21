import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/orders/route";
import { drizzleDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { invalidateCache } from "@/lib/redis";
import { invalidateUserOrderCaches } from "@/lib/cache";
import { logBusinessEvent, logError } from "@/lib/logger";

const mockCountWhere = vi.hoisted(() => vi.fn());
const mockCountFrom = vi.hoisted(() => vi.fn(() => ({ where: mockCountWhere })));
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockCountFrom })));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      orders: { findMany: vi.fn(), findFirst: vi.fn() },
      products: { findMany: vi.fn() },
      users: { findFirst: vi.fn() },
    },
    select: mockSelect,
    transaction: vi.fn(),
  },
}));

vi.mock("@/lib/schema", () => ({
  orders: {
    id: "id",
    userId: "userId",
    createdAt: "createdAt",
    status: "status",
  },
  orderItems: { id: "id" },
  products: { id: "id", stock: "stock", deletedAt: "deletedAt" },
  productVariations: { id: "id", stock: "stock" },
  users: { id: "id" },
}));

vi.mock("drizzle-orm", () => ({
  count: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  lt: vi.fn(),
  ilike: vi.fn(),
  or: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  invalidateCache: vi.fn(),
  getRedisClient: vi.fn(() => null),
}));

vi.mock("@/lib/cache", () => ({
  CACHE_KEYS: {
    PRODUCTS_BESTSELLERS: "products:bestsellers",
  },
  invalidateUserOrderCaches: vi.fn(),
}));

vi.mock("@/actions/orders", () => ({
  searchUserOrdersRedis: vi.fn().mockResolvedValue(null),
  writeOrderToRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@vercel/functions", () => ({
  waitUntil: vi.fn(),
}));

vi.mock("@/lib/api-middleware", () => ({
  withLogging: vi.fn((handler) => handler),
}));

vi.mock("@/lib/logger", () => ({
  logBusinessEvent: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    QSTASH_TOKEN: "test-token",
  },
}));

vi.mock("@/lib/qstash", () => ({
  getQStashClient: vi.fn(() => ({
    publishJSON: vi.fn().mockResolvedValue({ messageId: "test-msg-id" }),
  })),
}));

const mockAuth = vi.mocked(auth);
const mockInvalidateCache = vi.mocked(invalidateCache);
const mockInvalidateUserOrderCaches = vi.mocked(invalidateUserOrderCaches);
const mockLogBusinessEvent = vi.mocked(logBusinessEvent);
const mockLogError = vi.mocked(logError);
const mockFindManyOrders = vi.mocked(drizzleDb.query.orders.findMany);
const mockFindManyProducts = vi.mocked(drizzleDb.query.products.findMany);
const mockFindFirstOrder = vi.mocked(drizzleDb.query.orders.findFirst);
const mockFindFirstUser = vi.mocked(drizzleDb.query.users.findFirst);
const mockTransaction = vi.mocked(drizzleDb.transaction);

describe("GET /api/orders", () => {
  const mockOrders = [
    {
      id: "order1",
      userId: "user1",
      totalAmount: 100,
      status: "PENDING",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
      items: [
        {
          id: "item1",
          productId: "p1",
          quantity: 1,
          price: 100,
          product: {
            id: "p1",
            name: "Test Product",
            price: 100,
            createdAt: new Date("2024-01-01T00:00:00Z"),
            updatedAt: new Date("2024-01-01T00:00:00Z"),
          },
          variation: null,
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockCountWhere.mockResolvedValue([{ value: 0 }]);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/orders");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns orders for authenticated user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindManyOrders.mockResolvedValue(mockOrders as never);
    mockCountWhere.mockResolvedValue([{ value: 1 }]);

    const request = new NextRequest("http://localhost/api/orders");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.orders).toHaveLength(1);
    expect(data.orders[0].id).toBe("order1");
    expect(data.orders[0].createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(data.orders[0].items[0].product.createdAt).toBe(
      "2024-01-01T00:00:00.000Z",
    );
    expect(data.totalCount).toBe(1);
  });

  it("returns 500 on error", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindManyOrders.mockRejectedValue(new Error("DB error"));

    const request = new NextRequest("http://localhost/api/orders");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to fetch orders");
    expect(mockLogError).toHaveBeenCalled();
  });
});

describe("POST /api/orders", () => {
  const validBody = {
    customerName: "Test",
    customerEmail: "test@example.com",
    customerAddress: "123 Test St",
    items: [{ productId: "p1", quantity: 1 }],
  };

  const mockProduct = {
    id: "p1",
    name: "Test Product",
    price: 100,
    stock: 10,
    deletedAt: null,
    variations: [],
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  };

  const mockFullOrder = {
    id: "order1",
    userId: "user1",
    customerName: "Test",
    customerEmail: "test@example.com",
    customerAddress: "123 Test St",
    totalAmount: 100,
    status: "PENDING",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    items: [
      {
        id: "item1",
        orderId: "order1",
        productId: "p1",
        quantity: 1,
        price: 100,
        product: {
          id: "p1",
          name: "Test Product",
          price: 100,
          createdAt: new Date("2024-01-01T00:00:00Z"),
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        variation: null,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Authentication required");
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_create_failed",
        details: { reason: "not_authenticated" },
        success: false,
      }),
    );
  });

  it("returns 400 when items array is empty", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...validBody, items: [] }),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Order must contain at least one item");
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_create_failed",
        details: { reason: "missing_items" },
      }),
    );
  });

  it("returns 400 when email missing and user has no email", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: null },
    } as never);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerName: "Test",
        customerAddress: "123 Test St",
        items: [{ productId: "p1", quantity: 1 }],
      }),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Email address is required");
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_create_failed",
        details: { reason: "missing_email" },
      }),
    );
  });

  it("returns 400 when address missing", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerName: "Test",
        customerEmail: "test@example.com",
        items: [{ productId: "p1", quantity: 1 }],
      }),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Shipping address is required");
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_create_failed",
        details: { reason: "missing_address" },
      }),
    );
  });

  it("returns 404 when products not found", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindManyProducts.mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Some products not found");
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_create_failed",
        details: expect.objectContaining({ reason: "products_not_found" }),
      }),
    );
  });

  it("returns 400 for insufficient stock", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindManyProducts.mockResolvedValue([
      { ...mockProduct, stock: 0 },
    ] as never);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Insufficient stock");
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_create_failed",
        details: expect.objectContaining({ reason: "insufficient_stock" }),
      }),
    );
  });

  it("creates order successfully", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindManyProducts.mockResolvedValue([mockProduct] as never);

    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => [
              {
                id: "order1",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                updatedAt: new Date("2024-01-01T00:00:00Z"),
              },
            ]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn() })),
        })),
      };
      return cb(tx as never);
    });

    mockFindFirstOrder.mockResolvedValue(mockFullOrder as never);
    mockFindFirstUser.mockResolvedValue({ currencyPreference: "INR" } as never);
    mockInvalidateCache.mockResolvedValue(undefined);
    mockInvalidateUserOrderCaches.mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.order).toBeDefined();
    expect(data.order.id).toBe("order1");
    expect(data.order.createdAt).toBe("2024-01-01T00:00:00.000Z");
    expect(data.order.items[0].product.createdAt).toBe(
      "2024-01-01T00:00:00.000Z",
    );
    expect(mockLogBusinessEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "order_created",
        success: true,
      }),
    );
    expect(mockInvalidateCache).toHaveBeenCalledWith("products:*");
    expect(mockInvalidateCache).toHaveBeenCalledWith("product:p1");
    expect(mockInvalidateUserOrderCaches).toHaveBeenCalledWith("user1");
  });

  it("returns 500 on error", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindManyProducts.mockRejectedValue(new Error("Database error"));

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to create order");
    expect(mockLogError).toHaveBeenCalled();
  });

  it("returns 500 when fullOrder is null after creation", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindManyProducts.mockResolvedValue([mockProduct] as never);

    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => [
              {
                id: "order1",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                updatedAt: new Date("2024-01-01T00:00:00Z"),
              },
            ]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn() })),
        })),
      };
      return cb(tx as never);
    });

    mockFindFirstOrder.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Failed to retrieve created order");
  });

  it("handles order with variation and customization note", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);

    const productWithVariation = {
      ...mockProduct,
      variations: [{ id: "v1", priceModifier: 5, stock: 10 }],
    };
    mockFindManyProducts.mockResolvedValue([productWithVariation] as never);

    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => [
              {
                id: "order2",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                updatedAt: new Date("2024-01-01T00:00:00Z"),
              },
            ]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn() })),
        })),
      };
      return cb(tx as never);
    });

    const fullOrderWithVariation = {
      ...mockFullOrder,
      id: "order2",
      items: [
        {
          ...mockFullOrder.items[0],
          variationId: "v1",
          price: 105,
          customizationNote: "Custom text",
          product: mockFullOrder.items[0].product,
        },
      ],
    };
    mockFindFirstOrder.mockResolvedValue(fullOrderWithVariation as never);
    mockFindFirstUser.mockResolvedValue({ currencyPreference: "INR" } as never);
    mockInvalidateCache.mockResolvedValue(undefined);
    mockInvalidateUserOrderCaches.mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({
        ...validBody,
        items: [
          {
            productId: "p1",
            quantity: 1,
            variationId: "v1",
            customizationNote: "Custom text",
          },
        ],
      }),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.order).toBeDefined();
  });

  it("returns 404 when variation not found for an item", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);

    const productNoMatchingVariation = {
      ...mockProduct,
      variations: [{ id: "v1", priceModifier: 5, stock: 10 }],
    };
    mockFindManyProducts.mockResolvedValue([
      productNoMatchingVariation,
    ] as never);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({
        ...validBody,
        items: [{ productId: "p1", quantity: 1, variationId: "nonexistent" }],
      }),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("Variation not found");
  });

  it("uses session user name and email as defaults", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Session User", email: "session@example.com" },
    } as never);
    mockFindManyProducts.mockResolvedValue([mockProduct] as never);

    mockTransaction.mockImplementation(async (cb) => {
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(() => [
              {
                id: "order3",
                createdAt: new Date("2024-01-01T00:00:00Z"),
                updatedAt: new Date("2024-01-01T00:00:00Z"),
              },
            ]),
          })),
        })),
        update: vi.fn(() => ({
          set: vi.fn(() => ({ where: vi.fn() })),
        })),
      };
      return cb(tx as never);
    });

    mockFindFirstOrder.mockResolvedValue(mockFullOrder as never);
    mockFindFirstUser.mockResolvedValue({ currencyPreference: "INR" } as never);
    mockInvalidateCache.mockResolvedValue(undefined);
    mockInvalidateUserOrderCaches.mockResolvedValue(undefined);

    const request = new NextRequest("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerAddress: "123 Test St",
        items: [{ productId: "p1", quantity: 1 }],
      }),
      headers: { "content-type": "application/json" },
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  it("handles orders with string dates from cache in GET", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);

    const ordersWithStringDates = [
      {
        id: "order1",
        userId: "user1",
        totalAmount: 100,
        status: "PENDING",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        items: [
          {
            id: "item1",
            productId: "p1",
            quantity: 1,
            price: 100,
            product: {
              id: "p1",
              name: "Test Product",
              price: 100,
              createdAt: "2024-01-01T00:00:00.000Z",
              updatedAt: "2024-01-01T00:00:00.000Z",
            },
            variation: null,
          },
        ],
      },
    ];
    mockFindManyOrders.mockResolvedValue(ordersWithStringDates as never);

    const request = new NextRequest("http://localhost/api/orders");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.orders[0].createdAt).toBe("2024-01-01T00:00:00.000Z");
  });
});
