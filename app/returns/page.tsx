import Footer from "@/components/layout/Footer";
import Link from "next/link";
import {
  CHECKOUT_POLICIES,
  SUPPORT_EMAIL,
  type CheckoutPolicySection,
} from "@/lib/constants/checkout-policies";

export const metadata = {
  title: "Returns & Refunds | The Kiyon Store",
  description:
    "Learn about our damaged-item replacement process and order policy.",
};

function ReturnPolicySection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 mb-8">
      <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
        Return Policy
      </h2>
      <div className="space-y-6">
        {Object.values(CHECKOUT_POLICIES).map(
          (section: CheckoutPolicySection) => (
            <div key={section.title}>
              <h3 className="font-semibold text-[var(--foreground)] mb-2">
                {section.title}
              </h3>
              <ul className="space-y-2 text-[var(--text-secondary)]">
                {section.items.map((item: string) => (
                  <li key={item} className="flex gap-3">
                    <svg
                      className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ),
        )}
      </div>
    </section>
  );
}

const RETURN_STEPS = [
  `Email ${SUPPORT_EMAIL} with detailed photos, a short video, and a description of the issue.`,
  "Wait for our team to review the damage claim and respond with next steps.",
  "If approved, send the damaged product back using a shipment you arrange and pay for.",
  "After the returned item is received and reviewed, we will send a replacement product.",
  "We do not charge shipping for sending the replacement product to you.",
] as const;

function ReturnStepsSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 mb-8">
      <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">
        Damaged-Item Process
      </h2>
      <ol className="space-y-4">
        {RETURN_STEPS.map((step, i) => (
          <li key={step} className="flex gap-4">
            <span className="w-7 h-7 bg-[var(--accent-blush)] text-[var(--accent-rose)] rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              {i + 1}
            </span>
            <span className="text-[var(--text-secondary)] pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NonReturnableSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8">
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
        Important Reminder
      </h2>
      <p className="text-[var(--text-secondary)] mb-4">
        Orders are not returnable unless the product arrives damaged. Refunds
        are not issued.
      </p>
      <p className="mt-6 text-[var(--text-secondary)] text-sm">
        Questions?{" "}
        <Link
          href="/contact"
          className="text-[var(--btn-primary)] hover:underline"
        >
          Contact our support team
        </Link>{" "}
        or email {SUPPORT_EMAIL} and we&apos;ll help review damaged-item claims.
      </p>
    </section>
  );
}

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4">
          Returns & Refunds
        </h1>
        <p className="text-[var(--text-muted)] text-lg mb-12">
          Review our cancellation, damaged-item, and replacement guidance before
          reaching out for support.
        </p>

        <ReturnPolicySection />
        <ReturnStepsSection />
        <NonReturnableSection />
      </main>
      <Footer />
    </div>
  );
}
