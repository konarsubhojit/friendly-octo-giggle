/**
 * Upstash Search integration for products.
 *
 * Uses @upstash/search for AI-powered full-text search.
 *
 * Requires UPSTASH_SEARCH_REST_URL and UPSTASH_SEARCH_REST_TOKEN
 * environment variables. When not configured, search operations
 * are no-ops and the existing Drizzle ilike() queries remain.
 */

import { Search } from "@upstash/search";
import { logError } from "./logger";
import { drizzleDb } from "./db";
import { categories as categoriesTable } from "./schema";
import { isNull } from "drizzle-orm";

// ─── Content types (searchable + filterable) ─────────────

export type ProductContent = {
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
};

// ─── Metadata types (not searchable, returned with results)

export type ProductMetadata = {
  image: string;
};

// ─── Index names ─────────────────────────────────────────

const PRODUCTS_INDEX = "products";

// ─── Client singleton ────────────────────────────────────

let searchClient: Search | null = null;

/**
 * Returns true when Upstash Search is configured via env vars.
 */
export function isSearchAvailable(): boolean {
  return Boolean(
    process.env.UPSTASH_SEARCH_REST_URL &&
    process.env.UPSTASH_SEARCH_REST_TOKEN,
  );
}

function getClient(): Search {
  if (searchClient) return searchClient;

  searchClient = new Search({
    url: process.env.UPSTASH_SEARCH_REST_URL,
    token: process.env.UPSTASH_SEARCH_REST_TOKEN,
  });

  return searchClient;
}

// ─── Product indexing ────────────────────────────────────

export async function indexProduct(product: {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  image: string;
}): Promise<void> {
  if (!isSearchAvailable()) return;

  try {
    const client = getClient();
    const index = client.index<ProductContent, ProductMetadata>(PRODUCTS_INDEX);

    await index.upsert({
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
    });
  } catch (error) {
    logError({
      error,
      context: "search",
      additionalInfo: { operation: "indexProduct", id: product.id },
    });
  }
}

export async function indexProducts(
  products: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    price: number;
    stock: number;
    image: string;
  }>,
): Promise<void> {
  if (!isSearchAvailable() || products.length === 0) return;

  try {
    const client = getClient();
    const index = client.index<ProductContent, ProductMetadata>(PRODUCTS_INDEX);

    const BATCH_SIZE = 1000;
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      await index.upsert(
        batch.map((p) => ({
          id: p.id,
          content: {
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price,
            stock: p.stock,
          },
          metadata: {
            image: p.image,
          },
        })),
      );
    }
  } catch (error) {
    logError({
      error,
      context: "search",
      additionalInfo: { operation: "indexProducts" },
    });
  }
}

export async function removeProduct(productId: string): Promise<void> {
  if (!isSearchAvailable()) return;

  try {
    const client = getClient();
    const index = client.index(PRODUCTS_INDEX);
    await index.delete(productId);
  } catch (error) {
    logError({
      error,
      context: "search",
      additionalInfo: { operation: "removeProduct", id: productId },
    });
  }
}

// ─── Search queries ──────────────────────────────────────

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
  if (!isSearchAvailable()) return [];

  const { limit = 20, category } = options;

  const client = getClient();
  const index = client.index<ProductContent, ProductMetadata>(PRODUCTS_INDEX);

  // Validate category against DB to prevent filter injection
  let validCategory: string | undefined;
  if (category) {
    const dbCats = await drizzleDb
      .select({ name: categoriesTable.name })
      .from(categoriesTable)
      .where(isNull(categoriesTable.deletedAt));
    const catNames = dbCats.map((c) => c.name);
    validCategory = catNames.includes(category) ? category : undefined;
  }
  const filter = validCategory ? `category = '${validCategory}'` : undefined;

  const results = await index.search({
    query,
    limit,
    ...(filter ? { filter } : {}),
  });

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    content: r.content,
    metadata: r.metadata ?? { image: "" },
  }));
}

// ─── Admin: reset indexes ────────────────────────────────

export async function resetIndex(indexName: "products"): Promise<void> {
  if (!isSearchAvailable()) return;

  const client = getClient();
  const index = client.index(indexName);
  await index.reset();
}
