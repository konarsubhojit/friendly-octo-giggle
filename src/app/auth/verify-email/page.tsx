'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

type VerificationState = 'idle' | 'loading' | 'success' | 'error'

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const identifier = searchParams.get('identifier') ?? ''
  const registered = searchParams.get('registered') === 'true'
  const [state, setState] = useState<VerificationState>(
    token && identifier ? 'loading' : 'idle'
  )
  const [message, setMessage] = useState(
    registered
      ? 'Check your inbox for a verification link to complete your registration.'
      : ''
  )

  const hasVerificationParams = useMemo(
    () => token.trim().length > 0 && identifier.trim().length > 0,
    [identifier, token]
  )

  useEffect(() => {
    if (!hasVerificationParams) return

    let cancelled = false

    const run = async () => {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, token }),
        })
        const data = await response.json()
        if (cancelled) return
        if (response.ok) {
          setState('success')
          setMessage(
            data?.data?.message ??
              'Your email is verified. You can now sign in to your account.'
          )
          return
        }
        setState('error')
        setMessage(
          data?.error ?? 'This verification link is invalid or has expired.'
        )
      } catch (_error) {
        if (cancelled) return
        setState('error')
        setMessage('Could not verify your email right now. Please try again.')
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [hasVerificationParams, identifier, token])

  return (
    <div className="min-h-screen bg-warm-gradient flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full bg-[var(--surface)]/80 backdrop-blur-sm rounded-xl shadow-warm border border-[var(--border-warm)] p-6 sm:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] mb-2">
            Verify Email
          </h1>
          {state === 'loading' ? (
            <p className="text-[var(--text-secondary)]">Verifying your email…</p>
          ) : message ? (
            <p
              className={
                state === 'error'
                  ? 'text-red-700'
                  : 'text-[var(--text-secondary)]'
              }
            >
              {message}
            </p>
          ) : (
            <p className="text-[var(--text-secondary)]">
              Use the link in your inbox to verify your email address.
            </p>
          )}
        </div>

        <div className="mt-6 text-center space-y-2">
          <Link
            href="/auth/signin"
            className="text-sm font-semibold text-[var(--btn-primary)] hover:text-[var(--btn-primary-hover)] block"
          >
            Go to sign in
          </Link>
          <Link
            href="/auth/register"
            className="text-sm text-[var(--btn-primary)] hover:text-[var(--btn-primary-hover)] block"
          >
            Back to register
          </Link>
        </div>
      </div>
    </div>
  )
}
