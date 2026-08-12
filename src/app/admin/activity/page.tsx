'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import { AdminActivityPanel } from '@/features/admin/components/AdminActivityPanel'
import { AdminActivityFilters } from '@/features/admin/components/AdminActivityFilters'
import type { ActivityEntry } from '@/features/admin/services/admin-activity-query'

const ENTITY_OPTIONS = [
  'order',
  'product',
  'user',
  'review',
  'return',
  'category',
  'coupon',
]
const ACTION_OPTIONS = [
  'create',
  'update',
  'delete',
  'status_change',
  'refund',
  'role_change',
]

const RETENTION_MONTHS = 24

export default function AdminActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [filters, setFilters] = useState<{
    entity?: string
    action?: string
    actorId?: string
    dateFrom?: string
    dateTo?: string
  }>({})

  const fetchActivity = useCallback(
    async (cursor?: string | null) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (filters.entity) params.set('entity', filters.entity)
        if (filters.action) params.set('action', filters.action)
        if (filters.actorId) params.set('actorId', filters.actorId)
        if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
        if (filters.dateTo) params.set('dateTo', filters.dateTo)
        if (cursor) params.set('cursor', cursor)

        const res = await fetch(`/api/admin/activity?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load activity')
        const data = await res.json()
        if (cursor) {
          setEntries((prev) => [...prev, ...data.entries])
        } else {
          setEntries(data.entries ?? [])
        }
        setNextCursor(data.nextCursor ?? null)
      } catch {
        setEntries([])
      } finally {
        setLoading(false)
      }
    },
    [filters]
  )

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  const handleLoadMore = () => {
    if (nextCursor) fetchActivity(nextCursor)
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Activity' },
      ]}
      eyebrow="Operations"
      title="Activity Log"
      description={`Administrative change history. Records older than ${RETENTION_MONTHS} months are automatically removed.`}
    >
      <AdminPanel title="Filters" description="Narrow activity by entity, action, actor, or date.">
        <AdminActivityFilters
          value={filters}
          entityOptions={ENTITY_OPTIONS}
          actionOptions={ACTION_OPTIONS}
          onChange={setFilters}
        />
      </AdminPanel>

      <AdminPanel title="Activity" description="">
        <AdminActivityPanel
          entries={entries}
          loading={loading}
          nextCursor={nextCursor}
          onLoadMore={handleLoadMore}
          emptyMessage="No activity records found. Records older than 24 months have been removed per the retention policy."
        />
      </AdminPanel>
    </AdminPageShell>
  )
}
