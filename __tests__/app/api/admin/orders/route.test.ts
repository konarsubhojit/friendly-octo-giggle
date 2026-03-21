import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: {
      orders: { findMany: mockFindMany },
    },
  },
}));
vi.mock("@/lib/schema", () => ({
  orders: {
    createdAt: "createdAt",
    status: "status",
    customerName: "customerName",
    customerEmail: "customerEmail",
    id: "id",
  },
}));
vi.mock("drizzle-orm", () => ({
  desc: vi.fn((col) => col),
  lt: vi.fn(),
  eq: vi.fn(),
  ilike: vi.fn(),
  or: vi.fn(),
  and: vi.fn(),
  SQL: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/serializers", () => ({ serializeOrders: vi.fn((o) => o) }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));
vi.mock("@/actions/orders", () => ({
  searchAllOrdersRedis: vi.fn(() => Promise.resolve(null)),
  createOrder: vi.fn(),
}));

import { GET } from "@/app/api/admin/orders/route";
import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth);

const makeRequest = (params?: Record<string, string>) => {
  const url = new URL("http://localhost/api/admin/orders");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new NextRequest(url);
};

describe("GET /api/admin/orders", () => {
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

  it("returns orders on success", async () => {
    const mockOrders = [
      {
        id: "order1",
        userId: "user1",
        status: "PENDING",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
        items: [],
      },
    ];

    mockAuth.mockResolvedValue({
      user: { id: "1", role: "ADMIN", email: "admin@test.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);
    mockFindMany.mockResolvedValue(mockOrders);

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.orders).toHaveLength(1);
    expect(data.data.orders[0].id).toBe("order1");
    expect(data.data).toHaveProperty("hasMore");
    expect(data.data).toHaveProperty("nextCursor");
  });

  it("returns 500 on database error", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", role: "ADMIN", email: "admin@test.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);
    mockFindMany.mockRejectedValue(new Error("Database error"));

    const response = await GET(makeRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
