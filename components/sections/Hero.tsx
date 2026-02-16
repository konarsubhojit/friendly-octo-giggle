import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
          Welcome to E-Store
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Discover amazing products at unbeatable prices. Shop with confidence and enjoy premium quality.
        </p>
        <div className="flex gap-4 justify-center mb-12">
          <Link href="#products" scroll={true} className="px-8 py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
            Shop Now
          </Link>
          <Link href="/products" className="px-8 py-4 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-300 hover:scale-105">
            Learn More
          </Link>
        </div>
        {/* Floating badges */}
        <div className="flex flex-wrap gap-4 justify-center">
          <div className="px-4 py-2 bg-white rounded-full shadow-lg text-sm font-semibold text-gray-700">
            ✓ Free Shipping
          </div>
          <div className="px-4 py-2 bg-white rounded-full shadow-lg text-sm font-semibold text-gray-700">
            ✓ 30-Day Returns
          </div>
          <div className="px-4 py-2 bg-white rounded-full shadow-lg text-sm font-semibold text-gray-700">
            ✓ Premium Quality
          </div>
        </div>
      </div>
      {/* Decorative gradient orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-3xl opacity-20" aria-hidden="true"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20" aria-hidden="true"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-pink-400 to-blue-400 rounded-full blur-3xl opacity-10" aria-hidden="true"></div>
    </section>
  );
}
