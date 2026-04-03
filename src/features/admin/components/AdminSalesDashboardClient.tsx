'use client'

import Link from 'next/link'
import { useCurrency } from '@/contexts/CurrencyContext'
import type { AdminSalesDashboardData } from '@/features/admin/services/admin-sales'
import { OrdersByStatusCard } from '@/features/admin/components/OrdersByStatusCard'
import { SalesTrendChart } from '@/features/admin/components/SalesTrendChart'
import { TopProductsTable } from '@/features/admin/components/TopProductsTable'

interface AdminSalesDashboardClientProps {
  readonly sales: AdminSalesDashboardData
}

interface DashboardStatCard {
  readonly label: string
  readonly value: string
  readonly detail: string
  readonly tone: string
  readonly glow: string
}

function formatDelta(delta: number | null, suffix: string): string {
  if (delta === null) {
    return `New ${suffix}`
  }

  const absoluteDelta = Math.abs(delta).toFixed(1)

  if (delta === 0) {
    return `Flat vs last ${suffix}`
  }

  return `${delta > 0 ? '+' : '-'}${absoluteDelta}% vs last ${suffix}`
}

function getDeltaBadgeClass(delta: number | null): string {
  if (delta === null) return 'bg-violet-100 text-violet-700'
  if (delta >= 0) return 'bg-emerald-100 text-emerald-700'
  return 'bg-rose-100 text-rose-700'
}

function DeltaBadge({
  delta,
  suffix,
}: Readonly<{ delta: number | null; suffix: string }>) {
  const badgeClassName = getDeltaBadgeClass(delta)

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClassName}`}
    >
      {formatDelta(delta, suffix)}
    </span>
  )
}

const NAV_CARDS = [
  {
    href: '/admin/products',
    title: 'Products',
    description:
      'Adjust pricing, inventory, and catalog details before demand spikes hit.',
    accent: 'from-sky-500/15 via-sky-500/5 to-transparent',
  },
  {
    href: '/admin/orders',
    title: 'Orders',
    description:
      'Review pipeline health, unblock fulfilment, and handle exceptions quickly.',
    accent: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
  },
  {
    href: '/admin/users',
    title: 'Users',
    description:
      'Check customer growth and keep admin access and permissions under control.',
    accent: 'from-amber-500/15 via-amber-500/5 to-transparent',
  },
] as const

export function AdminSalesDashboardClient({
  sales,
}: AdminSalesDashboardClientProps) {
  const { formatPrice } = useCurrency()

  const summaryCards: readonly DashboardStatCard[] = [
    {
      label: 'Total revenue',
      value: formatPrice(sales.totalRevenue),
      detail: `${sales.totalOrders} lifetime non-cancelled orders`,
      tone: 'text-emerald-700',
      glow: 'bg-emerald-500/10',
    },
    {
      label: 'This month',
      value: formatPrice(sales.monthRevenue),
      detail: `${sales.monthOrders} orders this month`,
      tone: 'text-sky-700',
      glow: 'bg-sky-500/10',
    },
    {
      label: 'Average order',
      value: formatPrice(sales.averageOrderValue),
      detail: `${formatPrice(sales.todayRevenue)} revenue today`,
      tone: 'text-violet-700',
      glow: 'bg-violet-500/10',
    },
    {
      label: 'Customers',
      value: String(sales.totalCustomers),
      detail: `${sales.pendingOrders} orders still in flight`,
      tone: 'text-amber-700',
      glow: 'bg-amber-500/10',
    },
  ]

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_32%),linear-gradient(135deg,_#ffffff,_#f8fafc_65%,_#eefbf6)] p-8 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.45)]">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Admin revenue desk
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Sales dashboard with faster first render and clearer signals.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              The dashboard now renders from cached server data and keeps the
              client work focused on currency-aware formatting and a compact D3
              trend chart.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:w-[25rem]">
            <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Revenue trend
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {formatPrice(sales.monthRevenue)}
              </p>
              <div className="mt-3">
                <DeltaBadge delta={sales.monthRevenueChange} suffix="month" />
              </div>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/75 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Fulfilment
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {sales.fulfillmentRate.toFixed(1)}%
              </p>
              <p className="mt-3 text-sm text-slate-600">
                Delivered out of active orders
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.5)]"
          >
            <div
              className={`mb-4 inline-flex rounded-2xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${card.glow} ${card.tone}`}
            >
              {card.label}
            </div>
            <p className="text-3xl font-bold tracking-tight text-slate-950">
              {card.value}
            </p>
            <p className="mt-2 text-sm text-slate-500">{card.detail}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(20rem,0.95fr)]">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.45)]">
          <SalesTrendChart points={sales.recentSales} />
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.45)]">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Conversion snapshot
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Order momentum
              </h2>
            </div>
            <DeltaBadge delta={sales.monthOrdersChange} suffix="month" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-950 p-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
                Today
              </p>
              <p className="mt-3 text-3xl font-bold">{sales.todayOrders}</p>
              <p className="mt-2 text-sm text-slate-300">
                Orders worth {formatPrice(sales.todayRevenue)}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Last month
              </p>
              <p className="mt-3 text-3xl font-bold text-slate-950">
                {sales.lastMonthOrders}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Revenue {formatPrice(sales.lastMonthRevenue)}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <OrdersByStatusCard ordersByStatus={sales.ordersByStatus} />
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,1fr)]">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-38px_rgba(15,23,42,0.45)]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Top sellers
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Products driving revenue
              </h2>
            </div>
          </div>
          <TopProductsTable
            products={sales.topProducts}
            formatPrice={formatPrice}
          />
        </article>

        <div className="grid gap-4">
          {NAV_CARDS.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] transition-transform duration-200 hover:-translate-y-1"
            >
              <div
                className={`absolute inset-0 bg-gradient-to-br ${card.accent}`}
                aria-hidden="true"
              />
              <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Quick action
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">
                  {card.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {card.description}
                </p>
                <span className="mt-5 inline-flex items-center text-sm font-semibold text-slate-950 transition-transform group-hover:translate-x-1">
                  Open panel
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
