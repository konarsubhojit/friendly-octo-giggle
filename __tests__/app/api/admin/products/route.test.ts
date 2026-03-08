import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/products/route";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    products: {
      findAll: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getCachedData: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  CACHE_KEYS: { ADMIN_PRODUCTS_ALL: "admin:products:all" },
  CACHE_TTL: { ADMIN_PRODUCTS: 60, ADMIN_PRODUCTS_STALE: 10 },
  invalidateProductCaches: vi.fn(),
}));

vi.mock(
  "@/lib/validations",
  async () => await vi.importActual("@/lib/validations"),
);

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
}));

// Import mocked modules
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCachedData } from "@/lib/redis";
import { invalidateProductCaches } from "@/lib/cache";
import { revalidateTag } from "next/cache";

describe("Admin Products API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/products", () => {
    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Not authenticated");
    });

    it("returns 403 when not admin", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { role: "CUSTOMER" },
        expires: new Date().toISOString(),
      } as never);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Not authorized - Admin access required");
    });

    it("returns products on success", async () => {
      const mockProducts = [
        { id: "prod1", name: "Product 1", price: 19.99 },
        { id: "prod2", name: "Product 2", price: 29.99 },
      ];

      vi.mocked(auth).mockResolvedValue({
        user: { role: "ADMIN" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(getCachedData).mockResolvedValue(mockProducts);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.products).toEqual(mockProducts);
      expect(getCachedData).toHaveBeenCalledWith(
        "admin:products:all",
        60,
        expect.any(Function),
        10,
      );
    });
  });

  describe("POST /api/admin/products", () => {
    const validProductInput = {
      name: "Test Product",
      price: 29.99,
      stock: 100,
      category: "Electronics",
      description: "Test desc",
      image: "https://example.com/img.png",
    };

    const createPostRequest = (body: unknown) =>
      new NextRequest("http://localhost/api/admin/products", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
      });

    it("returns 401 when not authenticated", async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const request = createPostRequest(validProductInput);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Not authenticated");
    });

    it("returns 403 when not admin", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { role: "CUSTOMER" },
        expires: new Date().toISOString(),
      } as never);

      const request = createPostRequest(validProductInput);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Not authorized - Admin access required");
    });

    it("returns 400 for invalid input (Zod validation)", async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { role: "ADMIN" },
        expires: new Date().toISOString(),
      } as never);

      const invalidInput = {
        name: "", // Invalid: empty name
        price: -10, // Invalid: negative price
        stock: -5, // Invalid: negative stock
      };

      const request = createPostRequest(invalidInput);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("creates product successfully (201)", async () => {
      const mockCreatedProduct = {
        id: "newprod1",
        ...validProductInput,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.mocked(auth).mockResolvedValue({
        user: { role: "ADMIN" },
        expires: new Date().toISOString(),
      } as never);
      vi.mocked(db.products.create).mockResolvedValue(mockCreatedProduct);
      vi.mocked(invalidateProductCaches).mockResolvedValue(undefined);

      const request = createPostRequest(validProductInput);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.product).toEqual(mockCreatedProduct);
      expect(db.products.create).toHaveBeenCalledWith(validProductInput);
      expect(revalidateTag).toHaveBeenCalledWith("products", {});
      expect(invalidateProductCaches).toHaveBeenCalled();
    });
  });
});
