import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { NextRequest } from "next/server";

// Valid UUIDs for testing
const VALID_PRODUCT_ID = "11111111-1111-1111-1111-111111111111";
const VALID_CART_ID = "22222222-2222-2222-2222-222222222222";
const VALID_ITEM_ID = "33333333-3333-3333-3333-333333333333";

// Mock dependencies before importing the route
vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      products: { findFirst: vi.fn() },
      carts: { findFirst: vi.fn() },
      cartItems: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    delete: vi.fn(() => ({ where: vi.fn() })),
  },
}));

vi.mock("@/lib/schema", () => ({
  products: { id: "id", deletedAt: "deletedAt" },
  carts: { userId: "userId", sessionId: "sessionId", id: "id" },
  cartItems: {
    cartId: "cartId",
    productId: "productId",
    variationId: "variationId",
    id: "id",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

vi.mock("@/lib/redis", () => ({
  getCachedData: vi.fn(),
}));

vi.mock("@/lib/cache", () => ({
  CACHE_KEYS: {
    CART_BY_USER: (id: string) => `cart:user:${id}`,
    CART_BY_SESSION: (id: string) => `cart:session:${id}`,
  },
  CACHE_TTL: { CART: 30, CART_STALE: 5 },
  invalidateCartCache: vi.fn(),
}));

vi.mock("@/lib/validations", async () => {
  const actual = await vi.importActual("@/lib/validations");
  return actual;
});

// Import mocked modules
import { drizzleDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCachedData } from "@/lib/redis";
import { invalidateCartCache } from "@/lib/cache";
import { logError } from "@/lib/logger";

// Import route handlers
import { GET, POST, DELETE } from "@/app/api/cart/route";

describe("Cart API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/cart", () => {
    it("returns null cart when no user and no session cookie", async () => {
      (auth as Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/cart");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ cart: null });
      expect(getCachedData).not.toHaveBeenCalled();
    });

    it("returns cart for authenticated user", async () => {
      const mockCart = {
        id: "cart1",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        items: [
          {
            id: "item1",
            quantity: 2,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-02"),
            product: {
              id: "prod1",
              createdAt: new Date("2024-01-01"),
              updatedAt: new Date("2024-01-02"),
              variations: [],
            },
            variation: null,
          },
        ],
      };

      (auth as Mock).mockResolvedValue({ user: { id: "user123" } });
      (getCachedData as Mock).mockResolvedValue(mockCart);

      const request = new NextRequest("http://localhost/api/cart");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cart).toBeDefined();
      expect(data.cart.id).toBe("cart1");
      expect(data.cart.items).toHaveLength(1);
      expect(getCachedData).toHaveBeenCalledWith(
        "cart:user:user123",
        30,
        expect.any(Function),
        5,
      );
    });

    it("returns cart for guest with session cookie", async () => {
      const mockCart = {
        id: "cart2",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        items: [],
      };

      (auth as Mock).mockResolvedValue(null);
      (getCachedData as Mock).mockResolvedValue(mockCart);

      const request = new NextRequest("http://localhost/api/cart", {
        headers: { cookie: "cart_session=guest123" },
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cart).toBeDefined();
      expect(data.cart.id).toBe("cart2");
      expect(getCachedData).toHaveBeenCalledWith(
        "cart:session:guest123",
        30,
        expect.any(Function),
        5,
      );
    });

    it("returns null cart when getCachedData returns undefined", async () => {
      (auth as Mock).mockResolvedValue({ user: { id: "user123" } });
      (getCachedData as Mock).mockResolvedValue(undefined);

      const request = new NextRequest("http://localhost/api/cart");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ cart: null });
    });

    it("returns 500 on error", async () => {
      (auth as Mock).mockRejectedValue(new Error("Auth failed"));

      const request = new NextRequest("http://localhost/api/cart");
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to fetch cart" });
      expect(logError).toHaveBeenCalled();
    });
  });

  describe("POST /api/cart", () => {
    it("returns 400 for invalid input (no productId)", async () => {
      (auth as Mock).mockResolvedValue({ user: { id: "user123" } });

      const request = new NextRequest("http://localhost/api/cart", {
        method: "POST",
        body: JSON.stringify({ quantity: 1 }),
        headers: { "content-type": "application/json" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("returns 404 when product not found", async () => {
      (auth as Mock).mockResolvedValue({ user: { id: "user123" } });
      (drizzleDb.query.products.findFirst as Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/cart", {
        method: "POST",
        body: JSON.stringify({ productId: VALID_PRODUCT_ID, quantity: 1 }),
        headers: { "content-type": "application/json" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data).toEqual({ error: "Product not found" });
    });

    it("returns 400 for insufficient stock", async () => {
      (auth as Mock).mockResolvedValue({ user: { id: "user123" } });
      (drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        stock: 2,
        variations: [],
      });

      const request = new NextRequest("http://localhost/api/cart", {
        method: "POST",
        body: JSON.stringify({ productId: VALID_PRODUCT_ID, quantity: 10 }),
        headers: { "content-type": "application/json" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: "Insufficient stock" });
    });

    it("creates cart item for authenticated user (201)", async () => {
      const mockCart = {
        id: VALID_CART_ID,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        items: [
          {
            id: VALID_ITEM_ID,
            quantity: 1,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-02"),
            product: {
              id: VALID_PRODUCT_ID,
              name: "Test Product",
              createdAt: new Date("2024-01-01"),
              updatedAt: new Date("2024-01-02"),
              variations: [],
            },
            variation: null,
          },
        ],
      };

      (auth as Mock).mockResolvedValue({ user: { id: "user123" } });
      (drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        stock: 10,
        variations: [],
      });
      // User already has a cart
      (drizzleDb.query.carts.findFirst as Mock)
        .mockResolvedValueOnce({ id: VALID_CART_ID }) // getOrCreateCart
        .mockResolvedValueOnce(mockCart); // fetch updated cart
      // No existing cart item
      (drizzleDb.query.cartItems.findFirst as Mock).mockResolvedValue(null);
      // Mock insert for new cart item
      const insertValuesMock = vi.fn(() => ({ returning: vi.fn() }));
      (drizzleDb.insert as Mock).mockReturnValue({ values: insertValuesMock });

      const request = new NextRequest("http://localhost/api/cart", {
        method: "POST",
        body: JSON.stringify({ productId: VALID_PRODUCT_ID, quantity: 1 }),
        headers: { "content-type": "application/json" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.cart).toBeDefined();
      expect(data.cart.id).toBe(VALID_CART_ID);
      expect(invalidateCartCache).toHaveBeenCalledWith("user123", undefined);
    });

    it("creates new cart for guest user", async () => {
      const mockCart = {
        id: VALID_CART_ID,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        items: [],
      };

      (auth as Mock).mockResolvedValue(null);
      (drizzleDb.query.products.findFirst as Mock).mockResolvedValue({
        id: VALID_PRODUCT_ID,
        stock: 10,
        variations: [],
      });
      // No existing cart for guest
      (drizzleDb.query.carts.findFirst as Mock)
        .mockResolvedValueOnce(null) // getOrCreateCart - no cart
        .mockResolvedValueOnce(mockCart); // fetch updated cart
      // Mock insert to create cart
      const insertReturningMock = vi
        .fn()
        .mockResolvedValue([{ id: VALID_CART_ID }]);
      const insertValuesMock = vi.fn(() => ({
        returning: insertReturningMock,
      }));
      (drizzleDb.insert as Mock).mockReturnValue({ values: insertValuesMock });
      // No existing cart item
      (drizzleDb.query.cartItems.findFirst as Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/cart", {
        method: "POST",
        body: JSON.stringify({ productId: VALID_PRODUCT_ID, quantity: 1 }),
        headers: { "content-type": "application/json" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.cart).toBeDefined();
      // Guest should get a session cookie
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("cart_session=");
    });

    it("returns 500 on error", async () => {
      (auth as Mock).mockRejectedValue(new Error("Auth failed"));

      const request = new NextRequest("http://localhost/api/cart", {
        method: "POST",
        body: JSON.stringify({ productId: VALID_PRODUCT_ID, quantity: 1 }),
        headers: { "content-type": "application/json" },
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to add to cart" });
      expect(logError).toHaveBeenCalled();
    });
  });

  describe("DELETE /api/cart", () => {
    it("clears cart for authenticated user", async () => {
      (auth as Mock).mockResolvedValue({ user: { id: "user123" } });
      (drizzleDb.query.carts.findFirst as Mock).mockResolvedValue({
        id: "cart1",
      });
      const deleteWhereMock = vi.fn();
      (drizzleDb.delete as Mock).mockReturnValue({ where: deleteWhereMock });

      const request = new NextRequest("http://localhost/api/cart", {
        method: "DELETE",
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(drizzleDb.delete).toHaveBeenCalled();
      expect(invalidateCartCache).toHaveBeenCalledWith("user123", undefined);
    });

    it("clears cart for guest user with session", async () => {
      (auth as Mock).mockResolvedValue(null);
      (drizzleDb.query.carts.findFirst as Mock).mockResolvedValue({
        id: "cart2",
      });
      const deleteWhereMock = vi.fn();
      (drizzleDb.delete as Mock).mockReturnValue({ where: deleteWhereMock });

      const request = new NextRequest("http://localhost/api/cart", {
        method: "DELETE",
        headers: { cookie: "cart_session=guest123" },
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(invalidateCartCache).toHaveBeenCalledWith(undefined, "guest123");
      // Cookie should be deleted
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toContain("cart_session=");
    });

    it("returns success when no user and no session", async () => {
      (auth as Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/cart", {
        method: "DELETE",
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(drizzleDb.query.carts.findFirst).not.toHaveBeenCalled();
      expect(drizzleDb.delete).not.toHaveBeenCalled();
    });

    it("returns success when cart not found", async () => {
      (auth as Mock).mockResolvedValue({ user: { id: "user123" } });
      (drizzleDb.query.carts.findFirst as Mock).mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/cart", {
        method: "DELETE",
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(drizzleDb.delete).not.toHaveBeenCalled();
      expect(invalidateCartCache).toHaveBeenCalled();
    });

    it("returns 500 on error", async () => {
      (auth as Mock).mockRejectedValue(new Error("Auth failed"));

      const request = new NextRequest("http://localhost/api/cart", {
        method: "DELETE",
      });
      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data).toEqual({ error: "Failed to clear cart" });
      expect(logError).toHaveBeenCalled();
    });
  });
});
