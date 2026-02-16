import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Product } from '@/lib/types';
import ProductClient from './ProductClient';
import { db } from '@/lib/db';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = await db.products.findById(id);
  if (!product) return { title: 'Product Not Found' };
  return {
    title: `${product.name} | E-commerce Store`,
    description: product.description?.slice(0, 160),
  };
}

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
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  return <ProductClient product={product} />;
}
