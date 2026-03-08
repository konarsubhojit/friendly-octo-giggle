import { describe, it, expect, beforeEach, Mock, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock external dependencies
vi.mock("@/lib/db", () => ({
  drizzleDb: {
    select: vi.fn(),
    query: {
      products: {
        findMany: vi.fn(),
      },
    },
  },
}));

vi.mock("@/lib/redis", () => ({
  getCachedData: vi.fn(),
}));

vi.mock("@/lib/schema", () => ({
  orderItems: {},
  orders: {},
  products: {},
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn(),
  desc: vi.fn(),
  gt: vi.fn(),
  eq: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  and: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
}));

import { GET } from "@/app/api/products/trending/route";
import { getCachedData } from "@/lib/redis";
import { drizzleDb } from "@/lib/db";

describe("GET /api/products/trending", () => {
  const mockTrendingProducts = [
    {
      id: "prod001",
      name: "Trending Product 1",
      price: 99.99,
      stock: 10,
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-01T00:00:00.000Z",
      totalSold: 150,
      variations: [],
    },
    {
      id: "prod002",
      name: "Trending Product 2",
      price: 149.99,
      stock: 5,
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-02T00:00:00.000Z",
      totalSold: 100,
      variations: [],
    },
    {
      id: "prod003",
      name: "Trending Product 3",
      price: 199.99,
      stock: 8,
      createdAt: "2026-03-03T00:00:00.000Z",
      updatedAt: "2026-03-03T00:00:00.000Z",
      totalSold: 75,
      variations: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns trending products with default limit of 6", async () => {
    (getCachedData as Mock).mockResolvedValue(mockTrendingProducts);

    const request = new NextRequest("http://localhost/api/products/trending");
    const response = await GET(request);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      data: { products: mockTrendingProducts },
    });

    expect(getCachedData).toHaveBeenCalledWith(
      "products:trending:6",
      300,
      expect.any(Function),
      60,
    );
  });

  it("respects limit query parameter", async () => {
    const limitedProducts = mockTrendingProducts.slice(0, 2);
    (getCachedData as Mock).mockResolvedValue(limitedProducts);

    const request = new NextRequest(
      "http://localhost/api/products/trending?limit=2",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      data: { products: limitedProducts },
    });

    expect(getCachedData).toHaveBeenCalledWith(
      "products:trending:2",
      300,
      expect.any(Function),
      60,
    );
  });

  it("treats limit=0 as default (falsy value)", async () => {
    (getCachedData as Mock).mockResolvedValue(mockTrendingProducts);

    const request = new NextRequest(
      "http://localhost/api/products/trending?limit=0",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    // 0 is falsy, so `Number("0") || 6` = 6
    expect(getCachedData).toHaveBeenCalledWith(
      "products:trending:6",
      300,
      expect.any(Function),
      60,
    );
  });

  it("clamps limit to maximum of 20", async () => {
    (getCachedData as Mock).mockResolvedValue(mockTrendingProducts);

    const request = new NextRequest(
      "http://localhost/api/products/trending?limit=50",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getCachedData).toHaveBeenCalledWith(
      "products:trending:20",
      300,
      expect.any(Function),
      60,
    );
  });

  it("handles non-numeric limit by using default", async () => {
    (getCachedData as Mock).mockResolvedValue(mockTrendingProducts);

    const request = new NextRequest(
      "http://localhost/api/products/trending?limit=invalid",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getCachedData).toHaveBeenCalledWith(
      "products:trending:6",
      300,
      expect.any(Function),
      60,
    );
  });

  it("returns empty array when no trending products", async () => {
    (getCachedData as Mock).mockResolvedValue([]);

    const request = new NextRequest("http://localhost/api/products/trending");
    const response = await GET(request);

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      success: true,
      data: { products: [] },
    });
  });

  it("returns 500 on error", async () => {
    (getCachedData as Mock).mockRejectedValue(new Error("Cache error"));

    const request = new NextRequest("http://localhost/api/products/trending");
    const response = await GET(request);

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body).toHaveProperty("error");
  });

  it("handles negative limit by clamping to 1", async () => {
    (getCachedData as Mock).mockResolvedValue([mockTrendingProducts[0]]);

    const request = new NextRequest(
      "http://localhost/api/products/trending?limit=-5",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(getCachedData).toHaveBeenCalledWith(
      "products:trending:1",
      300,
      expect.any(Function),
      60,
    );
  });
});

describe("GET /api/products/trending - fetcher callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupSelectChain(trendingResult: Array<{ productId: string; totalSold: number }>) {
    const limitMock = vi.fn().mockResolvedValue(trendingResult);
    const orderByMock = vi.fn(() => ({ limit: limitMock }));
    const groupByMock = vi.fn(() => ({ orderBy: orderByMock }));
    const whereMock = vi.fn(() => ({ groupBy: groupByMock }));
    const innerJoinMock = vi.fn(() => ({ where: whereMock }));
    const fromMock = vi.fn(() => ({ innerJoin: innerJoinMock }));
    (drizzleDb.select as Mock).mockReturnValue({ from: fromMock });
  }

  it("returns fallback newest products when no trending data (Date objects)", async () => {
    (getCachedData as Mock).mockImplementation(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher());

    // No trending products found
    setupSelectChain([]);

    // Fallback: newest products with Date objects
    (drizzleDb.query.products.findMany as Mock).mockResolvedValue([
      {
        id: "p1",
        name: "New Product",
        price: 50,
        stock: 5,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        variations: [],
      },
    ]);

    const request = new NextRequest("http://localhost/api/products/trending");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.products).toHaveLength(1);
    expect(body.data.products[0].totalSold).toBe(0);
    expect(body.data.products[0].createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(body.data.products[0].updatedAt).toBe("2026-01-02T00:00:00.000Z");
  });

  it("returns fallback newest products when dates are already strings", async () => {
    (getCachedData as Mock).mockImplementation(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher());

    setupSelectChain([]);

    (drizzleDb.query.products.findMany as Mock).mockResolvedValue([
      {
        id: "p2",
        name: "Cached Product",
        price: 30,
        stock: 3,
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-02T00:00:00.000Z",
        variations: [],
      },
    ]);

    const request = new NextRequest("http://localhost/api/products/trending");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.products[0].createdAt).toBe("2026-02-01T00:00:00.000Z");
    expect(body.data.products[0].totalSold).toBe(0);
  });

  it("returns trending products sorted by totalSold (Date objects)", async () => {
    (getCachedData as Mock).mockImplementation(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher());

    setupSelectChain([
      { productId: "p1", totalSold: 50 },
      { productId: "p2", totalSold: 100 },
    ]);

    (drizzleDb.query.products.findMany as Mock).mockResolvedValue([
      {
        id: "p1",
        name: "Product A",
        price: 10,
        stock: 5,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-02T00:00:00Z"),
        variations: [],
      },
      {
        id: "p2",
        name: "Product B",
        price: 20,
        stock: 8,
        createdAt: new Date("2026-01-03T00:00:00Z"),
        updatedAt: new Date("2026-01-04T00:00:00Z"),
        variations: [],
      },
    ]);

    const request = new NextRequest("http://localhost/api/products/trending");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.products).toHaveLength(2);
    // Sorted by totalSold descending
    expect(body.data.products[0].id).toBe("p2");
    expect(body.data.products[0].totalSold).toBe(100);
    expect(body.data.products[1].id).toBe("p1");
    expect(body.data.products[1].totalSold).toBe(50);
    expect(body.data.products[0].createdAt).toBe("2026-01-03T00:00:00.000Z");
  });

  it("handles product not in soldMap (defaults to 0)", async () => {
    (getCachedData as Mock).mockImplementation(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher());

    setupSelectChain([{ productId: "p1", totalSold: 25 }]);

    // findMany returns a product whose id is NOT in the soldMap
    (drizzleDb.query.products.findMany as Mock).mockResolvedValue([
      {
        id: "p1",
        name: "Known Product",
        price: 10,
        stock: 5,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        variations: [],
      },
      {
        id: "p-unknown",
        name: "Unknown Product",
        price: 15,
        stock: 3,
        createdAt: "2026-01-05T00:00:00.000Z",
        updatedAt: "2026-01-05T00:00:00.000Z",
        variations: [],
      },
    ]);

    const request = new NextRequest("http://localhost/api/products/trending");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    const unknownProduct = body.data.products.find((p: { id: string }) => p.id === "p-unknown");
    expect(unknownProduct.totalSold).toBe(0);
  });

  it("converts Date objects to ISO strings in trending path", async () => {
    (getCachedData as Mock).mockImplementation(async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher());

    setupSelectChain([{ productId: "p1", totalSold: 10 }]);

    (drizzleDb.query.products.findMany as Mock).mockResolvedValue([
      {
        id: "p1",
        name: "Date Product",
        price: 20,
        stock: 10,
        createdAt: new Date("2026-03-01T12:00:00Z"),
        updatedAt: new Date("2026-03-02T12:00:00Z"),
        variations: [],
      },
    ]);

    const request = new NextRequest("http://localhost/api/products/trending");
    const response = await GET(request);
    const body = await response.json();

    expect(body.data.products[0].createdAt).toBe("2026-03-01T12:00:00.000Z");
    expect(body.data.products[0].updatedAt).toBe("2026-03-02T12:00:00.000Z");
  });
});
