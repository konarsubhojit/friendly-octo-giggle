import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Shipping Information | The Kiyon Store',
  description: 'Learn about our shipping options, delivery times, and policies.',
};

function ShippingOptionsSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 mb-8">
      <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-6">Shipping Options</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-warm)]">
              <th className="text-left py-3 pr-6 font-semibold text-[var(--text-secondary)]">Method</th>
              <th className="text-left py-3 pr-6 font-semibold text-[var(--text-secondary)]">Estimated Delivery</th>
              <th className="text-left py-3 font-semibold text-[var(--text-secondary)]">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            <tr>
              <td className="py-3 pr-6 text-[var(--foreground)] font-medium">Standard Shipping</td>
              <td className="py-3 pr-6 text-[var(--text-secondary)]">3–7 business days</td>
              <td className="py-3 text-[var(--text-secondary)]">Free on orders over $50, otherwise $4.99</td>
            </tr>
            <tr>
              <td className="py-3 pr-6 text-[var(--foreground)] font-medium">Express Shipping</td>
              <td className="py-3 pr-6 text-[var(--text-secondary)]">1–2 business days</td>
              <td className="py-3 text-[var(--text-secondary)]">$12.99</td>
            </tr>
            <tr>
              <td className="py-3 pr-6 text-[var(--foreground)] font-medium">Same-Day Delivery</td>
              <td className="py-3 pr-6 text-[var(--text-secondary)]">Same day (order by 2pm)</td>
              <td className="py-3 text-[var(--text-secondary)]">$19.99 (select cities only)</td>
            </tr>
            <tr>
              <td className="py-3 pr-6 text-[var(--foreground)] font-medium">International</td>
              <td className="py-3 pr-6 text-[var(--text-secondary)]">7–21 business days</td>
              <td className="py-3 text-[var(--text-secondary)]">Calculated at checkout</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderProcessingSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 mb-8">
      <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">Order Processing</h2>
      <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
        Orders placed before 12pm EST on business days are typically processed the same day. Orders placed after 12pm or on weekends are processed the next business day.
      </p>
      <p className="text-[var(--text-secondary)] leading-relaxed">
        You will receive an order confirmation email immediately after placing your order, and a shipping confirmation with tracking details once your order has shipped.
      </p>
    </section>
  );
}

function TrackingSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8">
      <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-4">Tracking Your Order</h2>
      <p className="text-[var(--text-secondary)] leading-relaxed">
        Once your order ships, you will receive a tracking number via email. You can also check the status of your order in the <strong>My Orders</strong> section of your account. Please allow up to 24 hours for tracking information to update after you receive your shipping confirmation.
      </p>
    </section>
  );
}

export default function ShippingPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4">Shipping Information</h1>
        <p className="text-[var(--text-muted)] text-lg mb-12">Everything you need to know about how we deliver to you.</p>

        <ShippingOptionsSection />
        <OrderProcessingSection />
        <TrackingSection />
      </main>
      <Footer />
    </div>
  );
}
