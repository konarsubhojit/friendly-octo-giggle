import Footer from '@/components/layout/Footer'
import Link from 'next/link'

export const revalidate = 3600

export const metadata = {
  title: 'Press | The Kiyon Store',
  description:
    'Latest press releases, media mentions, and press resources for The Kiyon Store.',
}

const pressReleases = [
  {
    date: 'February 15, 2026',
    title: 'Craft & Cozy Reaches 100,000 Customers Milestone',
    summary:
      'Craft & Cozy today announced it has served over 100,000 customers since its launch, reflecting strong demand for its handmade flower bouquets, keyrings, hand warmers, mufflers, and scarves.',
  },
  {
    date: 'January 10, 2026',
    title:
      'Craft & Cozy Launches Same-Day Delivery in San Francisco and New York',
    summary:
      'Customers in select metro areas can now receive orders placed before 2pm on the same day, powered by our new logistics partnership.',
  },
  {
    date: 'December 5, 2025',
    title: 'Craft & Cozy Announces Series A Funding Round',
    summary:
      'Craft & Cozy has closed a $12M Series A round led by Apex Ventures, with participation from leading angel investors in the handmade crafts space.',
  },
]

export default function PressPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4">
          Press
        </h1>
        <p className="text-[var(--text-muted)] text-lg mb-12">
          News, press releases, and media resources from Craft &amp; Cozy.
        </p>

        <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 mb-8">
          <h2 className="text-2xl font-semibold text-[var(--foreground)] mb-6">
            Press Releases
          </h2>
          <div className="space-y-6">
            {pressReleases.map((pr) => (
              <div
                key={pr.title}
                className="border-b border-[var(--border-warm)] last:border-0 pb-6 last:pb-0"
              >
                <p className="text-sm text-[var(--text-muted)] mb-1">
                  {pr.date}
                </p>
                <h3 className="font-bold text-[var(--foreground)] mb-2">
                  {pr.title}
                </h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                  {pr.summary}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8">
          <h2 className="text-xl font-semibold text-[var(--foreground)] mb-4">
            Media Inquiries
          </h2>
          <p className="text-[var(--text-secondary)] mb-4">
            For press inquiries, interview requests, or media kit downloads,
            please contact our communications team.
          </p>
          <Link
            href="/contact"
            className="inline-block bg-[var(--btn-primary)] bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white px-6 py-3 rounded-xl font-semibold hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] transition-all duration-300 shadow-md hover:shadow-lg"
          >
            Contact Press Team
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  )
}
