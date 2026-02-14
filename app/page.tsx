import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function getProducts(): Promise<Product[]> {
  try {
    // In production, use absolute URL or environment variable
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/products`, {
      cache: 'no-store',
    });
    
    if (!res.ok) {
      console.error('Failed to fetch products');
      return [];
    }
    
    const data = await res.json();
    return data.data?.products || data.products || [];
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

export default async function Home() {
  const products = await getProducts();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold flex items-center gap-2 transition-all duration-300">
              <svg className="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">E-Store</span>
            </Link>
            <nav className="hidden md:flex gap-8 items-center">
              <Link href="/" className="text-gray-700 hover:text-blue-600 transition-all duration-300">Home</Link>
              <Link href="/products" className="text-gray-700 hover:text-blue-600 transition-all duration-300">Products</Link>
              <Link href="/about" className="text-gray-700 hover:text-blue-600 transition-all duration-300">About</Link>
              <Link href="/contact" className="text-gray-700 hover:text-blue-600 transition-all duration-300">Contact</Link>
            </nav>
            <div className="flex items-center gap-4">
              {/* TODO: Implement shopping cart functionality */}
              <button className="text-gray-700 hover:text-blue-600 transition-all duration-300" aria-label="Shopping cart">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </button>
              <Link
                href="/admin"
                className="text-sm text-gray-600 hover:text-blue-600 transition-all duration-300"
              >
                Admin Panel
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      {/* pt-32 accounts for fixed header: py-4 (1rem top + 1rem bottom = 2rem) + content (~2rem) + extra spacing = ~4rem (64px) base + 8rem (128px) total spacing */}
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
            <Link href="/about" className="px-8 py-4 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-300 hover:scale-105">
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
        <div className="absolute top-20 left-10 w-72 h-72 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-r from-pink-400 to-blue-400 rounded-full blur-3xl opacity-10"></div>
      </section>

      {/* Products Section */}
      <main id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Featured Products
        </h2>

        {products.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">
              No items found
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100 group hover:shadow-2xl hover:scale-105 hover:-translate-y-1 hover:border-blue-200 transition-all duration-300"
              >
                <div className="relative h-64 w-full">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                </div>
                <div className="p-4">
                  {/* Using div instead of h2 to avoid nested interactive elements (Link > h2) which violates HTML semantics and accessibility guidelines */}
                  <div className="text-xl font-semibold text-gray-900 mb-2">
                    {product.name}
                  </div>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-2xl font-bold text-blue-600">
                      ${product.price.toFixed(2)}
                    </span>
                    <span className="text-sm">
                      {product.stock > 0 ? (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">In Stock ({product.stock})</span>
                      ) : (
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full font-semibold">Out of Stock</span>
                      )}
                    </span>
                  </div>
                  <div className="mt-2">
                    <span className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full px-3 py-1 text-sm font-semibold">
                      {product.category}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
            {/* Company */}
            <div>
              <h4 className="text-lg font-bold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-gray-400 hover:text-white transition-all duration-300">About Us</Link></li>
                <li><Link href="/careers" className="text-gray-400 hover:text-white transition-all duration-300">Careers</Link></li>
                <li><Link href="/press" className="text-gray-400 hover:text-white transition-all duration-300">Press</Link></li>
                <li><Link href="/blog" className="text-gray-400 hover:text-white transition-all duration-300">Blog</Link></li>
              </ul>
            </div>
            {/* Products */}
            <div>
              <h4 className="text-lg font-bold mb-4">Products</h4>
              <ul className="space-y-2">
                <li><Link href="/products" className="text-gray-400 hover:text-white transition-all duration-300">All Products</Link></li>
                <li><Link href="/new" className="text-gray-400 hover:text-white transition-all duration-300">New Arrivals</Link></li>
                <li><Link href="/bestsellers" className="text-gray-400 hover:text-white transition-all duration-300">Best Sellers</Link></li>
                <li><Link href="/deals" className="text-gray-400 hover:text-white transition-all duration-300">Deals</Link></li>
              </ul>
            </div>
            {/* Support */}
            <div>
              <h4 className="text-lg font-bold mb-4">Support</h4>
              <ul className="space-y-2">
                <li><Link href="/help" className="text-gray-400 hover:text-white transition-all duration-300">Help Center</Link></li>
                <li><Link href="/shipping" className="text-gray-400 hover:text-white transition-all duration-300">Shipping Info</Link></li>
                <li><Link href="/returns" className="text-gray-400 hover:text-white transition-all duration-300">Returns</Link></li>
                <li><Link href="/contact" className="text-gray-400 hover:text-white transition-all duration-300">Contact Us</Link></li>
              </ul>
            </div>
            {/* Connect */}
            <div>
              <h4 className="text-lg font-bold mb-4">Connect</h4>
              <div className="flex gap-4 mb-6">
                <a href="https://twitter.com" className="text-gray-400 hover:text-white transition-all duration-300" aria-label="Twitter">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="https://facebook.com" className="text-gray-400 hover:text-white transition-all duration-300" aria-label="Facebook">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>
                <a href="https://instagram.com" className="text-gray-400 hover:text-white transition-all duration-300" aria-label="Instagram">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" />
                  </svg>
                </a>
                <a href="https://linkedin.com" className="text-gray-400 hover:text-white transition-all duration-300" aria-label="LinkedIn">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
              {/* TODO: Implement newsletter subscription functionality */}
              <form className="mt-4" onSubmit={(e) => {
                e.preventDefault();
                // TODO: Add newsletter subscription logic here
              }}>
                <label htmlFor="newsletter-email" className="text-sm text-gray-300 mb-2 block">Subscribe to our newsletter</label>
                <div className="flex gap-2">
                  <input
                    id="newsletter-email"
                    type="email"
                    placeholder="Enter your email"
                    aria-label="Email address for newsletter subscription"
                    className="px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-blue-500 transition-all duration-300 flex-1"
                  />
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all duration-300" aria-label="Subscribe to newsletter">
                    Subscribe
                  </button>
                </div>
              </form>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              © 2026 E-Store. Powered by Next.js, Redis, and PostgreSQL. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
