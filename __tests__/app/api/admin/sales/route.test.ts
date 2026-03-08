import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.hoisted(() => vi.fn());
const mockGetCachedData = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/redis", () => ({ getCachedData: mockGetCachedData }));
vi.mock("@/lib/db", () => ({
  drizzleDb: { select: vi.fn() },
}));
vi.mock("@/lib/schema", () => ({
  orders: {},
  orderItems: {},
  products: {},
  users: {},
}));
vi.mock("drizzle-orm", () => ({
  sql: vi.fn(),
  eq: vi.fn(),
  count: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lt: vi.fn(),
  ne: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logError: vi.fn() }));

import { GET } from "@/app/api/admin/sales/route";

const MOCK_SALES = {
  totalRevenue: 10000,
  totalOrders: 50,
  todayRevenue: 500,
  todayOrders: 5,
  monthRevenue: 3000,
  monthOrders: 20,
  lastMonthRevenue: 2500,
  lastMonthOrders: 18,
  ordersByStatus: { PENDING: 5, PROCESSING: 10, SHIPPED: 20, DELIVERED: 15 },
  topProducts: [
    {
      productId: "p1",
      name: "Product 1",
      totalQuantity: 100,
      totalRevenue: 2999,
    },
  ],
  totalCustomers: 30,
};

describe("GET /api/admin/sales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 403 when user is not admin", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "user-1", role: "USER" },
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error).toBe("Not authorized - Admin access required");
  });

  it("returns sales summary on success", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    });
    mockGetCachedData.mockResolvedValue(MOCK_SALES);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sales).toEqual(MOCK_SALES);
    expect(mockGetCachedData).toHaveBeenCalledWith(
      "admin:sales:summary",
      120,
      expect.any(Function),
      30,
    );
  });

  it("returns 500 on error", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    });
    mockGetCachedData.mockRejectedValue(new Error("Redis failure"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
