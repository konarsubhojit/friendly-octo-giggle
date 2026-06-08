'use client'

export function RetryButton() {
  return (
    <button
      onClick={() => globalThis.window.location.reload()}
      className="min-tap px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white font-bold shadow-warm hover:opacity-90 transition-opacity focus-warm"
    >
      Try Again
    </button>
  )
}
