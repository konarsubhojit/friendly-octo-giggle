import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const {
  mockFindMany,
  mockFindFirst,
  mockInsertReturning,
  mockInsert,
} = vi.hoisted(() => {
  const mockInsertReturning = vi.fn();
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }));
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }));
  return {
    mockFindMany: vi.fn(),
    mockFindFirst: vi.fn(),
    mockInsertReturning,
    mockInsert,
  };
});

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      reviews: { findMany: mockFindMany, findFirst: mockFindFirst },
    },
    insert: mockInsert,
  },
}));
vi.mock("@/lib/schema", () => ({
  reviews: {
    productId: "productId",
    userId: "userId",
    createdAt: "createdAt",
  },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/api-middleware", () => ({
  withLogging: vi.fn((handler) => handler),
}));
vi.mock("@/lib/validations", async () => await vi.importActual("@/lib/validations"));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { GET, POST } from "@/app/api/reviews/route";
import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth);

const makeGetRequest = (params?: Record<string, string>) => {
  const url = new URL("http://localhost/api/reviews");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
};

const makePostRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/reviews", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("Reviews API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/reviews", () => {
    it("returns 400 when productId is missing", async () => {
      const response = await GET(makeGetRequest());
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toContain("productId");
    });

    it("returns reviews for a product", async () => {
      const mockReviews = [
        {
          id: "rev1",
          rating: 5,
          comment: "Great product!",
          isAnonymous: false,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          user: { name: "Jane", image: null },
        },
      ];
      mockFindMany.mockResolvedValue(mockReviews);

      const response = await GET(makeGetRequest({ productId: "prod001" }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.reviews).toHaveLength(1);
      expect(data.data.reviews[0].user).toEqual({ name: "Jane", image: null });
    });

    it("masks user info for anonymous reviews", async () => {
      const mockReviews = [
        {
          id: "rev1",
          rating: 4,
          comment: "Nice!",
          isAnonymous: true,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
          user: { name: "Secret User", image: "avatar.jpg" },
        },
      ];
      mockFindMany.mockResolvedValue(mockReviews);

      const response = await GET(makeGetRequest({ productId: "prod001" }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.reviews[0].user).toBeNull();
    });
  });

  describe("POST /api/reviews", () => {
    it("returns 401 when not authenticated", async () => {
      mockAuth.mockResolvedValue(null as never);
      const response = await POST(
        makePostRequest({ productId: "prod001", rating: 5, comment: "Great product!" }),
      );
      const data = await response.json();
      expect(response.status).toBe(401);
      expect(data.error).toContain("Authentication required");
    });

    it("returns 400 for invalid input", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user1", email: "u@test.com" },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never);

      const response = await POST(
        makePostRequest({ productId: "prod001", rating: 6, comment: "short" }),
      );
      const data = await response.json();
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it("returns 409 when user already reviewed the product", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user1", email: "u@test.com" },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never);
      mockFindFirst.mockResolvedValue({ id: "existing-review" });

      const response = await POST(
        makePostRequest({
          productId: "prod001",
          rating: 5,
          comment: "Another great review text here",
        }),
      );
      const data = await response.json();
      expect(response.status).toBe(409);
      expect(data.error).toContain("already reviewed");
    });

    it("creates review successfully", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user1", email: "u@test.com" },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never);
      mockFindFirst.mockResolvedValue(null);
      mockInsertReturning.mockResolvedValue([
        {
          id: "newrev1",
          productId: "prod001",
          userId: "user1",
          rating: 5,
          comment: "Wonderful product, highly recommend",
          isAnonymous: false,
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-01"),
        },
      ]);

      const response = await POST(
        makePostRequest({
          productId: "prod001",
          rating: 5,
          comment: "Wonderful product, highly recommend",
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.review.id).toBe("newrev1");
      expect(data.data.review.rating).toBe(5);
    });

    it("returns 409 on unique constraint violation (concurrent duplicate)", async () => {
      mockAuth.mockResolvedValue({
        user: { id: "user1", email: "u@test.com" },
        expires: new Date(Date.now() + 86400000).toISOString(),
      } as never);
      mockFindFirst.mockResolvedValue(null);
      const dbError = new Error("duplicate key value violates unique constraint");
      (dbError as Record<string, unknown>).code = "23505";
      mockInsertReturning.mockRejectedValue(dbError);

      const response = await POST(
        makePostRequest({
          productId: "prod001",
          rating: 5,
          comment: "Wonderful product, highly recommend",
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain("already reviewed");
    });
  });
});
