import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      reviews: { findMany: mockFindMany },
    },
  },
}));
vi.mock("@/lib/schema", () => ({
  reviews: {
    createdAt: "createdAt",
    productId: "productId",
    rating: "rating",
  },
}));
vi.mock("drizzle-orm", () => ({
  desc: vi.fn((col) => col),
  eq: vi.fn(),
  and: vi.fn(),
  SQL: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { GET } from "@/app/api/admin/reviews/route";
import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth);

const makeRequest = (params?: Record<string, string>) => {
  const url = new URL("http://localhost/api/admin/reviews");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
};

describe("GET /api/admin/reviews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(response.status).toBe(401);
    expect(data.error).toBe("Not authenticated");
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", role: "CUSTOMER", email: "user@test.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(response.status).toBe(403);
    expect(data.error).toBe("Not authorized - Admin access required");
  });

  it("returns all reviews for admin", async () => {
    const mockReviews = [
      {
        id: "rev1",
        productId: "prod1",
        rating: 5,
        comment: "Amazing!",
        isAnonymous: true,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        user: { id: "u1", name: "Jane", email: "jane@test.com", image: null },
        product: { id: "prod1", name: "Widget", image: "img.jpg" },
      },
    ];
    mockAuth.mockResolvedValue({
      user: { id: "1", role: "ADMIN", email: "admin@test.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);
    mockFindMany.mockResolvedValue(mockReviews);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.reviews).toHaveLength(1);
    expect(data.data.total).toBe(1);
    expect(data.data.reviews[0].user.name).toBe("Jane");
  });

  it("returns reviews filtered by rating", async () => {
    const mockReviews = [
      {
        id: "rev1",
        rating: 5,
        comment: "Great",
        isAnonymous: false,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        user: null,
        product: null,
      },
    ];
    mockAuth.mockResolvedValue({
      user: { id: "1", role: "ADMIN", email: "admin@test.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);
    mockFindMany.mockResolvedValue(mockReviews);

    const response = await GET(makeRequest({ rating: "5" }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.reviews).toHaveLength(1);
  });

  it("returns 500 on database error", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", role: "ADMIN", email: "admin@test.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);
    mockFindMany.mockRejectedValue(new Error("DB error"));

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
