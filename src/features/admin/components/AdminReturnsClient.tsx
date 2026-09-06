'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AdminDataView } from '@/features/admin/components/AdminDataView'
import {
  AdminReturnCard,
  type AdminReturn,
} from '@/features/admin/components/AdminReturnCard'
import {
  createReturnsDefinition,
  type ReturnRow,
} from '@/features/admin/resources/returns'
import {
  decideAdminReturn,
  fetchAdminReturns,
  hydrateReturns,
  setReturnsFilter,
  type ReturnQueueFilter,
} from '@/features/orders/store/returnsSlice'
import {
  RETURN_REASON_LABELS,
  RETURN_STATUSES,
  type ReturnAction,
} from '@/lib/constants/returns'
import type { AdminPermission } from '@/lib/constants/roles'
import type { AdminDispatch, AdminRootState } from '@/lib/store'

const TRIAGE_DEFAULT: ReturnQueueFilter = 'REQUESTED'

interface AdminReturnsClientProps {
  /**
   * Fetched on the server so the queue renders populated on first paint and
   * the client never has to fetch-then-setState during its initial effect.
   */
  readonly initialReturns: readonly AdminReturn[]
  readonly permissions: readonly AdminPermission[]
}

const formatCreatedAt = (createdAt: string): string =>
  new Date(createdAt).toLocaleDateString('en-GB')

const toReturnRow = (returnRequest: AdminReturn): ReturnRow => ({
  id: returnRequest.id,
  orderId: returnRequest.orderId,
  customer: `${returnRequest.customerName} (${returnRequest.customerEmail})`,
  status: returnRequest.status,
  reason: RETURN_REASON_LABELS[returnRequest.reason],
  createdAt: formatCreatedAt(returnRequest.createdAt),
})

/**
 * The returns triage queue.
 *
 * Defaults to `REQUESTED` because that is the only state with work waiting on
 * a human; the other filters exist for lookup, not for triage.
 */
export function AdminReturnsClient({
  initialReturns,
  permissions,
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

  const returnsDefinition = useMemo(
    () =>
      createReturnsDefinition(permissions, {
        onApprove: () => {},
        onReject: () => {},
        onMarkReceived: () => {},
        onRefund: () => {},
        onMarkCompleted: () => {},
        onViewOrder: (row) => {
          globalThis.location.assign(
            `/admin/orders?search=${encodeURIComponent(row.orderId)}`
          )
        },
      }),
    [permissions]
  )

  const returnRows = useMemo(() => items.map(toReturnRow), [items])
  const returnsById = useMemo(
    () =>
      new Map(items.map((returnRequest) => [returnRequest.id, returnRequest])),
    [items]
  )
  const message = error ?? decisionError
  const emptyMessage =
    filter === 'ALL' ? 'No returns found.' : 'No returns in this state.'

  const listState =
    loading && items.length === 0
      ? { status: 'loading' as const }
      : items.length === 0
        ? {
            status:
              filter === 'ALL'
                ? ('empty' as const)
                : ('filtered-empty' as const),
            message:
              filter === 'ALL'
                ? returnsDefinition.emptyMessage
                : 'No returns in this state.',
          }
        : { status: 'ready' as const }

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

      {message ? (
        <p
          className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700"
          role="alert"
        >
          {message}
        </p>
      ) : null}

      {loading ? (
        <output className="block text-sm text-slate-600">Loading…</output>
      ) : null}

      <AdminDataView
        ariaLabel="Returns"
        definition={returnsDefinition}
        data={returnRows}
        rowKey={(row) => row.id}
        loading={loading && items.length === 0}
        skeletonRowCount={5}
        emptyMessage={emptyMessage}
        listState={listState}
        expandedRowRender={(row) => {
          const returnRequest = returnsById.get(row.id)
          return returnRequest ? (
            <div className="px-4 pb-4">
              <AdminReturnCard
                returnRequest={returnRequest}
                onDecide={(action, decisionReason) =>
                  decide(returnRequest.id, action, decisionReason)
                }
              />
            </div>
          ) : null
        }}
        renderMobileCard={(row) => {
          const returnRequest = returnsById.get(row.id)
          return returnRequest ? (
            <AdminReturnCard
              returnRequest={returnRequest}
              onDecide={(action, decisionReason) =>
                decide(returnRequest.id, action, decisionReason)
              }
            />
          ) : null
        }}
      />
    </div>
  )
}
