'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

interface CopilotDevLoginButtonProps {
  /** Called after a successful sign-in (e.g. close a modal) */
  readonly onSuccess?: () => void;
}

/**
 * DEV-ONLY: one-click sign-in as the Copilot admin account.
 * Renders nothing in production — the `NODE_ENV` check is inlined
 * at build time by Next.js / webpack, so the component is dead-code-
 * eliminated from the production bundle entirely.
 */
export function CopilotDevLoginButton({ onSuccess }: CopilotDevLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  if (process.env.NODE_ENV === 'production') return null;

  async function handleClick() {
    setLoading(true);
    try {
      const result = await signIn('copilot-dev', {
        devToken: 'copilot-dev-admin-2026',
        redirect: false,
      });
      if (result?.ok) {
        onSuccess?.();
        globalThis.location.href = '/admin';
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t-2 border-dashed border-amber-300">
      <p className="text-xs text-center font-semibold text-amber-600 uppercase tracking-wide mb-2">
        ⚠️ Development Only
      </p>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-amber-50 border-2 border-amber-400 text-amber-800 rounded-lg px-4 py-3 font-semibold hover:bg-amber-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Sign in as Copilot Admin (development only)"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5 2.5 2.5 0 0 0 7.5 18 2.5 2.5 0 0 0 10 15.5 2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5 2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0 2.5-2.5 2.5 2.5 0 0 0-2.5-2.5Z" />
        </svg>
        {loading ? 'Signing in…' : 'Sign in as Copilot Admin'}
      </button>
    </div>
  );
}
