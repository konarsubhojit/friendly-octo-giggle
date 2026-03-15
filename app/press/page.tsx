import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'Press | The Kiyon Store',
  description: 'Latest press releases, media mentions, and press resources for The Kiyon Store.',
};

const pressReleases = [
  {
    date: 'February 15, 2026',
    title: 'Craft & Cozy Reaches 100,000 Customers Milestone',
    summary: 'Craft & Cozy today announced it has served over 100,000 customers since its launch, reflecting strong demand for its handmade flower bouquets, keyrings, hand warmers, mufflers, and scarves.',
  },
  {
    date: 'January 10, 2026',
    title: 'Craft & Cozy Launches Same-Day Delivery in San Francisco and New York',
    summary: 'Customers in select metro areas can now receive orders placed before 2pm on the same day, powered by our new logistics partnership.',
  },
  {
    date: 'December 5, 2025',
    title: 'Craft & Cozy Announces Series A Funding Round',
    summary: 'Craft & Cozy has closed a $12M Series A round led by Apex Ventures, with participation from leading angel investors in the handmade crafts space.',
  },
];

export default function PressPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-bold text-[#4a3728] mb-4">Press</h1>
        <p className="text-[#b89a85] text-lg mb-12">News, press releases, and media resources from Craft &amp; Cozy.</p>

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[#f0d5c0] p-8 mb-8">
          <h2 className="text-2xl font-semibold text-[#4a3728] mb-6">Press Releases</h2>
          <div className="space-y-6">
            {pressReleases.map(pr => (
              <div key={pr.title} className="border-b border-[#f0d5c0] last:border-0 pb-6 last:pb-0">
                <p className="text-sm text-gray-400 mb-1">{pr.date}</p>
                <h3 className="font-bold text-[#4a3728] mb-2">{pr.title}</h3>
                <p className="text-[#7a6355] text-sm leading-relaxed">{pr.summary}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[#f0d5c0] p-8">
          <h2 className="text-xl font-semibold text-[#4a3728] mb-4">Media Inquiries</h2>
          <p className="text-[#7a6355] mb-4">
            For press inquiries, interview requests, or media kit downloads, please contact our communications team.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-gradient-to-r from-[#e8a87c] to-[#d4856b] text-white px-6 py-3 rounded-xl font-semibold hover:from-[#d4856b] hover:to-[#c7735a] transition-all duration-300 shadow-md hover:shadow-lg"
          >
            Contact Press Team
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
