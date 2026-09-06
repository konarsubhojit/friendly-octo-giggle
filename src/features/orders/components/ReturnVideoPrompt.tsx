'use client'

import { useState } from 'react'
import { INSTAGRAM_DM_URL, INSTAGRAM_HANDLE } from '@/lib/constants/store'
import { SUPPORT_EMAIL } from '@/lib/constants/checkout-policies'

interface ReturnVideoPromptProps {
  /** The return id the customer must quote so their video can be matched. */
  readonly returnId: string
  /**
   * `featureFlags.returnVideoViaInstagram`, read server-side and passed down.
   * When false the customer is pointed at support email instead — the video
   * instruction is never simply absent, because the published policy requires
   * a video before a damage claim is reviewed.
   */
  readonly instagramEnabled: boolean
}

/**
 * Tells the customer where to send the policy-mandated video.
 *
 * Instagram cannot prefill message text, so the return id is surfaced with a
 * copy control rather than embedded in the deep link.
 */
export function ReturnVideoPrompt({
  returnId,
  instagramEnabled,
}: ReturnVideoPromptProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(returnId)
      setCopied(true)
      globalThis.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied or unavailable over plain HTTP. The id
      // is displayed in full beside the button, so the customer can always
      // select it by hand — no error state is needed.
      setCopied(false)
    }
  }

  return (
    <section
      className="rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/80 p-6"
      aria-labelledby={`return-video-${returnId}`}
    >
      <h3
        id={`return-video-${returnId}`}
        className="text-lg font-semibold text-[var(--foreground)] mb-2"
      >
        One more step: send us a video
      </h3>

      <p className="text-[var(--text-secondary)] mb-4">
        We need a short video of the damage before we can review your claim.
        Quote your return ID so we can match it to this request.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <code className="rounded-lg bg-[var(--accent-blush)] px-3 py-2 font-mono text-sm text-[var(--foreground)]">
          {returnId}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg border border-[var(--border-warm)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-blush)]"
        >
          {copied ? 'Copied' : 'Copy return ID'}
        </button>
        {/* Announced to screen readers without stealing focus. */}
        <span aria-live="polite" className="sr-only">
          {copied ? 'Return ID copied to clipboard' : ''}
        </span>
      </div>

      {instagramEnabled ? (
        <a
          href={INSTAGRAM_DM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] px-6 py-3 font-semibold text-white transition-all duration-300 hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)]"
        >
          Message @{INSTAGRAM_HANDLE} on Instagram
        </a>
      ) : (
        <p className="text-[var(--text-secondary)]">
          Email your video to{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=Return%20${returnId}`}
            className="font-medium text-[var(--btn-primary)] hover:underline"
          >
            {SUPPORT_EMAIL}
          </a>{' '}
          quoting return ID {returnId}.
        </p>
      )}
    </section>
  )
}
