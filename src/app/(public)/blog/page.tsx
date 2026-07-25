import Footer from '@/components/layout/Footer'
import { STORE_NAME, withStoreName } from '@/lib/constants/store'

export const revalidate = 3600

export const metadata = {
  title: withStoreName('Blog'),
  description: `Latest news, tips, and stories from the ${STORE_NAME} team.`,
}

const posts = [
  {
    title: 'How to Care for Crochet Flowers at Home',
    date: 'February 20, 2026',
    category: 'Care Tips',
    excerpt:
      'A few simple storage and display tips can help your handmade blooms stay gift-ready for longer.',
  },
  {
    title: 'What to Expect After You Place an Order',
    date: 'February 10, 2026',
    category: 'Shopping Guide',
    excerpt:
      'From confirmation emails to shipping updates, here is how the storefront keeps you informed after checkout.',
  },
  {
    title: 'Thoughtful Gift Pairings for Cozy Celebrations',
    date: 'January 28, 2026',
    category: 'Gift Guide',
    excerpt:
      'Pair bouquets, scarves, and keychains into easy gift bundles for birthdays, thank-yous, and seasonal surprises.',
  },
  {
    title: 'Behind the Scenes: How We Pick Our Products',
    date: 'January 15, 2026',
    category: 'Our Story',
    excerpt:
      'Our product curation team shares the rigorous process we use to ensure every item meets our quality standards.',
  },
]

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4">
          Blog
        </h1>
        <p className="text-[var(--text-muted)] text-lg mb-12">
          News, tips, and stories from the {STORE_NAME} team.
        </p>

        <div className="space-y-6">
          {posts.map((post) => (
            <article
              key={post.title}
              className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 hover:shadow-md transition-shadow"
            >
              <span className="inline-block text-xs font-semibold text-[var(--foreground)] bg-[var(--accent-blush)] px-3 py-1 rounded-full mb-3">
                {post.category}
              </span>
              <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">
                {post.title}
              </h2>
              <p className="text-sm text-[var(--text-muted)] mb-3">
                {post.date}
              </p>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {post.excerpt}
              </p>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
