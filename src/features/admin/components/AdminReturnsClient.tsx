'use client'

import { useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  AdminReturnCard,
  type AdminReturn,
} from '@/features/admin/components/AdminReturnCard'
import {
  decideAdminReturn,
  fetchAdminReturns,
  hydrateReturns,
  setReturnsFilter,
  type ReturnQueueFilter,
} from '@/features/orders/store/returnsSlice'
import type { AdminDispatch, AdminRootState } from '@/lib/store'
import { RETURN_STATUSES, type ReturnAction } from '@/lib/constants/returns'

const TRIAGE_DEFAULT: ReturnQueueFilter = 'REQUESTED'

interface AdminReturnsClientProps {
  /**
   * Fetched on the server so the queue renders populated on first paint and
   * the client never has to fetch-then-setState during its initial effect.
   */
  readonly initialReturns: readonly AdminReturn[]
}

/**
 * The returns triage queue.
 *
 * Defaults to `REQUESTED` because that is the only state with work waiting on
 * a human; the other filters exist for lookup, not for triage.
 */
export function AdminReturnsClient({
  initialReturns,
}: AdminReturnsClientProps) {
  const dispatch = useDispatch<AdminDispatch>()
  const { filter, items, loading, error, decisionError } = useSelector(
    (state: AdminRootState) => state.returns
  )

  // The server already delivered the default view, so the first pass seeds the
  // store rather than refetching it.
  const hydratedFilter = useRef<ReturnQueueFilter | null>(null)

  useEffect(() => {
    if (hydratedFilter.current === null) {
      hydratedFilter.current = TRIAGE_DEFAULT
      dispatch(
        hydrateReturns({ filter: TRIAGE_DEFAULT, items: [...initialReturns] })
      )
      return
    }

    if (hydratedFilter.current === filter) return
    hydratedFilter.current = filter
    void dispatch(fetchAdminReturns(filter))
  }, [dispatch, filter, initialReturns])

  const decide = async (
    returnId: string,
    action: ReturnAction,
    decisionReason?: string
  ): Promise<boolean> => {
    const result = await dispatch(
      decideAdminReturn({ returnId, action, decisionReason })
    )
    return decideAdminReturn.fulfilled.match(result)
  }

  const message = error ?? decisionError

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['ALL', ...RETURN_STATUSES] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => dispatch(setReturnsFilter(value))}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === value
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {message && (
        <p
          className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {message}
        </p>
      )}

      {loading && (
        <output className="block text-sm text-slate-600">Loading…</output>
      )}

      {!loading && items.length === 0 && (
        <p className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
          No returns in this state.
        </p>
      )}

      <div className="space-y-4">
        {items.map((returnRequest) => (
          <AdminReturnCard
            key={returnRequest.id}
            returnRequest={returnRequest}
            onDecide={(action, decisionReason) =>
              decide(returnRequest.id, action, decisionReason)
            }
          />
        ))}
      </div>
    </div>
  )
}
