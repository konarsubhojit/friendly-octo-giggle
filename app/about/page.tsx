import Footer from "@/components/layout/Footer";
import {
  VineDivider,
  ScatteredFlowers,
  MushroomAccent,
} from "@/components/ui/DecorativeElements";

export const metadata = {
  title: "About Us | The Kiyon Store",
  description:
    "Learn more about The Kiyon Store, our mission, values, and the team behind our handmade decorations and wearables.",
};

const FEATURES = [
  { emoji: "🧶", text: "Handmade with love" },
  { emoji: "🌿", text: "Small batch" },
  { emoji: "♻️", text: "Eco-friendly" },
  { emoji: "💝", text: "Made for you" },
] as const;

function MissionSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-[2rem] shadow-warm border border-[var(--border-warm)] p-8 mb-8 animate-fade-in-up animation-delay-100">
      <h2 className="text-2xl font-bold text-[var(--foreground)] mb-3">
        Our Story
      </h2>
      <p className="text-[var(--text-secondary)] leading-relaxed mb-4">
        Founded in 2024, The Kiyon Store started as a small team passionate
        about handmade decorations and cozy wearables. Today, we serve thousands
        of customers who love our flower bouquets, keyrings, hand warmers,
        mufflers, and scarves — all crafted with heart.
      </p>
      <p className="text-[var(--text-secondary)] leading-relaxed">
        Built on a modern technology stack including Next.js, PostgreSQL, and
        Redis, our platform is designed for speed, reliability, and scale — so
        you can shop with confidence anytime, anywhere.
      </p>
    </section>
  );
}

function ValuesSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-[2rem] shadow-warm border border-[var(--border-warm)] p-8 mb-8 animate-fade-in-up animation-delay-300">
      <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">Our Values</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="text-center p-4 rounded-2xl bg-[var(--accent-cream)]/50">
          <div className="w-12 h-12 bg-[var(--accent-blush)] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[var(--border-warm)]">
            <svg className="w-6 h-6 text-[var(--accent-rose)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-[var(--foreground)] mb-2">Quality First</h3>
          <p className="text-sm text-[var(--text-secondary)]">Every product is carefully vetted before it reaches our shelves.</p>
        </div>
        <div className="text-center p-4 rounded-2xl bg-[var(--accent-cream)]/50">
          <div className="w-12 h-12 bg-[var(--accent-blush)] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[var(--border-warm)]">
            <svg className="w-6 h-6 text-[var(--accent-warm)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="font-bold text-[var(--foreground)] mb-2">Customer Focus</h3>
          <p className="text-sm text-[var(--text-secondary)]">Your satisfaction is our top priority, every step of the way.</p>
        </div>
        <div className="text-center p-4 rounded-2xl bg-[var(--accent-sage)]/20">
          <div className="w-12 h-12 bg-[var(--accent-sage)]/30 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[var(--accent-sage)]/40">
            <svg className="w-6 h-6 text-[var(--accent-sage)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="font-bold text-[var(--foreground)] mb-2">Fast &amp; Reliable</h3>
          <p className="text-sm text-[var(--text-secondary)]">Quick delivery and dependable service you can count on.</p>
        </div>
      </div>
    </section>
  );
}

interface CraftStep {
  emoji: string;
  title: string;
  description: string;
}

const CRAFT_STEPS: CraftStep[] = [
  { emoji: "🧶", title: "Our Story", description: "Every piece begins with carefully selected yarns and materials, chosen for quality and color harmony." },
  { emoji: "🌸", title: "Made with Love", description: "Each stitch is placed by hand with patience and care — no machines, no shortcuts, just love." },
  { emoji: "🎁", title: "From Our Hands to Yours", description: "Wrapped with care and shipped with a personal touch — because every order deserves to feel special." },
];

function CraftStepCard({ emoji, title, description }: CraftStep) {
  return (
    <div className="text-center p-6 rounded-2xl bg-[var(--accent-cream)]/50 border border-[var(--border-warm)]">
      <div className="w-14 h-14 bg-[var(--accent-blush)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border-warm)]">
        <span className="text-2xl" aria-hidden="true">{emoji}</span>
      </div>
      <h3 className="font-bold text-[var(--foreground)] mb-2">{title}</h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{description}</p>
    </div>
  );
}

function CraftingProcessSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-[2rem] shadow-warm border border-[var(--border-warm)] p-8 mb-8 animate-fade-in-up animation-delay-300">
      <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6 text-center">
        How We Craft
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {CRAFT_STEPS.map((step) => (
          <CraftStepCard key={step.title} {...step} />
        ))}
      </div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 relative">
        <ScatteredFlowers />
        <MushroomAccent className="absolute top-36 right-6 w-12 h-12 opacity-20 hidden sm:block animate-float-slow" />

        <div className="relative z-10">
          {/* ── Split hero layout ──────────────────────────────── */}
          <div className="flex flex-col lg:flex-row items-start gap-10 lg:gap-16 mb-12">
            {/* Left column — text + features */}
            <div className="flex-1 min-w-0">
              <h1 className="font-cursive text-4xl sm:text-5xl font-bold text-[var(--foreground)] mb-3 animate-fade-in-up">
                About Us
              </h1>
              <p className="text-lg text-[var(--text-secondary)] mb-8 leading-relaxed animate-fade-in-up animation-delay-100">
                Every stitch tells a story — we create handmade pieces that bring
                warmth and joy to your everyday life.
              </p>

              {/* Feature list */}
              <ul className="flex flex-col gap-4 animate-fade-in-up animation-delay-200">
                {FEATURES.map(({ emoji, text }) => (
                  <li key={text} className="flex items-center gap-4">
                    <span className="w-10 h-10 rounded-xl bg-[var(--accent-blush)] border border-[var(--border-warm)] flex items-center justify-center text-lg flex-shrink-0" aria-hidden="true">
                      {emoji}
                    </span>
                    <span className="text-[var(--foreground)] font-semibold">{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right column — illustration placeholder */}
            <div className="flex-1 w-full animate-fade-in-up animation-delay-200">
              <div className="w-full min-h-[400px] rounded-[2rem] bg-stone-200 border border-[var(--border-warm)] shadow-warm-lg flex items-center justify-center">
                <div className="text-center p-8">
                  <span className="text-6xl block mb-4" aria-hidden="true">🐰</span>
                  <p className="text-sm text-[var(--text-muted)] font-medium">
                    Illustration: Bunny with yarn
                  </p>
                </div>
              </div>
            </div>
          </div>

          <VineDivider className="mb-8" />

          <MissionSection />
          <ValuesSection />
          <CraftingProcessSection />
        </div>
      </main>
      <Footer />
    </div>
  );
}
