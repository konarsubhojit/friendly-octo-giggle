import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, PATCH } from "@/app/api/orders/[id]/route";
import { drizzleDb } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCachedData, invalidateCache } from "@/lib/redis";
import { invalidateUserOrderCaches } from "@/lib/cache";

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    query: { orders: { findFirst: vi.fn() } },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(),
      })),
    })),
  },
}));

vi.mock("@/lib/schema", () => ({
  orders: { id: "id", status: "status" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getCachedData: vi.fn(),
  invalidateCache: vi.fn(),
  getRedisClient: vi.fn(() => null),
}));

vi.mock("@/lib/cache", () => ({
  CACHE_KEYS: {
    ORDER_BY_ID: (userId: string, orderId: string) =>
      `order:${userId}:${orderId}`,
    PRODUCTS_BESTSELLERS: "products:bestsellers",
  },
  CACHE_TTL: { ORDER_DETAIL: 120, ORDER_DETAIL_STALE: 10 },
  invalidateUserOrderCaches: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

const mockAuth = vi.mocked(auth);
const mockGetCachedData = vi.mocked(getCachedData);
const mockInvalidateCache = vi.mocked(invalidateCache);
const mockInvalidateUserOrderCaches = vi.mocked(invalidateUserOrderCaches);
const mockFindFirst = vi.mocked(drizzleDb.query.orders.findFirst);
const mockUpdate = vi.mocked(drizzleDb.update);

describe("GET /api/orders/[id]", () => {
  const mockOrder = {
    id: "order1",
    userId: "user1",
    totalAmount: 100,
    status: "PENDING",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    items: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/orders/order1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns 404 when order not found (getCachedData returns null)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockGetCachedData.mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/orders/order1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Order not found");
  });

  it("returns 404 when order belongs to different user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockGetCachedData.mockResolvedValue({
      ...mockOrder,
      userId: "differentUser",
    });

    const request = new NextRequest("http://localhost/api/orders/order1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Order not found");
  });

  it("returns order on success", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockGetCachedData.mockResolvedValue(mockOrder);

    const request = new NextRequest("http://localhost/api/orders/order1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.order).toBeDefined();
    expect(data.data.order.id).toBe("order1");
    expect(data.data.order.createdAt).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("PATCH /api/orders/[id]", () => {
  const mockOrder = {
    id: "order1",
    userId: "user1",
    totalAmount: 100,
    status: "PENDING",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    items: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/orders/order1", {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel" }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Authentication required");
  });

  it("returns 400 for invalid action", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);

    const request = new NextRequest("http://localhost/api/orders/order1", {
      method: "PATCH",
      body: JSON.stringify({ action: "invalid" }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Validation failed");
  });

  it("returns 404 when order not found", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindFirst.mockResolvedValue(null as never);

    const request = new NextRequest("http://localhost/api/orders/order1", {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel" }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Order not found");
  });

  it("returns 404 when order belongs to different user", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindFirst.mockResolvedValue({
      ...mockOrder,
      userId: "differentUser",
    } as never);

    const request = new NextRequest("http://localhost/api/orders/order1", {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel" }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Order not found");
  });

  it("returns 400 when order is not PENDING", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindFirst.mockResolvedValue({
      ...mockOrder,
      status: "SHIPPED",
    } as never);

    const request = new NextRequest("http://localhost/api/orders/order1", {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel" }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Only pending orders can be cancelled");
  });

  it("cancels order successfully", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);

    const cancelledOrder = { ...mockOrder, status: "CANCELLED" };

    mockFindFirst
      .mockResolvedValueOnce(mockOrder as never)
      .mockResolvedValueOnce(cancelledOrder as never);

    const mockWhere = vi.fn();
    const mockSet = vi.fn(() => ({ where: mockWhere }));
    mockUpdate.mockReturnValue({ set: mockSet } as never);

    const request = new NextRequest("http://localhost/api/orders/order1", {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel" }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.order).toBeDefined();
    expect(data.data.order.id).toBe("order1");
    expect(data.data.order.status).toBe("CANCELLED");
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockInvalidateUserOrderCaches).toHaveBeenCalledWith("user1");
    expect(mockInvalidateCache).toHaveBeenCalledWith("admin:orders:*");
    expect(mockInvalidateCache).toHaveBeenCalledWith("admin:order:order1");
    expect(mockInvalidateCache).toHaveBeenCalledWith("products:bestsellers");
  });

  it("returns 500 when updatedOrder is null after cancel", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);

    mockFindFirst
      .mockResolvedValueOnce(mockOrder as never)
      .mockResolvedValueOnce(null as never);

    const mockWhere = vi.fn();
    const mockSet = vi.fn(() => ({ where: mockWhere }));
    mockUpdate.mockReturnValue({ set: mockSet } as never);

    const request = new NextRequest("http://localhost/api/orders/order1", {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel" }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Order not found after update");
  });

  it("returns 500 on unexpected error in GET", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockGetCachedData.mockRejectedValue(new Error("Cache failure"));

    const request = new NextRequest("http://localhost/api/orders/order1");
    const response = await GET(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });

  it("returns 500 on unexpected error in PATCH", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user1", name: "Test", email: "test@example.com" },
    } as never);
    mockFindFirst.mockRejectedValue(new Error("DB failure"));

    const request = new NextRequest("http://localhost/api/orders/order1", {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel" }),
    });
    const response = await PATCH(request, {
      params: Promise.resolve({ id: "order1" }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
