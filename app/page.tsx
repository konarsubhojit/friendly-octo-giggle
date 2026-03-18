import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/sections/Hero";
import { FloralBorder } from "@/components/ui/DecorativeElements";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Kiyon Store | Handcrafted with Love",
  description:
    "Handmade crochet flowers, bags, keychains, and accessories — crafted with love, delivered to your door.",
};

export default async function Home() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <Hero />

      <FloralBorder />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <section className="rounded-3xl border border-[var(--border-warm)] bg-[var(--surface)]/90 shadow-warm p-8 sm:p-12">
          <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-[var(--text-muted)] mb-3">
            Find Your Next Favorite
          </p>
          <h2 className="font-cursive text-4xl sm:text-5xl font-bold text-[var(--foreground)] mb-4">
            Browse Everything in Shop
          </h2>
          <p className="text-[var(--text-secondary)] max-w-2xl mb-8 leading-relaxed">
            We moved product browsing to a dedicated Shop page with search and
            category filters, so you can discover handmade pieces faster.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-[var(--btn-primary)] text-white font-bold hover:bg-[var(--btn-primary-hover)] transition-all duration-300 shadow-warm hover:shadow-warm-lg"
            >
              Go to Shop <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-full border border-[var(--border-warm)] bg-[var(--accent-cream)] text-[var(--foreground)] font-semibold hover:border-[var(--accent-rose)] hover:text-[var(--accent-rose)] transition-colors duration-200"
            >
              View Product Catalog
            </Link>
          </div>
        </section>
      </main>


      <Footer />
    </div>
  );
}
