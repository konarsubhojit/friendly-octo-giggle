import Link from "next/link";
import {
  ScatteredFlowers,
  VineDivider,
  FlowerBullet,
} from "@/components/ui/DecorativeElements";

export default function Hero() {
  return (
    <section className="relative pt-28 pb-20 overflow-hidden bg-hero-gradient">
      <ScatteredFlowers />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* ── Main hero card ───────────────────────────────────────── */}
        <div className="relative rounded-3xl border border-[var(--border-warm)] shadow-warm-lg mb-12 animate-fade-in-up overflow-hidden glass-card">
          {/* Decorative corner accent */}
          <div className="absolute top-0 right-0 w-48 h-48 opacity-10 pointer-events-none" aria-hidden="true">
            <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
              <circle cx="160" cy="40" r="60" fill="var(--accent-rose)" />
              <circle cx="100" cy="100" r="80" fill="var(--accent-peach)" />
            </svg>
          </div>

          <div className="p-8 sm:p-12 lg:p-16">
            <div className="max-w-2xl">
              {/* Eyebrow tag */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--accent-blush)] border border-[var(--border-warm)] mb-6 animate-fade-in">
                <FlowerBullet className="w-3.5 h-3.5" />
                <span className="text-xs font-bold text-[var(--accent-rose)] uppercase tracking-widest">
                  Handcrafted with Love
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5 animate-fade-in-up">
                <span className="text-[var(--foreground)] italic block">
                  Beautiful Things,
                </span>
                <span className="text-warm-heading block">
                  Made by Hand
                </span>
              </h1>

              <p className="text-base sm:text-lg text-[var(--text-secondary)] mb-8 max-w-lg leading-relaxed animate-fade-in-up animation-delay-100">
                Discover our collection of crocheted flowers, hair accessories,
                keyrings, scarves, and cozy wearables — each piece lovingly
                crafted, one stitch at a time.
              </p>

              <div className="flex flex-wrap gap-4 animate-fade-in-up animation-delay-200">
                <Link
                  href="#products"
                  scroll
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white rounded-full font-bold hover:opacity-90 transition-all duration-300 shadow-warm hover:shadow-warm-lg hover:scale-105 focus-warm"
                >
                  Shop Now <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--surface)]/80 text-[var(--text-secondary)] rounded-full font-bold border border-[var(--border-warm)] hover:bg-[var(--accent-blush)] hover:border-[var(--accent-warm)] transition-all duration-300 focus-warm"
                >
                  Our Story
                </Link>
              </div>

              {/* Mini stats */}
              <div className="flex flex-wrap gap-6 mt-10 pt-8 border-t border-[var(--border-warm)] animate-fade-in-up animation-delay-300">
                {[
                  { num: "100%", label: "Handmade" },
                  { num: "50+", label: "Products" },
                  { num: "❤️", label: "Made with love" },
                ].map(({ num, label }) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-2xl font-bold font-display text-[var(--accent-rose)]">
                      {num}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <VineDivider />

        {/* ── Feature badges ───────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4 justify-center mt-6 animate-fade-in-up animation-delay-400">
          {[
            { icon: "🌸", text: "Crochet flowers" },
            { icon: "🎀", text: "Hair accessories" },
            { icon: "🧶", text: "Handmade knitwear" },
            { icon: "🚚", text: "Free shipping" },
          ].map(({ icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-[var(--surface)]/80 backdrop-blur-sm rounded-full shadow-warm border border-[var(--border-warm)] animate-float-gentle"
            >
              <span className="text-base" aria-hidden="true">{icon}</span>
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                {text}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Decorative gradient orbs ─────────────────────────────── */}
      <div
        className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-[var(--accent-blush)] to-[var(--accent-peach)] rounded-full blur-3xl opacity-25 animate-float-slow pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 right-10 w-96 h-96 bg-gradient-to-r from-[var(--accent-cream)] to-[var(--accent-blush)] rounded-full blur-3xl opacity-20 animate-float-slow animation-delay-300 pointer-events-none"
        aria-hidden="true"
      />
    </section>
  );
}
