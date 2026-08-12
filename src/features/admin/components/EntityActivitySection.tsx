'use client'

import { useCallback, useEffect, useState } from 'react'
import { AdminActivityPanel } from './AdminActivityPanel'
import { AdminPanel } from './AdminPageShell'
import type { ActivityEntry } from '@/features/admin/services/admin-activity-query'

interface EntityActivitySectionProps {
  readonly entity: string
  readonly entityId: string
}

/**
 * Self-contained client component that fetches and renders
 * activity history for a single entity on its detail screen.
 * Mounts on order / product / user detail pages (T053-T055).
 */
export function EntityActivitySection({
  entity,
  entityId,
}: EntityActivitySectionProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)

  const buildUrl = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams({
        entity,
        entityId,
      })
      if (cursor) params.set('cursor', cursor)
      return `/api/admin/activity?${params.toString()}`
    },
    [entity, entityId]
  )

  useEffect(() => {
    let cancelled = false
    fetch(buildUrl())
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('fail'))))
      .then((body) => {
        if (!cancelled) {
          setEntries(body.data?.entries ?? [])
          setNextCursor(body.data?.nextCursor ?? null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEntries([])
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [buildUrl])

  const handleLoadMore = () => {
    if (!nextCursor) return
    setLoading(true)
    fetch(buildUrl(nextCursor))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('fail'))))
      .then((body) => {
        setEntries((prev) => [...prev, ...(body.data?.entries ?? [])])
        setNextCursor(body.data?.nextCursor ?? null)
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }

  return (
    <AdminPanel title="Activity History">
      <AdminActivityPanel
        entries={entries}
        loading={loading}
        nextCursor={nextCursor}
        onLoadMore={handleLoadMore}
        emptyMessage="No activity recorded for this record."
      />
    </AdminPanel>
  )
}
