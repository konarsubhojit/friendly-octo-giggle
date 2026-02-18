import { Product } from '@/lib/types';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import ProductGrid from '@/components/sections/ProductGrid';
import { db } from '@/lib/db';
import { unstable_cache } from 'next/cache';

export const revalidate = 60;

// Create a cached version of product fetching with Next.js cache tags
const getCachedProducts = unstable_cache(
  async () => {
    return db.products.findAll({ withCache: true });
  },
  ['products-list'],
  {
    revalidate: 60,
    tags: ['products'],
  }
);

export default async function Home() {
  let products: Product[] = [];
  try {
    products = await getCachedProducts();
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
