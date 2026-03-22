import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  db: {
    products: {
      findAllMinimal: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  cacheProductsList: vi.fn(
    async (fetcher: () => Promise<unknown>, _options?: unknown) => {
      return await fetcher();
    },
  ),
}));

vi.mock("@/lib/redis", () => ({
  getCachedData: vi.fn(
    async (
      _key: string,
      _ttl: number,
      fetcher: () => Promise<unknown>,
      _staleTime?: number,
    ) => {
      return await fetcher();
    },
  ),
}));

vi.mock("@/lib/api-middleware", () => ({
  withLogging: (fn: unknown) => fn,
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

import { GET } from "@/app/api/products/route";
import { db } from "@/lib/db";

describe("GET /api/products", () => {
  const mockProducts = [
    {
      id: "prod001",
      name: "Test Product 1",
      description: "A test product",
      price: 99.99,
      image: "https://example.com/img1.jpg",
      images: [],
      stock: 10,
      category: "electronics",
      deletedAt: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
    {
      id: "prod002",
      name: "Test Product 2",
      description: "Another test product",
      price: 149.99,
      image: "https://example.com/img2.jpg",
      images: [],
      stock: 5,
      category: "electronics",
      deletedAt: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns products on success", async () => {
    vi.mocked(db.products.findAllMinimal).mockResolvedValue(mockProducts);

    const response = await GET(
      new NextRequest("http://localhost/api/products"),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ success: true, data: { products: mockProducts } });
    expect(db.products.findAllMinimal).toHaveBeenCalledOnce();
  });

  it("sets Cache-Control header", async () => {
    vi.mocked(db.products.findAllMinimal).mockResolvedValue(mockProducts);

    const response = await GET(
      new NextRequest("http://localhost/api/products"),
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "s-maxage=60, stale-while-revalidate=120",
    );
  });

  it("returns 500 on error", async () => {
    vi.mocked(db.products.findAllMinimal).mockRejectedValue(
      new Error("DB error"),
    );

    const response = await GET(
      new NextRequest("http://localhost/api/products"),
    );
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body).toHaveProperty("error");
  });
});
