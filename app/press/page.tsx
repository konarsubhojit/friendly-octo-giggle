import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Link from 'next/link';

export const metadata = {
  title: 'Press | E-Store',
  description: 'Latest press releases, media mentions, and press resources for E-Store.',
};

const pressReleases = [
  {
    date: 'February 15, 2026',
    title: 'E-Store Reaches 100,000 Customers Milestone',
    summary: 'E-Store today announced it has served over 100,000 customers since its launch, reflecting strong consumer demand for its curated product selection.',
  },
  {
    date: 'January 10, 2026',
    title: 'E-Store Launches Same-Day Delivery in San Francisco and New York',
    summary: 'Customers in select metro areas can now receive orders placed before 2pm on the same day, powered by our new logistics partnership.',
  },
  {
    date: 'December 5, 2025',
    title: 'E-Store Announces Series A Funding Round',
    summary: 'E-Store has closed a $12M Series A round led by Apex Ventures, with participation from leading angel investors in the e-commerce space.',
  },
];

export default function PressPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Press</h1>
        <p className="text-gray-500 text-lg mb-12">News, press releases, and media resources from E-Store.</p>

        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Press Releases</h2>
          <div className="space-y-6">
            {pressReleases.map(pr => (
              <div key={pr.title} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
                <p className="text-sm text-gray-400 mb-1">{pr.date}</p>
                <h3 className="font-bold text-gray-900 mb-2">{pr.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{pr.summary}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Media Inquiries</h2>
          <p className="text-gray-600 mb-4">
            For press inquiries, interview requests, or media kit downloads, please contact our communications team.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-md hover:shadow-lg"
          >
            Contact Press Team
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
