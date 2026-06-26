import Footer from '@/components/layout/Footer'
import Link from '@/components/ui/LocaleLink'
import { STORE_NAME, withStoreName } from '@/lib/constants/store'

export const revalidate = 3600

export const metadata = {
  title: withStoreName('Press'),
  description: `Latest press releases, media mentions, and press resources for ${STORE_NAME}.`,
}

const pressReleases = [
  {
    date: 'February 15, 2026',
    title: 'Editorial Photos and Product Notes Updated for Spring',
    summary:
      'We refreshed our press-ready product photos and collection notes so editors can reference the latest handmade bouquets, scarves, and accessories accurately.',
  },
  {
    date: 'January 10, 2026',
    title: 'Customer Support Resources Consolidated in One Place',
    summary:
      'Our public Help, Returns, and Contact pages now share the same order-policy language to make post-purchase guidance easier to verify.',
  },
  {
    date: 'December 5, 2025',
    title: 'Gift Guide Talking Points Prepared for Holiday Coverage',
    summary:
      'We prepared an updated overview of gift-friendly categories, handmade materials, and care tips for seasonal media mentions.',
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
          News, press releases, and media resources from {STORE_NAME}.
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
