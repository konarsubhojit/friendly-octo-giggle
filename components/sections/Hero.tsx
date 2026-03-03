import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-rose-500 via-pink-500 to-purple-600 bg-clip-text text-transparent">
          Handcrafted with Love
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Discover beautiful handmade decorations and cozy wearables — flower bouquets, keyrings, hand warmers, mufflers, scarves, and more. Each piece crafted with care, just for you.
        </p>
        <div className="flex gap-4 justify-center mb-12">
          <Link href="#products" scroll className="px-8 py-4 bg-rose-500 text-white rounded-lg font-semibold hover:bg-rose-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
            Shop Now
          </Link>
          <Link href="#trending" scroll className="px-8 py-4 border-2 border-rose-500 text-rose-500 rounded-lg font-semibold hover:bg-rose-50 transition-all duration-300 hover:scale-105">
            Trending Items
          </Link>
        </div>
        {/* Floating badges */}
        <div className="flex flex-wrap gap-4 justify-center">
          <div className="px-4 py-2 bg-white rounded-full shadow-lg text-sm font-semibold text-gray-700">
            ✓ Free Shipping
          </div>
          <div className="px-4 py-2 bg-white rounded-full shadow-lg text-sm font-semibold text-gray-700">
            ✓ Custom Orders Welcome
          </div>
          <div className="px-4 py-2 bg-white rounded-full shadow-lg text-sm font-semibold text-gray-700">
            ✓ Handmade Quality
          </div>
        </div>
      </div>
      {/* Decorative gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-rose-300 to-pink-300 rounded-full blur-3xl opacity-20" aria-hidden="true"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full blur-3xl opacity-20" aria-hidden="true"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-pink-300 to-rose-300 rounded-full blur-3xl opacity-10" aria-hidden="true"></div>
    </section>
  );
}
