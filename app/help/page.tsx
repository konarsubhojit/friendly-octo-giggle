import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'Help Center | The Kiyon Store',
  description: 'Find answers to common questions about orders, shipping, returns, and your account.',
};

const faqs = [
  {
    question: 'How do I track my order?',
    answer: 'Once your order ships, you will receive an email with a tracking number. You can also view order status in My Orders after signing in.',
  },
  {
    question: 'Can I change or cancel my order?',
    answer: 'Orders can be modified or cancelled within 1 hour of placement. After that, please contact our support team and we will do our best to help.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, Mastercard, Amex), debit cards, and digital wallets. All transactions are secured with industry-standard encryption.',
  },
  {
    question: 'How long does delivery take?',
    answer: 'Standard delivery takes 3–7 business days. Express delivery (1–2 days) is available at checkout for most locations.',
  },
  {
    question: 'What is your return policy?',
    answer: 'We accept returns within 30 days of delivery for most items. Products must be in original condition. Visit our Returns page for full details.',
  },
  {
    question: 'How do I reset my password?',
    answer: 'Click "Sign In", then "Forgot password?". Enter your email and we will send you a reset link within a few minutes.',
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-bold text-[#4a3728] mb-4">Help Center</h1>
        <p className="text-[#b89a85] text-lg mb-12">Find answers to common questions or reach out to our support team.</p>

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[#f0d5c0] p-8 mb-8">
          <h2 className="text-2xl font-semibold text-[#4a3728] mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {faqs.map(faq => (
              <div key={faq.question} className="border-b border-[#f0d5c0] last:border-0 pb-6 last:pb-0">
                <h3 className="font-semibold text-[#4a3728] mb-2">{faq.question}</h3>
                <p className="text-[#7a6355] text-sm leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[#f0d5c0] p-8">
          <h2 className="text-xl font-semibold text-[#4a3728] mb-4">Still need help?</h2>
          <p className="text-[#7a6355] mb-6">Our support team is available Monday–Friday, 9am–6pm EST.</p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="bg-gradient-to-r from-[#e8a87c] to-[#d4856b] text-white px-6 py-3 rounded-xl font-semibold hover:from-[#d4856b] hover:to-[#c7735a] transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Contact Support
            </Link>
            <a
              href="mailto:support@estore.example.com"
              className="border border-[#f0d5c0] text-[#7a6355] px-6 py-3 rounded-xl font-semibold hover:bg-[#fde8d8] transition-all duration-300"
            >
              Email Us
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
