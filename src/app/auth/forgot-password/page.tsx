'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { DynamicForm, type FieldDef, type SubmitResult } from '@/components/ui/DynamicForm'

const FORGOT_PASSWORD_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: 'forgot-password-email',
    name: 'email',
    label: 'Email',
    type: 'email',
    placeholder: 'you@example.com',
    autoComplete: 'email',
    validate: (value) => {
      const normalized = value.trim()
      if (!normalized) return 'Email is required'
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
      return isValid ? undefined : 'Enter a valid email address'
    },
  },
]

const GENERIC_SUCCESS =
  'If an account exists for that email, you will receive a password reset link shortly.'

export default function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState('')

  const handleSubmit = useCallback(
    async (values: Readonly<Record<string, string>>): Promise<SubmitResult> => {
      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: values.email }),
        })
        const data = await response.json()
        setSuccessMessage(data?.data?.message ?? GENERIC_SUCCESS)
        return undefined
      } catch {
        setSuccessMessage(GENERIC_SUCCESS)
        return undefined
      }
    },
    []
  )

  return (
    <div className="min-h-screen bg-warm-gradient flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full bg-[var(--surface)]/80 backdrop-blur-sm rounded-xl shadow-warm border border-[var(--border-warm)] p-6 sm:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] mb-2">
            Forgot password
          </h1>
          <p className="text-[var(--text-secondary)]">
            Enter your email and we&apos;ll send a reset link.
          </p>
        </div>

        <DynamicForm
          fields={FORGOT_PASSWORD_FIELDS}
          onSubmit={handleSubmit}
          submitLabel="Send reset link"
          submittingLabel="Sending..."
          serverSuccess={successMessage}
          formClassName="space-y-4"
          submitButtonClassName="w-full py-3 bg-[var(--btn-primary)] bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white rounded-full font-semibold hover:from-[var(--accent-pink)] hover:to-[var(--accent-rose)] transition-all duration-300 shadow-warm hover:shadow-warm-lg disabled:opacity-50 disabled:cursor-not-allowed focus-warm"
        />

        <div className="mt-6 text-center space-y-2">
          <Link
            href="/auth/signin"
            className="text-sm font-semibold text-[var(--btn-primary)] hover:text-[var(--btn-primary-hover)]"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}

