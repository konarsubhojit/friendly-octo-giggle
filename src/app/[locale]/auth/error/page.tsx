import Link from 'next/link'

function ErrorIcon() {
  return (
    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-500/10 mb-4">
      <svg
        className="h-6 w-6 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M6 18L18 6M6 6l12 12"
        />
      </svg>
    </div>
  )
}

function ErrorActions() {
  return (
    <div className="space-y-3">
      <Link
        href="/auth/signin"
        className="block w-full bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white px-4 py-2 rounded-md hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] transition"
      >
        Try Again
      </Link>
      <Link
        href="/"
        className="block w-full bg-[var(--accent-blush)] text-[var(--text-secondary)] px-4 py-2 rounded-md hover:bg-[var(--accent-peach)]/50 transition"
      >
        Back to Home
      </Link>
    </div>
  )
}

interface AuthErrorPageProps {
  readonly searchParams: Promise<{ error?: string }>
}

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const params = await searchParams
  const error = params.error

  const errorMessages: Record<string, string> = {
    Configuration: 'There is a problem with the server configuration.',
    AccessDenied: 'You do not have permission to sign in.',
    Verification:
      'The verification token has expired or has already been used.',
    Default: 'An error occurred during authentication.',
  }

  const errorMessage = error
    ? errorMessages[error] || errorMessages.Default
    : errorMessages.Default

  return (
    <div className="min-h-screen bg-warm-gradient flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-[var(--surface)]/80 backdrop-blur-sm rounded-lg shadow-warm border border-[var(--border-warm)] p-8">
        <div className="text-center">
          <ErrorIcon />
          <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">
            Authentication Error
          </h1>
          <p className="text-[var(--text-secondary)] mb-6">{errorMessage}</p>
          <ErrorActions />
        </div>
      </div>
    </div>
  )
}
