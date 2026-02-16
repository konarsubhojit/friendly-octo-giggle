'use client';

export default function NewsletterForm() {
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        // Newsletter subscription is handled by the form action
      }}
    >
      <label htmlFor="newsletter-email" className="text-sm text-gray-300 mb-2 block">
        Subscribe to our newsletter
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          placeholder="Enter your email"
          aria-label="Email address for newsletter subscription"
          className="px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500 transition-all duration-300 flex-1"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-300"
          aria-label="Subscribe to newsletter"
        >
          Subscribe
        </button>
      </div>
    </form>
  );
}
