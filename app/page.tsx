import type { Metadata } from 'next';
import { Product } from '@/lib/types';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Hero from '@/components/sections/Hero';
import ProductGrid from '@/components/sections/ProductGrid';
import { db } from '@/lib/db';
import { unstable_cache } from 'next/cache';

import { logError } from '@/lib/logger';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'The Kiyon Store | Handcrafted with Love',
  description: 'Discover beautiful handmade decorations and cozy wearables — flower bouquets, keyrings, hand warmers, mufflers, scarves, and more.',
};

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
    logError({ error, context: 'home_products_fetch' });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      <Header />

      <Hero />

      <ProductGrid products={products} />

      <Footer />
    </div>
  );
}
