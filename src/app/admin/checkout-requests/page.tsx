import Link from 'next/link'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import CheckoutRequestsClient from '@/features/admin/components/CheckoutRequestsClient'
import { getRecentCheckoutRequests } from '@/features/cart/services/checkout-service'
import { CheckoutRequestStatusEnum } from '@/features/orders/validations'
import { requireAdminPermission } from '@/features/admin/services/admin-page-auth'

interface AdminCheckoutRequestsPageProps {
  readonly searchParams?: Promise<{
    search?: string
    status?: string
  }>
}

const normalizeSearchParam = (value: string | string[] | undefined): string =>
  typeof value === 'string' ? value.trim() : ''

const normalizeStatusParam = (
  value: string | string[] | undefined
): (typeof CheckoutRequestStatusEnum.options)[number] | undefined => {
  const candidate = typeof value === 'string' ? value : undefined
  const parsed = CheckoutRequestStatusEnum.safeParse(candidate)
  return parsed.success ? parsed.data : undefined
}

export default async function AdminCheckoutRequestsPage({
  searchParams,
}: AdminCheckoutRequestsPageProps) {
  await requireAdminPermission('orders:read', '/admin/checkout-requests')

  const resolvedSearchParams = (await searchParams) ?? {}
  const search = normalizeSearchParam(resolvedSearchParams.search)
  const status = normalizeStatusParam(resolvedSearchParams.status)

  const records = await getRecentCheckoutRequests({
    limit: 50,
    search,
    status,
  })
  const queuedCount = records.filter(
    (record) => record.status === 'PENDING'
  ).length
  const processingCount = records.filter(
    (record) => record.status === 'PROCESSING'
  ).length
  const failedCount = records.filter(
    (record) => record.status === 'FAILED'
  ).length
  const completedCount = records.filter(
    (record) => record.status === 'COMPLETED'
  ).length
  const emptyMessage =
    search || status
      ? 'No checkout requests matched the current filters.'
      : 'No checkout requests have been recorded yet.'

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Checkout Queue' },
      ]}
      eyebrow="Order processing"
      title="Checkout Requests"
      description="Triage queue for stalled or failed checkouts: monitor queued, processing, failed, and completed checkout requests and release stock reservations that no longer need to hold inventory."
      metrics={[
        {
          label: 'Queued',
          value: String(queuedCount),
          hint: 'Awaiting processing.',
          tone: 'amber',
        },
        {
          label: 'Processing',
          value: String(processingCount),
          hint: 'Currently being processed.',
          tone: 'sky',
        },
        {
          label: 'Failed',
          value: String(failedCount),
          hint: 'Requires investigation.',
          tone: 'rose',
        },
        {
          label: 'Completed',
          value: String(completedCount),
          hint: 'Orders successfully created.',
          tone: 'emerald',
        },
      ]}
    >
      <AdminPanel title="Queue" description="">
        <form
          method="GET"
          className="mb-6 grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto_auto]"
        >
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Search
            </span>
            <input
              type="search"
              name="search"
              defaultValue={search}
              placeholder="Request, order, customer, or error"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950 shadow-inner shadow-white/40 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-50 dark:shadow-none dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:bg-slate-900 dark:focus:ring-sky-500/20"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Status
            </span>
            <select
              name="status"
              defaultValue={status ?? ''}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-50 dark:focus:border-sky-500 dark:focus:bg-slate-900 dark:focus:ring-sky-500/20"
            >
              <option value="">All states</option>
              {CheckoutRequestStatusEnum.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="mt-auto inline-flex min-h-[3rem] items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
          >
            Apply filters
          </button>
          {search || status ? (
            <Link
              href="/admin/checkout-requests"
              className="mt-auto inline-flex min-h-[3rem] items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-50"
            >
              Clear
            </Link>
          ) : null}
        </form>

        {search || status ? (
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            {(() => {
              const statusConjunction = search ? ' and' : ' with'
              const statusText = status
                ? `${statusConjunction} status ${status}`
                : ''
              const searchText = search ? ` matching "${search}"` : ''
              return `Showing ${records.length} checkout request${records.length === 1 ? '' : 's'}${searchText}${statusText}.`
            })()}
          </p>
        ) : null}

        <CheckoutRequestsClient records={records} emptyMessage={emptyMessage} />
      </AdminPanel>
    </AdminPageShell>
  )
}
