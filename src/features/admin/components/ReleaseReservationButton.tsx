'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

interface ReleaseReservationButtonProps {
  readonly checkoutRequestId: string
  readonly heldQuantity: number
}

/**
 * Manual escape hatch for a hold the automatic paths cannot settle — a request
 * wedged by an operational incident, say — so an operator never has to wait out
 * the expiry TTL with stock stranded.
 */
export default function ReleaseReservationButton({
  checkoutRequestId,
  heldQuantity,
}: ReleaseReservationButtonProps) {
  const router = useRouter()
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleConfirm = async () => {
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/checkout-requests/${checkoutRequestId}/reservations/release`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'admin_manual_release' }),
        }
      )

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        setError(payload?.error ?? 'Failed to release the reservation')
        return
      }

      setIsConfirming(false)
      startTransition(() => router.refresh())
    } catch {
      setError('Failed to release the reservation')
    }
  }

  return (
    <>
      <ConfirmDialog
        isOpen={isConfirming}
        title="Release reservation"
        message={`Return ${heldQuantity} held unit${heldQuantity === 1 ? '' : 's'} to available stock for checkout request ${checkoutRequestId}?`}
        confirmLabel="Yes, release"
        variant="warning"
        loading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setIsConfirming(false)}
      />
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        disabled={isPending}
        className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:text-rose-300"
      >
        Release
      </button>
      {error ? (
        <p
          className="mt-1 text-xs text-rose-700 dark:text-rose-300"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </>
  )
}
