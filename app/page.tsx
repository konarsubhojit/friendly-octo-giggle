import { Product } from '@/lib/types';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import ProductGrid from '@/components/sections/ProductGrid';
import { db } from '@/lib/db';

// Force dynamic rendering - no static generation
export const dynamic = 'force-dynamic';

export default async function Home() {
  let products: Product[] = [];
  try {
    products = await db.products.findAll();
  } catch (error) {
    console.error('Error fetching products from database:', error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Header />

      <Hero />

      <ProductGrid products={products} />

      <Footer />
    </div>
  );
}
