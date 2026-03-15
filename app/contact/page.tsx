import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ContactForm from './ContactForm';

export const metadata = {
  title: 'Contact Us | The Kiyon Store',
  description: 'Get in touch with The Kiyon Store support team. We\'d love to hear from you.',
};

function ContactInfoSection() {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-6">
        <div className="w-10 h-10 bg-[#fde8d8] rounded-xl flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-[#d4856b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="font-semibold text-[var(--foreground)] mb-1">Email</h3>
        <p className="text-sm text-[var(--text-muted)]">support@estore.example.com</p>
      </div>
      <div className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-6">
        <div className="w-10 h-10 bg-[#fde8d8] rounded-xl flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-[#e8a87c]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </div>
        <h3 className="font-semibold text-[var(--foreground)] mb-1">Phone</h3>
        <p className="text-sm text-[var(--text-muted)]">+1 (800) 123-4567</p>
        <p className="text-xs text-gray-400 mt-1">Mon–Fri, 9am–6pm EST</p>
      </div>
      <div className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-6">
        <div className="w-10 h-10 bg-[#d4e4c4] rounded-xl flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-[#7a9e5e]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="font-semibold text-[var(--foreground)] mb-1">Address</h3>
        <p className="text-sm text-[var(--text-muted)]">123 Commerce Street<br />San Francisco, CA 94105</p>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4">Contact Us</h1>
        <p className="text-[var(--text-muted)] text-lg mb-12">We&apos;d love to hear from you. Send us a message and we&apos;ll get back to you as soon as possible.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ContactInfoSection />

          {/* Contact Form */}
          <div className="md:col-span-2 bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8">
            <ContactForm />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
