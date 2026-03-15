import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'Careers | The Kiyon Store',
  description: 'Join The Kiyon Store team. Explore open positions and opportunities.',
};

const openings = [
  { title: 'Senior Frontend Engineer', team: 'Engineering', location: 'Remote', type: 'Full-time' },
  { title: 'Backend Engineer (Node.js)', team: 'Engineering', location: 'Remote', type: 'Full-time' },
  { title: 'Product Designer', team: 'Design', location: 'San Francisco, CA', type: 'Full-time' },
  { title: 'Customer Success Manager', team: 'Support', location: 'Remote', type: 'Full-time' },
  { title: 'Growth Marketing Specialist', team: 'Marketing', location: 'Remote', type: 'Full-time' },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-bold text-[#4a3728] mb-4">Careers</h1>
        <p className="text-[#b89a85] text-lg mb-12">Join our team and help build the future of online shopping.</p>

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[#f0d5c0] p-8 mb-8">
          <h2 className="text-2xl font-semibold text-[#4a3728] mb-4">Why Work at Craft &amp; Cozy?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { title: 'Remote-First Culture', desc: 'Work from anywhere in the world with flexible hours.' },
              { title: 'Competitive Pay', desc: 'Top-of-market salaries and equity for everyone.' },
              { title: 'Learning & Growth', desc: 'Annual learning budget and clear career paths.' },
              { title: 'Great Benefits', desc: 'Health, dental, vision, and generous PTO.' },
            ].map(item => (
              <div key={item.title} className="flex gap-3">
                <div className="w-8 h-8 bg-[#fde8d8] rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-[#d4856b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[#4a3728] text-sm">{item.title}</h3>
                  <p className="text-sm text-[#b89a85]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[#f0d5c0] p-8">
          <h2 className="text-2xl font-semibold text-[#4a3728] mb-6">Open Positions</h2>
          <div className="space-y-4">
            {openings.map(job => (
              <div key={job.title} className="flex items-center justify-between p-4 border border-[#f0d5c0] rounded-xl hover:border-[#e8a87c] hover:bg-[#fde8d8]/30 transition-all">
                <div>
                  <h3 className="font-semibold text-[#4a3728]">{job.title}</h3>
                  <p className="text-sm text-[#b89a85]">{job.team} · {job.location} · {job.type}</p>
                </div>
                <Link
                  href="/contact"
                  className="text-sm font-medium text-[#d4856b] hover:text-[#c7735a] whitespace-nowrap"
                >
                  Apply →
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
