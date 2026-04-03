import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCacheAdminSales, mockExecute } = vi.hoisted(() => ({
  mockCacheAdminSales: vi.fn(),
  mockExecute: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  drizzleDb: {
    execute: mockExecute,
  },
}));

vi.mock("@/lib/cache", () => ({
  cacheAdminSales: mockCacheAdminSales,
}));

vi.mock("drizzle-orm", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  }),
}));

import { getAdminSalesDashboardData } from "@/features/admin/services/admin-sales";

describe("admin-sales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheAdminSales.mockImplementation(
      async (fetcher: () => Promise<unknown>) => fetcher(),
    );
  });

  describe("getAdminSalesDashboardData", () => {
    it("returns dashboard data with correct calculations", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            totalRevenue: 10000,
            totalOrders: 50,
            todayRevenue: 500,
            todayOrders: 3,
            monthRevenue: 5000,
            monthOrders: 25,
            lastMonthRevenue: 4000,
            lastMonthOrders: 20,
            ordersByStatus: JSON.stringify({
              PENDING: 5,
              PROCESSING: 3,
              DELIVERED: 30,
              SHIPPED: 12,
            }),
            topProducts: JSON.stringify([
              {
                productId: "p1",
                name: "Widget",
                totalQuantity: 100,
                totalRevenue: 5000,
              },
            ]),
            recentSales: JSON.stringify([]),
            totalCustomers: 200,
          },
        ],
      });

      const result = await getAdminSalesDashboardData();

      expect(result.totalRevenue).toBe(10000);
      expect(result.totalOrders).toBe(50);
      expect(result.todayRevenue).toBe(500);
      expect(result.todayOrders).toBe(3);
      expect(result.monthRevenue).toBe(5000);
      expect(result.monthOrders).toBe(25);
      expect(result.lastMonthRevenue).toBe(4000);
      expect(result.lastMonthOrders).toBe(20);
      expect(result.totalCustomers).toBe(200);
      expect(result.averageOrderValue).toBe(200);
      expect(result.fulfillmentRate).toBe(60);
      expect(result.pendingOrders).toBe(8);
      expect(result.monthRevenueChange).toBe(25);
      expect(result.monthOrdersChange).toBe(25);
      expect(result.topProducts).toHaveLength(1);
      expect(result.topProducts[0].name).toBe("Widget");
      expect(result.recentSales).toHaveLength(7);
    });

    it("handles empty dashboard row", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      const result = await getAdminSalesDashboardData();

      expect(result.totalRevenue).toBe(0);
      expect(result.totalOrders).toBe(0);
      expect(result.averageOrderValue).toBe(0);
      expect(result.fulfillmentRate).toBe(0);
      expect(result.pendingOrders).toBe(0);
      expect(result.recentSales).toHaveLength(7);
    });

    it("handles string numeric values from SQL", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            totalRevenue: "7500.50",
            totalOrders: "30",
            todayRevenue: "200.25",
            todayOrders: "2",
            monthRevenue: "3000",
            monthOrders: "15",
            lastMonthRevenue: "0",
            lastMonthOrders: "0",
            ordersByStatus: { PENDING: 2, DELIVERED: 28 },
            topProducts: [],
            recentSales: [],
            totalCustomers: "100",
          },
        ],
      });

      const result = await getAdminSalesDashboardData();

      expect(result.totalRevenue).toBe(7500.5);
      expect(result.totalOrders).toBe(30);
      expect(result.todayRevenue).toBe(200.25);
      expect(result.monthRevenueChange).toBeNull();
      expect(result.monthOrdersChange).toBeNull();
    });

    it("handles null values", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            totalRevenue: null,
            totalOrders: null,
            todayRevenue: null,
            todayOrders: null,
            monthRevenue: null,
            monthOrders: null,
            lastMonthRevenue: null,
            lastMonthOrders: null,
            ordersByStatus: null,
            topProducts: null,
            recentSales: null,
            totalCustomers: null,
          },
        ],
      });

      const result = await getAdminSalesDashboardData();

      expect(result.totalRevenue).toBe(0);
      expect(result.totalOrders).toBe(0);
      expect(result.ordersByStatus).toEqual({});
      expect(result.topProducts).toEqual([]);
    });

    it("handles JSON string values for objects", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            totalRevenue: 1000,
            totalOrders: 10,
            todayRevenue: 0,
            todayOrders: 0,
            monthRevenue: 500,
            monthOrders: 5,
            lastMonthRevenue: 500,
            lastMonthOrders: 5,
            ordersByStatus: '{"PENDING":3,"DELIVERED":7}',
            topProducts:
              '[{"productId":"p1","name":"A","totalQuantity":"10","totalRevenue":"500"}]',
            recentSales: "[]",
            totalCustomers: 50,
          },
        ],
      });

      const result = await getAdminSalesDashboardData();

      expect(result.ordersByStatus).toEqual({ PENDING: 3, DELIVERED: 7 });
      expect(result.topProducts).toHaveLength(1);
      expect(result.topProducts[0].totalQuantity).toBe(10);
      expect(result.topProducts[0].totalRevenue).toBe(500);
    });

    it("calculates percent change correctly", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            totalRevenue: 100,
            totalOrders: 10,
            todayRevenue: 0,
            todayOrders: 0,
            monthRevenue: 200,
            monthOrders: 10,
            lastMonthRevenue: 100,
            lastMonthOrders: 5,
            ordersByStatus: {},
            topProducts: [],
            recentSales: [],
            totalCustomers: 0,
          },
        ],
      });

      const result = await getAdminSalesDashboardData();

      expect(result.monthRevenueChange).toBe(100);
      expect(result.monthOrdersChange).toBe(100);
    });

    it("fills in zero for missing days in recent sales", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            totalRevenue: 100,
            totalOrders: 1,
            todayRevenue: 100,
            todayOrders: 1,
            monthRevenue: 100,
            monthOrders: 1,
            lastMonthRevenue: 0,
            lastMonthOrders: 0,
            ordersByStatus: {},
            topProducts: [],
            recentSales: [],
            totalCustomers: 1,
          },
        ],
      });

      const result = await getAdminSalesDashboardData();

      expect(result.recentSales).toHaveLength(7);
      result.recentSales.forEach((point) => {
        expect(point).toHaveProperty("date");
        expect(point).toHaveProperty("label");
        expect(typeof point.revenue).toBe("number");
        expect(typeof point.orders).toBe("number");
      });
    });

    it("uses cache wrapper", async () => {
      mockExecute.mockResolvedValue({ rows: [] });

      await getAdminSalesDashboardData();

      expect(mockCacheAdminSales).toHaveBeenCalledTimes(1);
      expect(mockCacheAdminSales).toHaveBeenCalledWith(expect.any(Function));
    });

    it("returns zero fulfillment when no orders exist", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            totalRevenue: 0,
            totalOrders: 0,
            todayRevenue: 0,
            todayOrders: 0,
            monthRevenue: 0,
            monthOrders: 0,
            lastMonthRevenue: 0,
            lastMonthOrders: 0,
            ordersByStatus: {},
            topProducts: [],
            recentSales: [],
            totalCustomers: 0,
          },
        ],
      });

      const result = await getAdminSalesDashboardData();

      expect(result.fulfillmentRate).toBe(0);
      expect(result.averageOrderValue).toBe(0);
    });

    it("handles invalid JSON string for ordersByStatus gracefully", async () => {
      mockExecute.mockResolvedValue({
        rows: [
          {
            totalRevenue: 0,
            totalOrders: 0,
            todayRevenue: 0,
            todayOrders: 0,
            monthRevenue: 0,
            monthOrders: 0,
            lastMonthRevenue: 0,
            lastMonthOrders: 0,
            ordersByStatus: "not-valid-json{",
            topProducts: "not-valid-json{",
            recentSales: "not-valid-json{",
            totalCustomers: 0,
          },
        ],
      });

      const result = await getAdminSalesDashboardData();

      expect(result.ordersByStatus).toEqual({});
      expect(result.topProducts).toEqual([]);
    });
  });
});
