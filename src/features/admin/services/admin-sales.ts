import { sql } from 'drizzle-orm'
import { drizzleDb } from '@/lib/db'
import { cacheAdminSales } from '@/lib/cache'

const RECENT_SALES_DAY_COUNT = 7

type SqlNumericValue = number | string | null

interface AggregatedDashboardRow {
  readonly totalRevenue: SqlNumericValue
  readonly totalOrders: SqlNumericValue
  readonly todayRevenue: SqlNumericValue
  readonly todayOrders: SqlNumericValue
  readonly monthRevenue: SqlNumericValue
  readonly monthOrders: SqlNumericValue
  readonly lastMonthRevenue: SqlNumericValue
  readonly lastMonthOrders: SqlNumericValue
  readonly ordersByStatus: unknown
  readonly topProducts: unknown
  readonly recentSales: unknown
  readonly totalCustomers: SqlNumericValue
}

export interface SalesTrendPoint {
  readonly date: string
  readonly label: string
  readonly revenue: number
  readonly orders: number
}

export interface SalesTopProduct {
  readonly productId: string
  readonly name: string
  readonly totalQuantity: number
  readonly totalRevenue: number
}

export interface AdminSalesDashboardData {
  readonly totalRevenue: number
  readonly totalOrders: number
  readonly todayRevenue: number
  readonly todayOrders: number
  readonly monthRevenue: number
  readonly monthOrders: number
  readonly lastMonthRevenue: number
  readonly lastMonthOrders: number
  readonly monthRevenueChange: number | null
  readonly monthOrdersChange: number | null
  readonly averageOrderValue: number
  readonly fulfillmentRate: number
  readonly pendingOrders: number
  readonly ordersByStatus: Record<string, number>
  readonly topProducts: readonly SalesTopProduct[]
  readonly recentSales: readonly SalesTrendPoint[]
  readonly totalCustomers: number
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatShortDayLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)
}

function calculatePercentChange(
  current: number,
  previous: number
): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null
  }

  return ((current - previous) / previous) * 100
}

function parseNumberValue(value: SqlNumericValue | undefined): number {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function parseJsonValue<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  return value as T
}

export const getAdminSalesDashboardData =
  async (): Promise<AdminSalesDashboardData> => {
    return cacheAdminSales(async () => {
      const now = new Date()
      const today = startOfDay(now)
      const thisMonth = startOfMonth(now)
      const lastMonth = startOfMonth(
        new Date(now.getFullYear(), now.getMonth() - 1, 1)
      )
      const recentSalesStart = addDays(today, -(RECENT_SALES_DAY_COUNT - 1))

      const dashboardResult = await drizzleDb.execute(sql`
        with active_orders as (
          select
            o.status,
            o."totalAmount",
            o."createdAt"
          from "Order" o
          where o.status <> 'CANCELLED'
        ),
        summary as (
          select
            coalesce(sum(ao."totalAmount"), 0)::float8 as "totalRevenue",
            count(*)::int as "totalOrders",
            coalesce(sum(ao."totalAmount") filter (where ao."createdAt" >= ${today}), 0)::float8 as "todayRevenue",
            count(*) filter (where ao."createdAt" >= ${today})::int as "todayOrders",
            coalesce(sum(ao."totalAmount") filter (where ao."createdAt" >= ${thisMonth}), 0)::float8 as "monthRevenue",
            count(*) filter (where ao."createdAt" >= ${thisMonth})::int as "monthOrders",
            coalesce(sum(ao."totalAmount") filter (where ao."createdAt" >= ${lastMonth} and ao."createdAt" < ${thisMonth}), 0)::float8 as "lastMonthRevenue",
            count(*) filter (where ao."createdAt" >= ${lastMonth} and ao."createdAt" < ${thisMonth})::int as "lastMonthOrders"
          from active_orders ao
        ),
        status_counts as (
          select coalesce(
            jsonb_object_agg(grouped.status, grouped.count),
            '{}'::jsonb
          ) as "ordersByStatus"
          from (
            select ao.status, count(*)::int as count
            from active_orders ao
            group by ao.status
          ) grouped
        ),
        recent_sales as (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'date', grouped."date",
                'revenue', grouped.revenue,
                'orders', grouped.orders
              )
              order by grouped."date"
            ),
            '[]'::jsonb
          ) as "recentSales"
          from (
            select
              to_char(date_trunc('day', ao."createdAt"), 'YYYY-MM-DD') as "date",
              coalesce(sum(ao."totalAmount"), 0)::float8 as revenue,
              count(*)::int as orders
            from active_orders ao
            where ao."createdAt" >= ${recentSalesStart}
            group by date_trunc('day', ao."createdAt")
          ) grouped
        ),
        top_products as (
          select coalesce(
            jsonb_agg(product_row order by product_row."totalQuantity" desc),
            '[]'::jsonb
          ) as "topProducts"
          from (
            select
              oi."productId" as "productId",
              p.name,
              cast(sum(oi.quantity) as int) as "totalQuantity",
              coalesce(sum(oi.price * oi.quantity), 0)::float8 as "totalRevenue"
            from "OrderItem" oi
            inner join "Order" o on o.id = oi."orderId"
            inner join "Product" p on p.id = oi."productId"
            where o.status <> 'CANCELLED'
            group by oi."productId", p.name
            order by sum(oi.quantity) desc
            limit 5
          ) product_row
        )
        select
          summary."totalRevenue",
          summary."totalOrders",
          summary."todayRevenue",
          summary."todayOrders",
          summary."monthRevenue",
          summary."monthOrders",
          summary."lastMonthRevenue",
          summary."lastMonthOrders",
          status_counts."ordersByStatus",
          recent_sales."recentSales",
          top_products."topProducts",
          (
            select count(*)::int
            from "User" u
            where u.role = 'CUSTOMER'
          ) as "totalCustomers"
        from summary
        cross join status_counts
        cross join recent_sales
        cross join top_products
      `)

      const dashboardRow = dashboardResult.rows[0] as unknown as
        | AggregatedDashboardRow
        | undefined

      const totalRevenue = parseNumberValue(dashboardRow?.totalRevenue)
      const totalOrders = parseNumberValue(dashboardRow?.totalOrders)
      const todayRevenue = parseNumberValue(dashboardRow?.todayRevenue)
      const todayOrders = parseNumberValue(dashboardRow?.todayOrders)
      const monthRevenue = parseNumberValue(dashboardRow?.monthRevenue)
      const monthOrders = parseNumberValue(dashboardRow?.monthOrders)
      const lastMonthRevenue = parseNumberValue(dashboardRow?.lastMonthRevenue)
      const lastMonthOrders = parseNumberValue(dashboardRow?.lastMonthOrders)

      const ordersByStatus = parseJsonValue<Record<string, number>>(
        dashboardRow?.ordersByStatus,
        {}
      )

      const topProducts = parseJsonValue<readonly SalesTopProduct[]>(
        dashboardRow?.topProducts,
        []
      ).map((product) => ({
        productId: product.productId,
        name: product.name,
        totalQuantity: parseNumberValue(product.totalQuantity),
        totalRevenue: parseNumberValue(product.totalRevenue),
      }))

      const recentSalesByDate = new Map(
        parseJsonValue<
          readonly Pick<SalesTrendPoint, 'date' | 'revenue' | 'orders'>[]
        >(dashboardRow?.recentSales, []).map((point) => [
          point.date,
          {
            revenue: parseNumberValue(point.revenue),
            orders: parseNumberValue(point.orders),
          },
        ])
      )

      const recentSales = Array.from(
        { length: RECENT_SALES_DAY_COUNT },
        (_, index) => {
          const currentDate = addDays(recentSalesStart, index)
          const dateKey = formatDateKey(currentDate)
          const point = recentSalesByDate.get(dateKey)

          return {
            date: dateKey,
            label: formatShortDayLabel(currentDate),
            revenue: point?.revenue ?? 0,
            orders: point?.orders ?? 0,
          }
        }
      )

      const deliveredOrders = ordersByStatus.DELIVERED ?? 0
      const pendingOrders =
        (ordersByStatus.PENDING ?? 0) + (ordersByStatus.PROCESSING ?? 0)

      return {
        totalRevenue,
        totalOrders,
        todayRevenue,
        todayOrders,
        monthRevenue,
        monthOrders,
        lastMonthRevenue,
        lastMonthOrders,
        monthRevenueChange: calculatePercentChange(
          monthRevenue,
          lastMonthRevenue
        ),
        monthOrdersChange: calculatePercentChange(monthOrders, lastMonthOrders),
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        fulfillmentRate:
          totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0,
        pendingOrders,
        ordersByStatus,
        topProducts,
        recentSales,
        totalCustomers: parseNumberValue(dashboardRow?.totalCustomers),
      }
    })
  }
