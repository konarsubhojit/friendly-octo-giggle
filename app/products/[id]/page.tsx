import { notFound } from 'next/navigation';
import { Product } from '@/lib/types';
import ProductClient from './ProductClient';
import { db } from '@/lib/db';

export const revalidate = 60;

const PRERENDERED_PRODUCTS_COUNT = 10;

async function getProduct(id: string): Promise<Product | null> {
  try {
    const product = await db.products.findById(id);
    return product;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
  }
}

// Pre-generate static pages for the 10 most recent products at build time
export async function generateStaticParams() {
  try {
    const products = await db.products.findAll({ limit: PRERENDERED_PRODUCTS_COUNT });
    return products.map((product) => ({ id: product.id }));
  } catch (error) {
    console.error('Error generating static params:', error);
    // Return empty array to allow build to continue without pre-rendering
    // Pages will be generated on-demand instead
    return [];
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  return <ProductClient product={product} />;
}
