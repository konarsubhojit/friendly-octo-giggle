import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h1 className="text-5xl sm:text-6xl font-extrabold mb-6 text-warm-heading animate-fade-in-up">
          Handcrafted with Love
        </h1>
        <p className="text-lg sm:text-xl text-[#7a6355] mb-4 max-w-2xl mx-auto animate-fade-in-up animation-delay-100">
          Discover beautiful handmade decorations and cozy wearables — flower bouquets, keyrings, hand warmers, mufflers, scarves, and more. Each piece crafted with care, just for you.
        </p>
        <p className="text-sm text-[#b89a85] mb-8 tracking-widest uppercase animate-fade-in animation-delay-200" aria-hidden="true">
          🌸 Crochet · Flowers · Bags · Accessories 🌸
        </p>
        <div className="flex gap-4 justify-center mb-12 animate-fade-in-up animation-delay-300">
          <Link href="#products" scroll className="px-8 py-4 bg-gradient-to-r from-[#e8a87c] to-[#d4856b] text-white rounded-full font-semibold hover:from-[#d4856b] hover:to-[#c97b5e] transition-all duration-300 shadow-warm hover:shadow-warm-lg hover:scale-105">
            Explore Shop →
          </Link>
          <Link href="#products" scroll className="px-8 py-4 border-2 border-[#e8a87c] text-[#d4856b] rounded-full font-semibold hover:bg-[#fef0e6] transition-all duration-300 hover:scale-105">
            Bestsellers
          </Link>
        </div>
        {/* Floating badges */}
        <div className="flex flex-wrap gap-4 justify-center animate-fade-in-up animation-delay-400">
          <div className="px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-warm text-sm font-semibold text-[#7a6355] border border-[#f0d5c0] animate-float-gentle">
            🌿 Free Shipping
          </div>
          <div className="px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-warm text-sm font-semibold text-[#7a6355] border border-[#f0d5c0] animate-float-gentle animation-delay-200">
            🧶 Custom Orders Welcome
          </div>
          <div className="px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-warm text-sm font-semibold text-[#7a6355] border border-[#f0d5c0] animate-float-gentle animation-delay-400">
            💛 Handmade Quality
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
