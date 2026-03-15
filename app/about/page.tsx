import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  VineDivider,
  FlowerBullet,
  ScatteredFlowers,
  MushroomAccent,
} from "@/components/ui/DecorativeElements";

export const metadata = {
  title: "About Us | The Kiyon Store",
  description:
    "Learn more about The Kiyon Store, our mission, values, and the team behind our handmade decorations and wearables.",
};

function MissionSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-3xl shadow-warm border border-[var(--border-warm)] p-8 mb-8 animate-fade-in-up animation-delay-100">
      <h2 className="text-2xl font-bold text-[var(--foreground)] mb-3">
        Every stitch tells a story...
      </h2>
      <p className="text-[var(--text-secondary)] leading-relaxed mb-6">
        At The Kiyon Store, our mission is to bring handmade warmth into every
        home. We craft beautiful flower bouquets, keyrings, hand warmers,
        mufflers, and scarves — each made with care and delivered right to your
        door.
      </p>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <FlowerBullet />
          <span className="text-[var(--foreground)] font-semibold">
            Handmade with love
          </span>
        </div>
        <div className="flex items-center gap-3">
          <FlowerBullet />
          <span className="text-[var(--foreground)] font-semibold">Small batch</span>
        </div>
        <div className="flex items-center gap-3">
          <FlowerBullet />
          <span className="text-[var(--foreground)] font-semibold">Eco-friendly</span>
        </div>
        <div className="flex items-center gap-3">
          <FlowerBullet />
          <span className="text-[var(--foreground)] font-semibold">Made for you ♥</span>
        </div>
      </div>
    </section>
  );
}

function StorySection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-3xl shadow-warm border border-[var(--border-warm)] p-8 mb-8 animate-fade-in-up animation-delay-200">
      <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">Our Story</h2>
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
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-3xl shadow-warm border border-[var(--border-warm)] p-8 mb-8 animate-fade-in-up animation-delay-300">
      <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6">Our Values</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="text-center p-4 rounded-2xl bg-[var(--accent-cream)]/50">
          <div className="w-12 h-12 bg-[var(--accent-blush)] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[var(--border-warm)]">
            <svg
              className="w-6 h-6 text-[var(--accent-rose)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="font-bold text-[var(--foreground)] mb-2">Quality First</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Every product is carefully vetted before it reaches our shelves.
          </p>
        </div>
        <div className="text-center p-4 rounded-2xl bg-[var(--accent-cream)]/50">
          <div className="w-12 h-12 bg-[var(--accent-blush)] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[var(--border-warm)]">
            <svg
              className="w-6 h-6 text-[var(--accent-warm)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <h3 className="font-bold text-[var(--foreground)] mb-2">Customer Focus</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Your satisfaction is our top priority, every step of the way.
          </p>
        </div>
        <div className="text-center p-4 rounded-2xl bg-[var(--accent-sage)]/30">
          <div className="w-12 h-12 bg-[var(--accent-sage)] rounded-2xl flex items-center justify-center mx-auto mb-3 border border-[var(--accent-sage)]">
            <svg
              className="w-6 h-6 text-[var(--accent-sage)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 className="font-bold text-[var(--foreground)] mb-2">Fast &amp; Reliable</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Quick delivery and dependable service you can count on.
          </p>
        </div>
      </div>
    </section>
  );
}

function TeamSection() {
  return (
    <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-3xl shadow-warm border border-[var(--border-warm)] p-8 animate-fade-in-up animation-delay-400">
      <h2 className="text-2xl font-bold text-[var(--foreground)] mb-4">The Team</h2>
      <p className="text-[var(--text-secondary)] leading-relaxed">
        We are a diverse team of engineers, designers, and customer experience
        professionals united by one goal: making your shopping experience the
        best it can be. We are always hiring talented people who share our
        passion.
      </p>
    </section>
  );
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 relative">
        <ScatteredFlowers />
        <MushroomAccent className="absolute top-36 right-6 w-12 h-12 opacity-20 hidden sm:block animate-float-slow" />

        <div className="relative z-10">
          <h1 className="text-4xl font-extrabold text-warm-heading mb-2 italic animate-fade-in-up">
            About Us
          </h1>
          <VineDivider className="mb-8" />

          <MissionSection />
          <StorySection />

          <VineDivider />

          <ValuesSection />

          {/* Three-column crafting process section (T042) */}
          <section className="bg-[var(--surface)]/80 backdrop-blur-sm rounded-3xl shadow-warm border border-[var(--border-warm)] p-8 mb-8 animate-fade-in-up animation-delay-300">
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6 text-center">
              How We Craft
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-2xl bg-[var(--accent-cream)]/50 border border-[var(--border-warm)]">
                <div className="w-14 h-14 bg-[var(--accent-blush)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border-warm)]">
                  <span className="text-2xl" aria-hidden="true">
                    🧶
                  </span>
                </div>
                <h3 className="font-bold text-[var(--foreground)] mb-2">Our Story</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Every piece begins with carefully selected yarns and
                  materials, chosen for quality and color harmony.
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-[var(--accent-cream)]/50 border border-[var(--border-warm)]">
                <div className="w-14 h-14 bg-[var(--accent-blush)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border-warm)]">
                  <span className="text-2xl" aria-hidden="true">
                    🌸
                  </span>
                </div>
                <h3 className="font-bold text-[var(--foreground)] mb-2">
                  Made with Love
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Each stitch is placed by hand with patience and care — no
                  machines, no shortcuts, just love.
                </p>
              </div>
              <div className="text-center p-6 rounded-2xl bg-[var(--accent-cream)]/50 border border-[var(--border-warm)]">
                <div className="w-14 h-14 bg-[var(--accent-blush)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border-warm)]">
                  <span className="text-2xl" aria-hidden="true">
                    🎁
                  </span>
                </div>
                <h3 className="font-bold text-[var(--foreground)] mb-2">
                  From Our Hands to Yours
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  Wrapped with care and shipped with a personal touch — because
                  every order deserves to feel special.
                </p>
              </div>
            </div>
          </section>

          <TeamSection />
        </div>
      </main>
      <Footer />
    </div>
  );
}
