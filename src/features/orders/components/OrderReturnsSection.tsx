'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { ReturnRequestForm, type ReturnableItem } from './ReturnRequestForm'
import { ReturnStatusPanel, type CustomerReturn } from './ReturnStatusPanel'
import { ReturnVideoPrompt } from './ReturnVideoPrompt'
import type { ReturnIneligibilityReason } from '@/lib/constants/returns'

interface ReturnEligibility {
  readonly isReturnable: boolean
  readonly reason: ReturnIneligibilityReason | null
  readonly windowExpiresAt: string | null
  readonly items: readonly ReturnableItem[]
  readonly returns?: readonly CustomerReturn[]
  readonly instagramVideoEnabled: boolean
}

/** Why the return action is unavailable, in the customer's terms. */
const INELIGIBILITY_COPY: Record<ReturnIneligibilityReason, string> = {
  NOT_DELIVERED: 'Returns can be requested once your order has been delivered.',
  WINDOW_EXPIRED:
    'The return window for this order has closed. Contact support if you think this is a mistake.',
  FULLY_RETURNED: 'Every item on this order has already been returned.',
  CATEGORY_EXCLUDED: 'The items on this order are not eligible for return.',
}

interface OrderReturnsSectionProps {
  readonly orderId: string
  readonly orderStatus: string
}

/**
 * Return request and status, on the order detail page.
 *
 * Renders nothing at all until the order is delivered — the eligibility
 * endpoint is not even called, because a return is meaningless before then and
 * an empty panel would be noise on every pending order.
 */
export function OrderReturnsSection({
  orderId,
  orderStatus,
}: OrderReturnsSectionProps) {
  const [eligibility, setEligibility] = useState<ReturnEligibility | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Held here rather than inside the form: submitting a full return makes the
  // form ineligible and unmounts it, which would take the video instruction —
  // and the return ID the customer must quote — with it.
  const [createdReturnId, setCreatedReturnId] = useState<string | null>(null)
  const loadedFor = useRef<string | null>(null)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}/returns`)
      if (!response.ok) {
        setError('Return options could not be loaded.')
        return
      }
      const payload = await response.json()
      setEligibility(payload.data)
      setError(null)
    } catch {
      setError('Return options could not be loaded.')
    }
  }, [orderId])

  useEffect(() => {
    if (orderStatus !== 'DELIVERED') return
    if (loadedFor.current === orderId) return
    loadedFor.current = orderId
    void load()
  }, [orderId, orderStatus, load])

  if (orderStatus !== 'DELIVERED') return null

  // Rendering nothing here would be indistinguishable from "this order is not
  // returnable", leaving the customer no way to tell that anything failed.
  if (error) {
    return (
      <Card className="p-8 mb-6">
        <h2 className="text-lg font-bold text-[var(--foreground)] mb-2">
          Returns
        </h2>
        <p className="text-sm text-red-600 mb-3" role="alert">
          {error}
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null)
            void load()
          }}
          className="text-sm font-medium text-[var(--btn-primary)] hover:underline"
        >
          Try again
        </button>
      </Card>
    )
  }

  if (!eligibility) return null

  const existing = eligibility.returns ?? []
  const hasReturnableItems = eligibility.items.some(
    (item) => item.returnableQuantity > 0
  )

  return (
    <Card className="p-8 mb-6">
      <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
        Returns
      </h2>

      {createdReturnId && (
        <div className="mb-6">
          <ReturnVideoPrompt
            returnId={createdReturnId}
            instagramEnabled={eligibility.instagramVideoEnabled}
          />
        </div>
      )}

      {existing.length > 0 && (
        <div className="mb-6 space-y-4">
          {existing.map((returnRequest) => (
            <ReturnStatusPanel
              key={returnRequest.id}
              returnRequest={returnRequest}
            />
          ))}
        </div>
      )}

      {eligibility.isReturnable && hasReturnableItems ? (
        <ReturnRequestForm
          orderId={orderId}
          items={eligibility.items.filter(
            (item) => item.returnableQuantity > 0
          )}
          onSubmitted={(returnId) => {
            setCreatedReturnId(returnId)
            void load()
          }}
        />
      ) : (
        eligibility.reason && (
          <p className="text-sm text-[var(--text-secondary)]">
            {INELIGIBILITY_COPY[eligibility.reason]}
          </p>
        )
      )}
    </Card>
  )
}
