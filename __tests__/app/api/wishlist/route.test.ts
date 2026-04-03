import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockAuth, mockDb, mockLogError } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockDb: {
    wishlists: {
      getProducts: vi.fn(),
      add: vi.fn(),
      remove: vi.fn(),
    },
  },
  mockLogError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/logger", () => ({ logError: mockLogError }));

import { GET, POST } from "@/app/api/wishlist/route";

describe("wishlist API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/wishlist");
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it("returns wishlist products", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user1" } });
      mockDb.wishlists.getProducts.mockResolvedValue([
        { id: "p1", name: "Product 1" },
        { id: "p2", name: "Product 2" },
      ]);

      const request = new NextRequest("http://localhost/api/wishlist");
      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.products).toHaveLength(2);
      expect(body.data.productIds).toEqual(["p1", "p2"]);
    });

    it("handles errors", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user1" } });
      mockDb.wishlists.getProducts.mockRejectedValue(new Error("DB error"));

      const request = new NextRequest("http://localhost/api/wishlist");
      const response = await GET(request);

      expect(response.status).toBe(500);
      expect(mockLogError).toHaveBeenCalled();
    });
  });

  describe("POST", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const request = new NextRequest("http://localhost/api/wishlist", {
        method: "POST",
        body: JSON.stringify({ productId: "p1" }),
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it("returns 400 for missing productId", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user1" } });

      const request = new NextRequest("http://localhost/api/wishlist", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("adds product to wishlist", async () => {
      mockAuth.mockResolvedValue({ user: { id: "user1" } });
      mockDb.wishlists.add.mockResolvedValue(undefined);

      const request = new NextRequest("http://localhost/api/wishlist", {
        method: "POST",
        body: JSON.stringify({ productId: "p1" }),
      });
      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.productId).toBe("p1");
      expect(mockDb.wishlists.add).toHaveBeenCalledWith("user1", "p1");
    });
  });
});
