'use client'

import { useCurrency } from '@/contexts/CurrencyContext'
import {
  RETURN_REASON_LABELS,
  type ReturnReason,
  type ReturnStatus,
} from '@/lib/constants/returns'

export interface CustomerReturn {
  readonly id: string
  readonly status: ReturnStatus
  readonly reason: ReturnReason
  readonly decisionReason: string | null
  readonly refundAmount: number
  readonly createdAt: string
  readonly refund?: {
    readonly amount: number
    readonly status: string
    readonly processedAt: string | null
  } | null
}

interface StatusCopy {
  readonly label: string
  readonly nextStep: string
  readonly tone: string
}

/**
 * What each state means, and what happens next.
 *
 * The next step matters as much as the label: not knowing what happens next is
 * what sends people to support, which is the thing this panel exists to
 * prevent.
 */
const STATUS_COPY: Record<ReturnStatus, StatusCopy> = {
  REQUESTED: {
    label: 'Under review',
    nextStep:
      'Our team is reviewing your photos. We will email you with a decision.',
    tone: 'bg-amber-50 text-amber-800',
  },
  APPROVED: {
    label: 'Approved',
    nextStep:
      'Please send the item back to us. Return shipping is arranged and paid by you.',
    tone: 'bg-emerald-50 text-emerald-800',
  },
  REJECTED: {
    label: 'Not approved',
    nextStep: 'Contact support if you think this decision is a mistake.',
    tone: 'bg-rose-50 text-rose-800',
  },
  RECEIVED: {
    label: 'Item received',
    nextStep: 'Your refund is being prepared. We will email you once issued.',
    tone: 'bg-sky-50 text-sky-800',
  },
  REFUNDED: {
    label: 'Refunded',
    nextStep:
      'Depending on your bank, the money can take a few working days to appear.',
    tone: 'bg-emerald-50 text-emerald-800',
  },
}

interface ReturnStatusPanelProps {
  readonly returnRequest: CustomerReturn
}

export function ReturnStatusPanel({ returnRequest }: ReturnStatusPanelProps) {
  const { formatPrice } = useCurrency()
  const copy = STATUS_COPY[returnRequest.status]

  return (
    <section className="rounded-xl border border-[var(--border-warm)] p-5">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-[var(--foreground)]">
          {RETURN_REASON_LABELS[returnRequest.reason]}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${copy.tone}`}
        >
          {copy.label}
        </span>
      </header>

      <p className="mb-3 text-sm text-[var(--text-secondary)]">
        {copy.nextStep}
      </p>

      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="font-medium text-[var(--foreground)]">Reference:</dt>
          <dd className="font-mono text-[var(--text-secondary)]">
            {returnRequest.id}
          </dd>
        </div>

        {returnRequest.decisionReason && (
          <div className="flex gap-2">
            <dt className="font-medium text-[var(--foreground)]">Reason:</dt>
            <dd className="text-[var(--text-secondary)]">
              {returnRequest.decisionReason}
            </dd>
          </div>
        )}

        {returnRequest.refund && (
          <div className="flex gap-2">
            <dt className="font-medium text-[var(--foreground)]">Refund:</dt>
            <dd className="text-[var(--text-secondary)]">
              {formatPrice(returnRequest.refund.amount)}
              {returnRequest.refund.processedAt &&
                ` on ${new Date(returnRequest.refund.processedAt).toLocaleDateString()}`}
            </dd>
          </div>
        )}
      </dl>
    </section>
  )
}
