'use client'

import { useId, useRef, useState, type BaseSyntheticEvent } from 'react'
import { useCurrency } from '@/contexts/CurrencyContext'
import {
  RETURN_REASONS,
  RETURN_REASON_LABELS,
  type ReturnReason,
} from '@/lib/constants/returns'
import {
  ReturnEvidenceUploader,
  type UploadedEvidence,
} from './ReturnEvidenceUploader'

export interface ReturnableItem {
  readonly orderItemId: string
  readonly name: string
  readonly returnableQuantity: number
  readonly unitPrice: number
}

interface ReturnRequestFormProps {
  readonly orderId: string
  readonly items: readonly ReturnableItem[]
  /** Receives the new return id so the parent can show the video prompt. */
  readonly onSubmitted?: (returnId: string) => void
}

/**
 * Damaged-item return claim form.
 *
 * Reasons come from `RETURN_REASONS`, which is restricted to damage
 * categories — the enum is the enforcement point for a published policy
 * constraint, so no change-of-mind option appears here.
 */
export function ReturnRequestForm({
  orderId,
  items,
  onSubmitted,
}: ReturnRequestFormProps) {
  const { formatPrice } = useCurrency()
  const reasonId = useId()
  const noteId = useId()

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState<ReturnReason>(RETURN_REASONS[0])
  const [customerNote, setCustomerNote] = useState('')
  const [evidence, setEvidence] = useState<UploadedEvidence[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // `setSubmitting` only disables the button after the next render commits, so
  // a fast double-click files two claims. This latch is synchronous.
  const inFlight = useRef(false)

  const selected = Object.entries(quantities).filter(
    ([, quantity]) => quantity > 0
  )
  const canSubmit = selected.length > 0 && evidence.length > 0 && !submitting

  const handleSubmit = async (event: BaseSyntheticEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch(`/api/orders/${orderId}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          customerNote: customerNote.trim() || undefined,
          items: selected.map(([orderItemId, quantity]) => ({
            orderItemId,
            quantity,
          })),
          evidenceIds: evidence.map((item) => item.id),
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.error ?? 'Your return could not be submitted.')
        return
      }

      // The parent owns the video prompt: submitting a full return makes this
      // form ineligible and unmounts it.
      onSubmitted?.(payload.data.id)
    } catch {
      setError('Your return could not be submitted. Please try again.')
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <fieldset className="border-0 p-0 m-0">
        <legend className="block text-sm font-medium text-[var(--foreground)] mb-2">
          Which items arrived damaged?
        </legend>
        <ul className="space-y-3 list-none p-0">
          {items.map((item) => (
            <li
              key={item.orderItemId}
              className="flex items-center justify-between gap-4 rounded-lg border border-[var(--border-warm)] p-3"
            >
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  {item.name}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {formatPrice(item.unitPrice)} each · {item.returnableQuantity}{' '}
                  available to return
                </p>
              </div>
              <label className="flex items-center gap-2">
                <span className="sr-only">
                  Quantity to return for {item.name}
                </span>
                <input
                  type="number"
                  min={0}
                  max={item.returnableQuantity}
                  value={quantities[item.orderItemId] ?? 0}
                  onChange={(event) =>
                    setQuantities((current) => ({
                      ...current,
                      [item.orderItemId]: Math.min(
                        Math.max(Number(event.target.value) || 0, 0),
                        item.returnableQuantity
                      ),
                    }))
                  }
                  className="w-20 rounded-lg border border-[var(--border-warm)] px-3 py-2 text-sm"
                />
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div>
        <label
          htmlFor={reasonId}
          className="block text-sm font-medium text-[var(--foreground)] mb-2"
        >
          What is wrong with it?
        </label>
        <select
          id={reasonId}
          value={reason}
          onChange={(event) => setReason(event.target.value as ReturnReason)}
          className="w-full rounded-lg border border-[var(--border-warm)] px-3 py-2 text-sm"
        >
          {RETURN_REASONS.map((value) => (
            <option key={value} value={value}>
              {RETURN_REASON_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor={noteId}
          className="block text-sm font-medium text-[var(--foreground)] mb-2"
        >
          Anything else we should know? (optional)
        </label>
        <textarea
          id={noteId}
          value={customerNote}
          maxLength={1000}
          rows={3}
          onChange={(event) => setCustomerNote(event.target.value)}
          className="w-full rounded-lg border border-[var(--border-warm)] px-3 py-2 text-sm"
        />
      </div>

      <ReturnEvidenceUploader
        orderId={orderId}
        evidence={evidence}
        onUploaded={(item) => setEvidence((current) => [...current, item])}
        disabled={submitting}
      />

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-xl bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] px-6 py-3 font-semibold text-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit return request'}
      </button>
    </form>
  )
}
