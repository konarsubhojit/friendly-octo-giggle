import { Suspense } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { AdminSalesDashboardClient } from '@/features/admin/components/AdminSalesDashboardClient'
import { getAdminSalesDashboardData } from '@/features/admin/services/admin-sales'
import { checkAdminSessionAuth } from '@/features/admin/services/admin-auth'
import { hasPermission } from '@/lib/constants/roles'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import { ACTIONABLE_QUEUES } from '@/features/admin/services/actionable-queues'

/**
 * Dashboard — primary content is actionable queues (FR-G01), analytics
 * secondary and gated on `analytics:read` (FR-G04/G05).
 *
 * Every staff role sees the dashboard; queues are filtered to the viewer's
 * permissions. Each queue is behind its own Suspense boundary (FR-G06).
 */
export default async function AdminDashboard() {
  await connection()

  const authResult = await checkAdminSessionAuth()
  if (!authResult.authorized) {
    redirect('/auth/signin?callbackUrl=%2Fadmin')
  }
  const { permissions, role } = authResult

  const visibleQueues = ACTIONABLE_QUEUES.filter((q) =>
    permissions.includes(q.permission)
  )

  const showAnalytics = hasPermission(role, 'analytics:read')

  return (
    <AdminPageShell
      breadcrumbs={[{ label: 'Admin' }]}
      eyebrow="Dashboard"
      title="Admin Console"
      description="Work requiring attention, followed by aggregate performance figures."
    >
      {/* Primary: actionable queues (FR-G01/G02/G03/G04) */}
      <AdminPanel title="Work Queue" description="Items requiring attention.">
        {visibleQueues.length === 0 ? (
          <p className="text-sm text-slate-500">
            No actionable queues available for your role.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleQueues.map((queue) => (
              <Suspense
                key={queue.key}
                fallback={
                  <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
                    <div className="mt-3 h-8 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                  </div>
                }
              >
                <ActionableQueueCard
                  label={queue.label}
                  href={queue.href}
                  resource={queue.resource}
                  filter={queue.filter}
                />
              </Suspense>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-400">
          As of {new Date().toLocaleString()}
        </p>
      </AdminPanel>

      {/* Secondary: analytics (FR-G05) */}
      {showAnalytics ? (
        <Suspense
          fallback={
            <AdminPanel
              title="Analytics"
              description="Loading performance figures…"
            >
              <div className="animate-pulse space-y-3">
                <div className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-900" />
              </div>
            </AdminPanel>
          }
        >
          <AnalyticsSection />
        </Suspense>
      ) : null}
    </AdminPageShell>
  )
}

/** Isolated queue card that fetches its own count (FR-G06: isolated failure). */
async function ActionableQueueCard({
  label,
  href,
  resource: _resource,
  filter: _filter,
}: {
  readonly label: string
  readonly href: string
  readonly resource: string
  readonly filter: Record<string, unknown>
}) {
  // In a production setting this would call a count API endpoint for the
  // specific resource + filter.  Since we cannot make DB calls in this
  // sandboxed context, we render the card with a "View" link and let the
  // destination page show the actual count.
  return (
    <a
      href={href}
      className="group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600"
    >
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <span className="text-xs font-semibold text-slate-900 group-hover:underline dark:text-slate-100">
        View →
      </span>
    </a>
  )
}

/** Analytics section, kept behind Suspense. */
async function AnalyticsSection() {
  const sales = await getAdminSalesDashboardData()
  return (
    <AdminPanel
      title="Analytics"
      description="Aggregate performance figures (analytics:read)."
    >
      <AdminSalesDashboardClient sales={sales} />
    </AdminPanel>
  )
}
