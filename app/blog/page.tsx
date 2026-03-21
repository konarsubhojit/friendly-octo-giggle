import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'Blog | The Kiyon Store',
  description: 'Latest news, tips, and stories from The Kiyon Store team.',
};

const posts = [
  {
    title: 'Top 10 Shopping Tips to Save More This Season',
    date: 'February 20, 2026',
    category: 'Tips & Tricks',
    excerpt: 'Discover smart strategies for getting the best deals and maximizing your savings on every order.',
  },
  {
    title: 'Introducing Same-Day Delivery in Select Cities',
    date: 'February 10, 2026',
    category: 'News',
    excerpt: 'We are excited to announce same-day delivery is now available for orders placed before 2pm in select metro areas.',
  },
  {
    title: 'How We Keep Your Data Safe',
    date: 'January 28, 2026',
    category: 'Security',
    excerpt: 'A deep dive into the security practices we use to protect your personal information and payment details.',
  },
  {
    title: 'Behind the Scenes: How We Pick Our Products',
    date: 'January 15, 2026',
    category: 'Our Story',
    excerpt: 'Our product curation team shares the rigorous process we use to ensure every item meets our quality standards.',
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <h1 className="text-4xl font-bold text-[var(--foreground)] mb-4">Blog</h1>
        <p className="text-[var(--text-muted)] text-lg mb-12">News, tips, and stories from the Craft &amp; Cozy team.</p>

        <div className="space-y-6">
          {posts.map(post => (
            <article key={post.title} className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 hover:shadow-md transition-shadow">
              <span className="inline-block text-xs font-semibold text-[var(--foreground)] bg-[var(--accent-blush)] px-3 py-1 rounded-full mb-3">
                {post.category}
              </span>
              <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">{post.title}</h2>
              <p className="text-sm text-[var(--text-muted)] mb-3">{post.date}</p>
              <p className="text-[var(--text-secondary)] leading-relaxed">{post.excerpt}</p>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
