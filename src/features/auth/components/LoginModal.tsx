'use client'

import { useEffect, useRef, useCallback } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DynamicForm,
  type FieldDef,
  type SubmitResult,
} from '@/components/ui/DynamicForm'
import { OAuthButtons } from '@/features/auth/components/OAuthButtons'

interface LoginModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
}

const LOGIN_FIELDS: ReadonlyArray<FieldDef> = [
  {
    id: 'login-identifier',
    name: 'identifier',
    label: 'Email or Phone Number',
    type: 'text',
    placeholder: 'you@example.com or +1234567890',
    autoComplete: 'username',
    autoFocus: true,
    validate: (v) =>
      v.trim()
        ? undefined
        : 'Enter the email address or phone number linked to your account.',
  },
  {
    id: 'login-password',
    name: 'password',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter your password',
    autoComplete: 'current-password',
    showPasswordToggle: true,
    validate: (v) => (v ? undefined : 'Enter your password to continue.'),
  },
]

const SUBMIT_BTN =
  'w-full py-3 bg-[var(--btn-primary)] bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white rounded-lg font-semibold hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] transition-all duration-300 shadow-warm hover:shadow-warm-lg disabled:opacity-50 disabled:cursor-not-allowed focus-warm'

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const router = useRouter()

  // Open dialog as modal and handle native cancel (Escape) event
  useEffect(() => {
    const dialog = dialogRef.current
    if (!isOpen || !dialog) return

    document.body.style.overflow = 'hidden'
    dialog.showModal()

    function handleCancel(e: Event) {
      e.preventDefault()
      onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleSubmit = useCallback(
    async (values: Readonly<Record<string, string>>): Promise<SubmitResult> => {
      try {
        const result = await signIn('credentials', {
          identifier: values.identifier,
          password: values.password,
          redirect: false,
        })
        if (result?.error)
          return "We couldn't sign you in with those details. Double-check your email, phone number, and password, then try again."
        onClose()
        router.refresh()
        return undefined
      } catch {
        return 'We hit a temporary issue while signing you in. Please try again.'
      }
    },
    [onClose, router]
  )

  if (!isOpen) return null

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-transparent border-none p-0 m-0 w-full h-full max-w-none max-h-none"
      aria-label="Login"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full sm:max-w-md bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl shadow-2xl z-10 max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {/* Drag handle for mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--border-warm)]" />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="Close login modal"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="px-4 sm:px-6 pt-6 pb-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-[var(--accent-blush)] to-[var(--accent-peach)] mb-3">
              <svg
                className="w-6 h-6 text-[var(--accent-warm)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-[var(--foreground)]">
              Welcome Back
            </h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Choose how to login
            </p>
          </div>

          {/* Credentials form */}
          <DynamicForm
            fields={LOGIN_FIELDS}
            onSubmit={handleSubmit}
            submitLabel="Login"
            submittingLabel="Logging in..."
            submitButtonClassName={SUBMIT_BTN}
            formClassName="space-y-4"
          />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--border-warm)]" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[var(--surface)] text-[var(--text-muted)]">
                or continue with
              </span>
            </div>
          </div>

          {/* OAuth buttons */}
          <OAuthButtons
            onGoogleClick={() => signIn('google')}
            onMicrosoftClick={() => signIn('microsoft-entra-id')}
          />

          {/* Register link */}
          <p className="text-center text-sm text-[var(--text-secondary)] mt-6">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/register"
              onClick={onClose}
              className="font-semibold text-[var(--accent-warm)] hover:text-[var(--accent-rose)]"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </dialog>
  )
}
