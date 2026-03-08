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

  it("returns 401 when session has no user", async () => {
    mockAuth.mockResolvedValue({ user: null });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("executes the fetcher callback and returns sales data", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", role: "ADMIN" },
    });
    mockGetCachedData.mockImplementation(
      async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher(),
    );

    // Mock all the DB queries inside the fetcher
    const { drizzleDb } = await import("@/lib/db");
    const selectWhereMock = vi.fn();
    const selectFromMock = vi.fn();
    const selectGroupByMock = vi.fn();
    const selectOrderByMock = vi.fn();
    const selectLimitMock = vi.fn();

    // totalStats
    const totalStatsResult = { totalRevenue: 5000, totalOrders: 25 };
    // todayStats
    const todayStatsResult = { revenue: 200, orderCount: 3 };
    // monthStats
    const monthStatsResult = { revenue: 1500, orderCount: 12 };
    // lastMonthStats
    const lastMonthStatsResult = { revenue: 1200, orderCount: 10 };
    // statusCounts
    const statusCountsResult = [
      { status: "PENDING", count: 5 },
      { status: "PROCESSING", count: 10 },
    ];
    // topProducts
    const topProductsResult = [
      {
        productId: "p1",
        productName: "Product 1",
        totalQuantity: 50,
        totalRevenue: 2500,
      },
    ];
    // customerCount
    const customerCountResult = { count: 15 };

    // Chain: select().from().where() for totalStats, todayStats, monthStats, lastMonthStats
    // Chain: select().from().where().groupBy() for statusCounts
    // Chain: select().from().innerJoin().innerJoin().where().groupBy().orderBy().limit() for topProducts
    // Chain: select().from().where() for customerCount

    let callCount = 0;
    (drizzleDb.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount <= 4) {
        // totalStats, todayStats, monthStats, lastMonthStats
        const results = [
          [totalStatsResult],
          [todayStatsResult],
          [monthStatsResult],
          [lastMonthStatsResult],
        ];
        return {
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue(results[callCount - 1]),
          })),
        };
      }
      if (callCount === 5) {
        // statusCounts
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              groupBy: vi.fn().mockResolvedValue(statusCountsResult),
            })),
          })),
        };
      }
      if (callCount === 6) {
        // topProducts
        return {
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              innerJoin: vi.fn(() => ({
                where: vi.fn(() => ({
                  groupBy: vi.fn(() => ({
                    orderBy: vi.fn(() => ({
                      limit: vi.fn().mockResolvedValue(topProductsResult),
                    })),
                  })),
                })),
              })),
            })),
          })),
        };
      }
      // customerCount
      return {
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValue([customerCountResult]),
        })),
      };
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.sales.totalRevenue).toBe(5000);
    expect(body.data.sales.totalOrders).toBe(25);
    expect(body.data.sales.todayRevenue).toBe(200);
    expect(body.data.sales.monthRevenue).toBe(1500);
    expect(body.data.sales.lastMonthRevenue).toBe(1200);
    expect(body.data.sales.totalCustomers).toBe(15);
    expect(body.data.sales.ordersByStatus).toEqual({
      PENDING: 5,
      PROCESSING: 10,
    });
    expect(body.data.sales.topProducts).toHaveLength(1);
    expect(body.data.sales.topProducts[0].name).toBe("Product 1");
  });
});
