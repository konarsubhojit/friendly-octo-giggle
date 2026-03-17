import Link from "next/link";
import {
  ScatteredFlowers,
  VineDivider,
} from "@/components/ui/DecorativeElements";

const STATS = [
  { num: "100%", label: "Handmade", decorative: false },
  { num: "50+", label: "Products", decorative: false },
  { num: "❤️", label: "Made with love", decorative: true },
] as const;

const FEATURE_BADGES = [
  { icon: "🌸", text: "Crochet flowers" },
  { icon: "🎀", text: "Hair accessories" },
  { icon: "🧶", text: "Handmade knitwear" },
  { icon: "🚚", text: "Free shipping" },
] as const;

const HeroTextColumn = () => {
  return (
    <div className="flex-1 max-w-xl animate-fade-in-up">
      <h1 id="hero-heading" className="font-cursive text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight text-[var(--foreground)] mb-6">
        Handmade With Love
      </h1>
      <p className="text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase text-[var(--text-muted)] mb-8">
        Crochet&nbsp; •&nbsp; Flowers&nbsp; •&nbsp; Bags&nbsp; •&nbsp; Accessories
      </p>
      <p className="text-base sm:text-lg text-[var(--text-secondary)] mb-8 leading-relaxed animate-fade-in-up animation-delay-100">
        Discover our collection of crocheted flowers, hair accessories,
        keyrings, scarves, and cozy wearables — each piece lovingly
        crafted, one stitch at a time.
      </p>
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--btn-primary)] text-white rounded-full font-bold hover:bg-[var(--btn-primary-hover)] transition-all duration-300 shadow-warm hover:shadow-warm-lg hover:scale-105 focus-warm animate-fade-in-up animation-delay-200"
      >
        Explore Shop <span aria-hidden="true">→</span>
      </Link>
      <div className="flex flex-wrap gap-6 mt-10 pt-8 border-t border-[var(--border-warm)] animate-fade-in-up animation-delay-300">
        {STATS.map(({ num, label, decorative }) => (
          <div key={label} className="flex flex-col">
            <span className="text-2xl font-bold font-display text-[var(--accent-rose)]" aria-hidden={decorative || undefined}>{num}</span>
            <span className="text-xs text-[var(--text-muted)] font-semibold uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const HeroIllustration = () => {
  return (
    <div className="flex-1 w-full max-w-lg lg:max-w-none animate-fade-in-up animation-delay-200">
      <div
        className="w-full min-h-[400px] rounded-[2rem] bg-stone-200 border border-[var(--border-warm)] shadow-warm-lg flex items-center justify-center"
        role="img"
        aria-label="Illustration placeholder: girl crocheting by a window"
      >
        <div className="text-center p-8">
          <span className="text-6xl block mb-4" aria-hidden="true">🧶</span>
          <p className="text-sm text-[var(--foreground)] font-medium">
            Illustration: Girl crocheting by a window
          </p>
        </div>
      </div>
    </div>
  );
}

const FeatureBadges = () => {
  return (
    <div className="flex flex-wrap gap-4 justify-center mt-6 animate-fade-in-up animation-delay-400">
      {FEATURE_BADGES.map(({ icon, text }) => (
        <div
          key={text}
          className="flex items-center gap-2.5 px-5 py-2.5 bg-[var(--surface)]/80 backdrop-blur-sm rounded-full shadow-warm border border-[var(--border-warm)] animate-float-gentle"
        >
          <span className="text-base" aria-hidden="true">{icon}</span>
          <span className="text-sm font-semibold text-[var(--text-secondary)]">{text}</span>
        </div>
      ))}
    </div>
  );
}

const Hero = () => (
  <section
    className="relative pt-28 pb-20 overflow-hidden bg-hero-gradient"
    aria-labelledby="hero-heading"
  >
    <ScatteredFlowers />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        <HeroTextColumn />
        <HeroIllustration />
      </div>
      <VineDivider className="mt-12" />
      <FeatureBadges />
    </div>
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

export default Hero;
