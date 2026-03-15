import Link from 'next/link';
import { ScatteredFlowers, VineDivider, FlowerBullet } from '@/components/ui/DecorativeElements';

export default function Hero() {
  return (
    <section className="relative pt-28 pb-16 overflow-hidden">
      <ScatteredFlowers />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Main hero card — cottage-core illustration-panel style */}
        <div className="bg-white/70 backdrop-blur-sm rounded-3xl border border-[#f0d5c0] shadow-warm-lg p-8 sm:p-12 mb-10 animate-fade-in-up">
          <div className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-4 text-warm-heading animate-fade-in-up" style={{ fontStyle: 'italic' }}>
              Handmade<br />With Love
            </h1>
            <p className="text-sm sm:text-base text-[#b89a85] tracking-widest uppercase mb-6 animate-fade-in-up animation-delay-100">
              Crochet · Flowers · Bags · Accessories
            </p>
            <p className="text-base sm:text-lg text-[#7a6355] mb-8 max-w-lg leading-relaxed animate-fade-in-up animation-delay-200">
              Discover beautiful handmade decorations and cozy wearables — flower bouquets, keyrings, hand warmers, mufflers, scarves, and more.
            </p>
            <Link
              href="#products"
              scroll
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-[#e8a87c] to-[#d4856b] text-white rounded-full font-semibold hover:from-[#d4856b] hover:to-[#c97b5e] transition-all duration-300 shadow-warm hover:shadow-warm-lg hover:scale-105 animate-fade-in-up animation-delay-300"
            >
              Explore Shop <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <VineDivider />

        {/* Feature badges — cottage-core style with flower bullets */}
        <div className="flex flex-wrap gap-5 justify-center animate-fade-in-up animation-delay-400">
          <div className="flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-warm border border-[#f0d5c0] animate-float-gentle">
            <FlowerBullet className="w-4 h-4" />
            <span className="text-sm font-semibold text-[#7a6355]">Handmade with love</span>
          </div>
          <div className="flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-warm border border-[#f0d5c0] animate-float-gentle animation-delay-200">
            <FlowerBullet className="w-4 h-4" />
            <span className="text-sm font-semibold text-[#7a6355]">Small batch</span>
          </div>
          <div className="flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-warm border border-[#f0d5c0] animate-float-gentle animation-delay-300">
            <FlowerBullet className="w-4 h-4" />
            <span className="text-sm font-semibold text-[#7a6355]">Free shipping</span>
          </div>
          <div className="flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-warm border border-[#f0d5c0] animate-float-gentle animation-delay-400">
            <FlowerBullet className="w-4 h-4" />
            <span className="text-sm font-semibold text-[#7a6355]">Made for you ♥</span>
          </div>
        </div>
      </div>

      {/* Decorative gradient orbs — warm palette */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-[#f8c8a8] to-[#fde8d8] rounded-full blur-3xl opacity-30 animate-float-slow" aria-hidden="true"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-[#b8c9a3] to-[#d4e4c4] rounded-full blur-3xl opacity-20 animate-float-slow animation-delay-300" aria-hidden="true"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-[#fde8d8] to-[#f8c8a8] rounded-full blur-3xl opacity-15" aria-hidden="true"></div>
    </section>
  );
}
