/**
 * Upstash Search integration for products.
 *
 * Uses @upstash/search for full-text product search.
 *
 * Requires UPSTASH_SEARCH_REST_URL and UPSTASH_SEARCH_REST_TOKEN
 * environment variables. When not configured, search operations
 * are no-ops and the existing Drizzle ilike() queries remain.
 */

import { Search } from "@upstash/search";
import { logError } from "../logger";

export type ProductContent = {
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
};

export type ProductMetadata = {
  image: string;
};

type ProductIndexDocument = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  image: string;
};

const PRODUCTS_INDEX = "products";
const SEARCH_WRITE_BATCH_SIZE = 100;

let searchClient: Search | null = null;

export function isSearchAvailable(): boolean {
  return Boolean(
    process.env.UPSTASH_SEARCH_REST_URL &&
    process.env.UPSTASH_SEARCH_REST_TOKEN,
  );
}

function getClient(): Search {
  if (searchClient) {
    return searchClient;
  }

  searchClient = new Search({
    url: process.env.UPSTASH_SEARCH_REST_URL,
    token: process.env.UPSTASH_SEARCH_REST_TOKEN,
  });

  return searchClient;
}

function getProductsIndex() {
  return getClient().index<ProductContent, ProductMetadata>(PRODUCTS_INDEX);
}

function toIndexedProduct(product: ProductIndexDocument) {
  return {
    id: product.id,
    content: {
      name: product.name,
      description: product.description,
      category: product.category,
      price: product.price,
      stock: product.stock,
    },
    metadata: {
      image: product.image,
    },
  };
}

export async function indexProduct(
  product: ProductIndexDocument,
  options: { readonly throwOnError?: boolean } = {},
): Promise<boolean> {
  if (!isSearchAvailable()) {
    return false;
  }

  try {
    await getProductsIndex().upsert(toIndexedProduct(product));
    return true;
  } catch (error) {
    logError({
      error,
      context: "search",
      additionalInfo: { operation: "indexProduct", id: product.id },
    });

    if (options.throwOnError) {
      throw error;
    }

    return false;
  }
}

export async function indexProducts(
  products: ProductIndexDocument[],
  options: { readonly throwOnError?: boolean } = {},
): Promise<boolean> {
  if (!isSearchAvailable()) {
    return false;
  }

  if (products.length === 0) {
    return true;
  }

  try {
    const index = getProductsIndex();

    for (
      let indexOffset = 0;
      indexOffset < products.length;
      indexOffset += SEARCH_WRITE_BATCH_SIZE
    ) {
      const batch = products.slice(
        indexOffset,
        indexOffset + SEARCH_WRITE_BATCH_SIZE,
      );
      await index.upsert(batch.map((product) => toIndexedProduct(product)));
    }

    return true;
  } catch (error) {
    logError({
      error,
      context: "search",
      additionalInfo: { operation: "indexProducts" },
    });

    if (options.throwOnError) {
      throw error;
    }

    return false;
  }
}

export async function removeProduct(productId: string): Promise<void> {
  if (!isSearchAvailable()) {
    return;
  }

  try {
    await getClient().index(PRODUCTS_INDEX).delete(productId);
  } catch (error) {
    logError({
      error,
      context: "search",
      additionalInfo: { operation: "removeProduct", id: productId },
    });
  }
}

export interface ProductSearchResult {
  id: string;
  score: number;
  content: ProductContent;
  metadata: ProductMetadata;
}

export async function searchProducts(
  query: string,
  options: { limit?: number; category?: string } = {},
): Promise<ProductSearchResult[]> {
  if (!isSearchAvailable()) {
    return [];
  }

  const { limit = 20, category } = options;
  const index = getProductsIndex();
  const normalizedCategory = category?.trim();
  const results = await index.search({
    query,
    limit,
    ...(normalizedCategory
      ? { filter: { category: { equals: normalizedCategory } } }
      : {}),
  });

  return results.map((result) => ({
    id: String(result.id),
    score: result.score,
    content: result.content,
    metadata: result.metadata ?? { image: "" },
  }));
}

export async function resetIndex(indexName: "products"): Promise<void> {
  if (!isSearchAvailable()) {
    return;
  }

  await getClient().index(indexName).reset();
}

export async function getIndexInfo(indexName: "products"): Promise<unknown> {
  if (!isSearchAvailable()) {
    throw new Error("Search is not configured");
  }

  return getClient().index(indexName).info();
}
