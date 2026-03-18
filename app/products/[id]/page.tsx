import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Product } from '@/lib/types';
import ProductClient from './ProductClient';
import { db } from '@/lib/db';

import { logError } from '@/lib/logger';

export const revalidate = 60;

export const generateMetadata = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> => {
  const { id } = await params;
  const product = await db.products.findById(id);
  if (!product) return { title: 'Product Not Found' };
  return {
    title: `${product.name} | The Kiyon Store`,
    description: product.description?.slice(0, 160),
  };
};

const getProduct = async (id: string): Promise<Product | null> => {
  try {
    const product = await db.products.findById(id);
    return product;
  } catch (error) {
    logError({ error, context: 'product_fetch', additionalInfo: { id } });
    return null;
  }
};

const ProductPage = async ({
  params,
  searchParams,
}: {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ v?: string }>;
}) => {
  const [{ id }, { v: initialVariationId }] = await Promise.all([
    params,
    searchParams,
  ]);
  const product = await getProduct(id);

  if (!product) {
    notFound();
  }

  return (
    <ProductClient
      product={product}
      initialVariationId={initialVariationId ?? null}
    />
  );
};

export default ProductPage;

