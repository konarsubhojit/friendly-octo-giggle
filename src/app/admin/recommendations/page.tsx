import { connection } from 'next/server'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import { requireAdminPermission } from '@/features/admin/services/admin-page-auth'
import { getAffinityStatus } from '@/features/recommendations/services/status'
import { RecomputeButton } from '@/features/recommendations/components/RecomputeButton'

const formatTimestamp = (iso: string | null): string =>
  iso ? new Date(iso).toUTCString() : 'Never computed'

const RecommendationsAdminPage = async () => {
  // Per-request by construction: this screen reads a session and reports live
  // job state, so it must never be prerendered.
  await connection()
  await requireAdminPermission('system:manage', '/admin/recommendations')

  const status = await getAffinityStatus()

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Recommendations' },
      ]}
      eyebrow="Discovery"
      title="Recommendations"
      description="Reporting view for the recommendation scoring job: product affinity scores powering the recommendation rails, and when the job last ran."
      metrics={[
        {
          label: 'Scored pairs',
          value: String(status.pairCount),
          hint: 'Directed anchor → recommendation associations.',
          tone: 'rose',
        },
        {
          label: 'Anchors covered',
          value: String(status.anchorCount),
          hint: 'Products with at least one association.',
          tone: 'amber',
        },
        {
          label: 'Minimum support',
          value: String(status.minSupport),
          hint: 'Distinct orders or shoppers required per pair.',
          tone: 'slate',
        },
      ]}
    >
      <AdminPanel
        title="Last refresh"
        description="Scores are recomputed nightly at 04:00 UTC."
      >
        <dl className="mb-6 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-[var(--text-muted)]">Last computed</dt>
            <dd className="text-sm font-semibold text-[var(--foreground)]">
              {formatTimestamp(status.lastComputedAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-[var(--text-muted)]">History window</dt>
            <dd className="text-sm font-semibold text-[var(--foreground)]">
              {status.windowDays} days
            </dd>
          </div>
        </dl>

        {status.pairCount === 0 && (
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            No associations meet the minimum support of {status.minSupport}.
            Every rail is serving bestsellers until the catalog accumulates
            enough co-purchase history.
          </p>
        )}

        <RecomputeButton />
      </AdminPanel>
    </AdminPageShell>
  )
}

export default RecommendationsAdminPage
