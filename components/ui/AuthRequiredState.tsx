import Link from 'next/link';

interface AuthRequiredStateProps {
  /** The URL to redirect back to after sign-in (e.g. '/cart'). */
  readonly callbackUrl: string;
  readonly title?: string;
  readonly message?: string;
  readonly ctaText?: string;
}

/**
 * Full-page "Sign In Required" placeholder shown when a protected page is
 * accessed without authentication.
 *
 * Usage:
 * ```tsx
 * <AuthRequiredState callbackUrl="/cart" message="Sign in to view your cart." />
 * ```
 */
export function AuthRequiredState({
  callbackUrl,
  title = 'Sign In Required',
  message = 'Please sign in to continue.',
  ctaText = 'Sign In',
}: AuthRequiredStateProps) {
  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-12 text-center">
      <svg
        className="w-16 h-16 mx-auto mb-4 text-gray-400"
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
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{title}</h2>
      <p className="text-gray-600 mb-6">{message}</p>
      <Link
        href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
      >
        {ctaText}
      </Link>
    </div>
  );
}
