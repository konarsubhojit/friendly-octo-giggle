'use client'

import { useId, useState } from 'react'
import { useCurrency } from '@/contexts/CurrencyContext'
import {
  RETURN_REASON_LABELS,
  type ReturnReason,
  type ReturnStatus,
} from '@/lib/constants/returns'

export interface AdminReturnItem {
  readonly orderItemId: string
  readonly quantity: number
  readonly refundableAmount: number
}

export interface AdminReturnEvidence {
  readonly id: string
  readonly url: string
}

export interface AdminReturn {
  readonly id: string
  readonly orderId: string
  readonly status: ReturnStatus
  readonly reason: ReturnReason
  readonly customerNote: string | null
  readonly decisionReason: string | null
  readonly customerName: string
  readonly customerEmail: string
  readonly paymentProvider: string | null
  readonly refundAmount: number
  readonly refundId: string | null
  readonly refundErrorMessage?: string | null
  readonly createdAt: string
  readonly items?: readonly AdminReturnItem[]
  readonly evidence?: readonly AdminReturnEvidence[]
}

type ReturnAction = 'approve' | 'reject' | 'receive' | 'refund' | 'settle'

interface AdminReturnCardProps {
  readonly returnRequest: AdminReturn
  /**
   * Records the decision and reports whether it succeeded.
   *
   * The card never talks to the network itself: HTTP for admin state goes
   * through the Redux thunk, which routes via `lib/api-client.ts`.
   */
  readonly onDecide: (
    action: ReturnAction,
    decisionReason?: string
  ) => Promise<boolean>
}

/**
 * Which actions a return offers, given its state.
 *
 * Mirrors the server-side transition table. This is a convenience for the
 * operator, never a control: the server re-checks every transition under a row
 * lock, so a stale card cannot drive an illegal move.
 */
const availableActions = (
  returnRequest: AdminReturn
): readonly ReturnAction[] => {
  switch (returnRequest.status) {
    case 'REQUESTED':
      return ['approve', 'reject']
    case 'APPROVED':
      return ['receive', 'reject']
    case 'RECEIVED':
      return ['refund']
    case 'REFUNDED':
      // Cash on Delivery captured nothing at checkout, so its refund is a
      // manual payment an operator confirms by hand.
      return returnRequest.paymentProvider === 'COD' ? ['settle'] : []
    default:
      return []
  }
}

const ACTION_LABELS: Record<ReturnAction, string> = {
  approve: 'Approve',
  reject: 'Reject',
  receive: 'Mark received',
  refund: 'Issue refund',
  settle: 'Mark settled',
}

const REQUIRES_REASON = new Set<ReturnAction>(['approve', 'reject'])

export function AdminReturnCard({
  returnRequest,
  onDecide,
}: AdminReturnCardProps) {
  const { formatPrice } = useCurrency()
  const reasonId = useId()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<ReturnAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const actions = availableActions(returnRequest)

  const runAction = async (action: ReturnAction) => {
    setError(null)

    if (REQUIRES_REASON.has(action) && !reason.trim()) {
      setError('A reason is required and is shown to the customer.')
      return
    }

    setBusy(action)
    try {
      const succeeded = await onDecide(
        action,
        REQUIRES_REASON.has(action) ? reason.trim() : undefined
      )

      if (!succeeded) {
        setError('That action could not be completed.')
        return
      }

      setReason('')
    } finally {
      setBusy(null)
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">
            Order #{returnRequest.orderId.toUpperCase()}
          </h3>
          <p className="text-sm text-slate-600">
            {returnRequest.customerName} · {returnRequest.customerEmail}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {returnRequest.status}
        </span>
      </header>

      <dl className="mb-3 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="font-medium text-slate-700">Reason:</dt>
          <dd className="text-slate-600">
            {RETURN_REASON_LABELS[returnRequest.reason]}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-medium text-slate-700">Refund:</dt>
          <dd className="text-slate-600">
            {formatPrice(returnRequest.refundAmount)}
            {returnRequest.paymentProvider === 'COD' && ' (Cash on Delivery)'}
          </dd>
        </div>
        {returnRequest.customerNote && (
          <div className="flex gap-2">
            <dt className="font-medium text-slate-700">Note:</dt>
            <dd className="text-slate-600">{returnRequest.customerNote}</dd>
          </div>
        )}
        {returnRequest.decisionReason && (
          <div className="flex gap-2">
            <dt className="font-medium text-slate-700">Decision:</dt>
            <dd className="text-slate-600">{returnRequest.decisionReason}</dd>
          </div>
        )}
      </dl>

      {returnRequest.evidence && returnRequest.evidence.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2 p-0 list-none">
          {returnRequest.evidence.map((item, index) => (
            <li key={item.id}>
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob
                    host is provider-dependent and not in the Image allowlist */}
                <img
                  src={item.url}
                  alt={`Damage evidence ${index + 1}`}
                  className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* A gateway rejection leaves the return at RECEIVED with the refund
          retryable, so the failure is shown alongside the retry rather than
          hidden. */}
      {returnRequest.refundErrorMessage && (
        <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Last refund attempt failed: {returnRequest.refundErrorMessage}
        </p>
      )}

      {actions.some((action) => REQUIRES_REASON.has(action)) && (
        <div className="mb-3">
          <label
            htmlFor={reasonId}
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Reason (shown to the customer)
          </label>
          <input
            id={reasonId}
            type="text"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      {error && (
        <p className="mb-3 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={busy !== null}
            onClick={() => void runAction(action)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {busy === action ? 'Working…' : ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </article>
  )
}
