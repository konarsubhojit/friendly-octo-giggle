import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'About Us | The Kiyon Store',
  description: 'Learn more about The Kiyon Store, our mission, values, and the team behind our handmade decorations and wearables.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">About Us</h1>
        <p className="text-gray-500 text-lg mb-12">Your trusted online shopping destination.</p>

        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
          <p className="text-gray-600 leading-relaxed">
            At Craft &amp; Cozy, our mission is to bring handmade warmth into every home. We craft beautiful flower bouquets, keyrings, hand warmers, mufflers, and scarves — each made with care and delivered right to your door.
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Story</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Founded in 2024, Craft &amp; Cozy started as a small team passionate about handmade decorations and cozy wearables. Today, we serve thousands of customers who love our flower bouquets, keyrings, hand warmers, mufflers, and scarves — all crafted with heart.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Built on a modern technology stack including Next.js, PostgreSQL, and Redis, our platform is designed for speed, reliability, and scale — so you can shop with confidence anytime, anywhere.
          </p>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Our Values</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Quality First</h3>
              <p className="text-sm text-gray-500">Every product is carefully vetted before it reaches our shelves.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Customer Focus</h3>
              <p className="text-sm text-gray-500">Your satisfaction is our top priority, every step of the way.</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Fast & Reliable</h3>
              <p className="text-sm text-gray-500">Quick delivery and dependable service you can count on.</p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">The Team</h2>
          <p className="text-gray-600 leading-relaxed">
            We are a diverse team of engineers, designers, and customer experience professionals united by one goal: making your shopping experience the best it can be. We are always hiring talented people who share our passion.
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
