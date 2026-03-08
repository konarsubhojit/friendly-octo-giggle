import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  drizzleDb: { query: { orders: { findMany: vi.fn() } } },
}));
vi.mock("@/lib/schema", () => ({ orders: { createdAt: "createdAt" } }));
vi.mock("drizzle-orm", () => ({ desc: vi.fn((col) => col) }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/redis", () => ({ getCachedData: vi.fn() }));
vi.mock("@/lib/serializers", () => ({ serializeOrders: vi.fn((o) => o) }));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { GET } from "@/app/api/admin/orders/route";
import { auth } from "@/lib/auth";
import { getCachedData } from "@/lib/redis";

const mockAuth = vi.mocked(auth);
const mockGetCachedData = vi.mocked(getCachedData);

describe("GET /api/admin/orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null as never);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Not authenticated");
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", role: "USER", email: "user@test.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);

    const response = await GET();
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
        total: 100,
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        items: [
          {
            id: "item1",
            orderId: "order1",
            productId: "prod1",
            variationId: null,
            quantity: 2,
            price: 50,
            product: { id: "prod1", name: "Product 1" },
            variation: null,
          },
        ],
      },
      {
        id: "order2",
        userId: "user2",
        status: "COMPLETED",
        total: 200,
        createdAt: "2024-01-02T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
        items: [],
      },
    ];

    mockAuth.mockResolvedValue({
      user: { id: "1", role: "ADMIN", email: "admin@test.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);
    mockGetCachedData.mockResolvedValue(mockOrders);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.orders).toEqual(mockOrders);
    expect(mockGetCachedData).toHaveBeenCalledWith(
      "admin:orders:all",
      60,
      expect.any(Function),
      10,
    );
  });

  it("returns 500 on error", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "1", role: "ADMIN", email: "admin@test.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as never);
    mockGetCachedData.mockRejectedValue(new Error("Database error"));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
