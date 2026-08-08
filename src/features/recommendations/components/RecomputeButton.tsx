'use client'

import { useState } from 'react'

type DispatchResult = 'published' | 'fallback' | 'dropped'

/**
 * Trigger an out-of-schedule scoring run.
 *
 * Surfaces the dispatch result verbatim so an operator can tell "queued" apart
 * from "Inngest is not configured in this environment" — the two look
 * identical from the outside otherwise.
 */
export function RecomputeButton() {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const recompute = async () => {
    setPending(true)
    setMessage(null)

    try {
      const response = await fetch('/api/admin/recommendations/recompute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const body = await response.json()

      if (!response.ok || !body?.success) {
        setMessage(body?.error ?? 'Recompute could not be queued.')
        return
      }

      const dispatch = body.data.dispatch as DispatchResult
      setMessage(
        dispatch === 'published'
          ? 'Recompute queued. Scores refresh when the run completes.'
          : `Recompute was not queued (${dispatch}). Check the Inngest configuration for this environment.`
      )
    } catch {
      setMessage('Recompute could not be queued.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={recompute}
        disabled={pending}
        className="self-start rounded-full bg-[var(--btn-primary)] px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
      >
        {pending ? 'Queueing…' : 'Recompute now'}
      </button>
      {message && (
        <output className="text-sm text-[var(--text-secondary)]">
          {message}
        </output>
      )}
    </div>
  )
}
