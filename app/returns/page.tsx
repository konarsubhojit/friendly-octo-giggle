import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'Returns & Refunds | The Kiyon Store',
  description: 'Learn about our hassle-free return and refund policy.',
};

function ReturnPolicySection() {
  return (
    <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[#f0d5c0] p-8 mb-8">
      <h2 className="text-2xl font-semibold text-[#4a3728] mb-4">Return Policy</h2>
      <ul className="space-y-3 text-[#7a6355]">
        <li className="flex gap-3">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Returns accepted within <strong>30 days</strong> of delivery for most items.
        </li>
        <li className="flex gap-3">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Items must be in <strong>original, unused condition</strong> with all original packaging.
        </li>
        <li className="flex gap-3">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <strong>Free return shipping</strong> on all orders — we provide a prepaid label.
        </li>
        <li className="flex gap-3">
          <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Refunds are processed within <strong>3–5 business days</strong> of receiving the return.
        </li>
      </ul>
    </section>
  );
}

const RETURN_STEPS = [
  'Sign in to your account and go to My Orders.',
  'Select the order and item(s) you wish to return.',
  'Choose your return reason and submit the request.',
  'We will email you a prepaid return shipping label within 24 hours.',
  'Pack the item(s) securely and drop off at any carrier location.',
  'Once received and inspected, your refund will be issued.',
] as const;

function ReturnStepsSection() {
  return (
    <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[#f0d5c0] p-8 mb-8">
      <h2 className="text-2xl font-semibold text-[#4a3728] mb-4">How to Start a Return</h2>
      <ol className="space-y-4">
        {RETURN_STEPS.map((step, i) => (
          <li key={step} className="flex gap-4">
            <span className="w-7 h-7 bg-[#fde8d8] text-[#d4856b] rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">{i + 1}</span>
            <span className="text-[#7a6355] pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function NonReturnableSection() {
  return (
    <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[#f0d5c0] p-8">
      <h2 className="text-xl font-semibold text-[#4a3728] mb-4">Non-Returnable Items</h2>
      <p className="text-[#7a6355] mb-4">The following items cannot be returned:</p>
      <ul className="list-disc list-inside space-y-1 text-[#7a6355] text-sm">
        <li>Perishable goods (food, flowers, etc.)</li>
        <li>Digital products and software licenses</li>
        <li>Customized or personalized items</li>
        <li>Items marked as Final Sale</li>
      </ul>
      <p className="mt-6 text-[#7a6355] text-sm">
        Questions? <Link href="/contact" className="text-[#d4856b] hover:underline">Contact our support team</Link> and we&apos;ll be happy to help.
      </p>
    </section>
  );
}

export default function ReturnsPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-bold text-[#4a3728] mb-4">Returns & Refunds</h1>
        <p className="text-[#b89a85] text-lg mb-12">We want you to be 100% satisfied. Our return process is simple and hassle-free.</p>

        <ReturnPolicySection />
        <ReturnStepsSection />
        <NonReturnableSection />
      </main>
      <Footer />
    </div>
  );
}
