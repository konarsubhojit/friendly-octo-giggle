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
        className="text-sm text-[#7a6355] mb-2 block"
      >
        Subscribe to our newsletter
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          placeholder="Enter your email"
          aria-label="Email address for newsletter subscription"
          className="px-4 py-2 rounded-full bg-white/80 text-[#4a3728] border border-[#f0d5c0] focus:outline-none focus:border-[#e8a87c] focus:ring-2 focus:ring-[#e8a87c]/30 transition-all duration-300 flex-1 placeholder-[#b89a85]"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white rounded-full font-semibold hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] transition-all duration-300 shadow-warm focus-warm"
          aria-label="Subscribe to newsletter"
        >
          Subscribe
        </button>
      </div>
    </form>
  );
}
