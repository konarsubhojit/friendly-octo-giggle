import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/products/[id]/route";

vi.mock("@/lib/db", () => ({
  db: {
    products: {
      findById: vi.fn(),
    },
  },
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

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
  logError: vi.fn(),
}));

import { db } from "@/lib/db";

describe("GET /api/products/[id]", () => {
  const mockProduct = {
    id: "abc123",
    name: "Test Product",
    description: "A test product",
    price: 29.99,
    stock: 100,
    image: "https://example.com/image.jpg",
    images: [],
    category: "Electronics",
    deletedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns product when found", async () => {
    vi.mocked(db.products.findById).mockResolvedValue(mockProduct);

    const request = new NextRequest("http://localhost/api/products/abc123");
    const response = await GET(request, {
      params: Promise.resolve({ id: "abc123" }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.product).toEqual(mockProduct);
    expect(db.products.findById).toHaveBeenCalledWith("abc123");
  });

  it("returns 404 when product not found", async () => {
    vi.mocked(db.products.findById).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/products/notfound");
    const response = await GET(request, {
      params: Promise.resolve({ id: "notfound" }),
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe("Product not found");
  });

  it("returns 500 on error", async () => {
    vi.mocked(db.products.findById).mockRejectedValue(
      new Error("Database error"),
    );

    const request = new NextRequest("http://localhost/api/products/abc123");
    const response = await GET(request, {
      params: Promise.resolve({ id: "abc123" }),
    });

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
