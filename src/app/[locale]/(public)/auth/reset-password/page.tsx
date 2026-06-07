'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from '@/components/ui/LocaleLink'
import { useSearchParams } from 'next/navigation'
import {
  DynamicForm,
  type FieldDef,
  type SubmitResult,
} from '@/components/ui/DynamicForm'
import { PASSWORD_REQUIREMENTS } from '@/lib/validations/primitives'

const RESET_PASSWORD_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: 'reset-password-new',
    name: 'newPassword',
    label: 'New Password',
    type: 'password',
    placeholder: 'Enter a new password',
    autoComplete: 'new-password',
    showPasswordToggle: true,
    showStrengthChecklist: true,
    validate: (value) => {
      if (!value) return 'New password is required'
      if (!PASSWORD_REQUIREMENTS.every((rule) => rule.test(value))) {
        return 'Password does not meet the requirements below.'
      }
      return undefined
    },
  },
  {
    id: 'reset-password-confirm',
    name: 'confirmNewPassword',
    label: 'Confirm New Password',
    type: 'password',
    placeholder: 'Re-enter your new password',
    autoComplete: 'new-password',
    showPasswordToggle: true,
    validate: (value, values) => {
      if (!value) return 'Please confirm your new password.'
      if (value !== values.newPassword) return "Passwords don't match."
      return undefined
    },
    validateOnBlur: true,
  },
]

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const identifier = searchParams.get('identifier') ?? ''
  const [successMessage, setSuccessMessage] = useState('')
  const [serverError, setServerError] = useState('')

  const canSubmit = useMemo(
    () => token.trim().length > 0 && identifier.trim().length > 0,
    [identifier, token]
  )

  const handleSubmit = useCallback(
    async (values: Readonly<Record<string, string>>): Promise<SubmitResult> => {
      setServerError('')
      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier,
            token,
            newPassword: values.newPassword,
            confirmNewPassword: values.confirmNewPassword,
          }),
        })

        const data = await response.json()
        if (!response.ok) {
          return (
            data.error || 'Could not reset your password. Please try again.'
          )
        }

        setSuccessMessage('Password reset successfully. You can now sign in.')
        return undefined
      } catch {
        setServerError('Could not reset your password. Please try again.')
        return undefined
      }
    },
    [identifier, token]
  )

  return (
    <div className="min-h-screen bg-warm-gradient flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full bg-[var(--surface)]/80 backdrop-blur-sm rounded-xl shadow-warm border border-[var(--border-warm)] p-6 sm:p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--foreground)] mb-2">
            Reset password
          </h1>
          <p className="text-[var(--text-secondary)]">
            Choose a new password for your account.
          </p>
        </div>

        {canSubmit ? (
          <DynamicForm
            fields={RESET_PASSWORD_FIELDS}
            onSubmit={handleSubmit}
            submitLabel="Reset password"
            submittingLabel="Resetting..."
            serverError={serverError}
            serverSuccess={successMessage}
            formClassName="space-y-4"
            submitButtonClassName="w-full py-3 bg-[var(--btn-primary)] bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white rounded-full font-semibold hover:from-[var(--accent-pink)] hover:to-[var(--accent-rose)] transition-all duration-300 shadow-warm hover:shadow-warm-lg disabled:opacity-50 disabled:cursor-not-allowed focus-warm"
          />
        ) : (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            This reset link is invalid. Please request a new one.
          </p>
        )}

        <div className="mt-6 text-center space-y-2">
          <Link
            href="/auth/forgot-password"
            className="text-sm font-semibold text-[var(--btn-primary)] hover:text-[var(--btn-primary-hover)] block"
          >
            Request a new reset link
          </Link>
          <Link
            href="/auth/signin"
            className="text-sm text-[var(--btn-primary)] hover:text-[var(--btn-primary-hover)] block"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
