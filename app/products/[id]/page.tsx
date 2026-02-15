import { notFound } from 'next/navigation';
import { Product } from '@/lib/types';
import ProductClient from './ProductClient';
import { db } from '@/lib/db';

// Force dynamic rendering - no static generation
export const dynamic = 'force-dynamic';

async function getProduct(id: string): Promise<Product | null> {
  try {
    const product = await db.products.findById(id);
    return product;
  } catch (error) {
    console.error('Error fetching product:', error);
    return null;
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
