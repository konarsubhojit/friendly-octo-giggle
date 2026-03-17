"use client";

export default function NewsletterForm() {
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        // Newsletter subscription is handled by the form action
      }}
    >
      <label
        htmlFor="newsletter-email"
        className="text-sm text-[var(--text-secondary)] mb-2 block"
      >
        Subscribe to our newsletter
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          placeholder="Enter your email"
          aria-label="Email address for newsletter subscription"
          className="px-4 py-2 rounded-full bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border-warm)] focus:outline-none focus:border-[var(--accent-rose)] focus:ring-2 focus:ring-[var(--accent-rose)]/30 transition-all duration-300 flex-1 placeholder-[var(--text-muted)]"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-[var(--btn-primary)] bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white rounded-full font-semibold hover:from-[var(--accent-pink)] hover:to-[var(--accent-rose)] transition-all duration-300 shadow-warm focus-warm"
          aria-label="Subscribe to newsletter"
        >
          Subscribe
        </button>
      </div>
    </form>
  );
}
