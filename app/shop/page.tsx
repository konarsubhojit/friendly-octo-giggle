import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import ProductGrid, {
  type ProductGridItem,
} from "@/components/sections/ProductGrid";
import { db, drizzleDb } from "@/lib/db";
import {
  categories as categoriesTable,
  products as productsTable,
} from "@/lib/schema";
import { isNull, asc, and, count, eq, ilike, or, type SQL } from "drizzle-orm";
import { logError } from "@/lib/logger";

export const revalidate = 60;

const SHOP_PAGE_SIZE = 24;

interface ShopPageProps {
  readonly searchParams?: Promise<{
    q?: string | string[];
    category?: string | string[];
    page?: string | string[];
  }>;
}

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function getPageNumber(value?: string | string[]) {
  const rawValue = getSingleValue(value);
  const page = Number.parseInt(rawValue ?? "1", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

export const metadata: Metadata = {
  title: "Shop | The Kiyon Store",
  description:
    "Browse our full collection of handmade crochet flowers, bags, keychains, hair accessories, and more.",
};

const ShopPage = async ({ searchParams }: ShopPageProps) => {
  const resolvedSearchParams = (await searchParams) ?? {};
  const search = getSingleValue(resolvedSearchParams.q)?.trim() ?? "";
  const selectedCategory =
    getSingleValue(resolvedSearchParams.category)?.trim() ?? "All";
  const page = getPageNumber(resolvedSearchParams.page);
  const offset = (page - 1) * SHOP_PAGE_SIZE;

  let shopData: {
    products: ProductGridItem[];
    bestsellers: ProductGridItem[];
    categoryNames: string[];
    totalCount: number;
    hasNextPage: boolean;
  } = {
    products: [],
    bestsellers: [],
    categoryNames: [],
    totalCount: 0,
    hasNextPage: false,
  };

  try {
    const productFilters: SQL[] = [isNull(productsTable.deletedAt)];

    if (search) {
      productFilters.push(
        or(
          ilike(productsTable.name, `%${search}%`),
          ilike(productsTable.description, `%${search}%`),
        ) as SQL,
      );
    }

    if (selectedCategory !== "All") {
      productFilters.push(eq(productsTable.category, selectedCategory));
    }

    const productWhereClause =
      productFilters.length === 1 ? productFilters[0] : and(...productFilters);

    const [allProducts, topProducts, cats, totalRows] = await Promise.all([
      db.products.findAllMinimal({
        limit: SHOP_PAGE_SIZE + 1,
        offset,
        search,
        category: selectedCategory === "All" ? undefined : selectedCategory,
      }),
      db.products.findBestsellers(),
      drizzleDb
        .select({ name: categoriesTable.name })
        .from(categoriesTable)
        .where(isNull(categoriesTable.deletedAt))
        .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name)),
      drizzleDb
        .select({ value: count() })
        .from(productsTable)
        .where(productWhereClause),
    ]);

    shopData = {
      products: allProducts.slice(0, SHOP_PAGE_SIZE),
      bestsellers: topProducts,
      categoryNames: cats.map((c) => c.name),
      totalCount: Number(totalRows[0]?.value ?? 0),
      hasNextPage: allProducts.length > SHOP_PAGE_SIZE,
    };
  } catch (error) {
    logError({ error, context: "shop_products_fetch" });
  }

  const { products, bestsellers, categoryNames, totalCount, hasNextPage } =
    shopData;

  return (
    <div className="min-h-screen bg-warm-gradient">
      <section
        className="pt-8 pb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        aria-labelledby="shop-heading"
      >
        <h1
          id="shop-heading"
          className="font-cursive text-4xl sm:text-5xl font-bold text-[var(--foreground)] mb-2 animate-fade-in-up"
        >
          Shop
        </h1>
        <p className="text-[var(--text-secondary)] mb-6 animate-fade-in-up animation-delay-100">
          Browse our handmade collection — each piece crafted with care.
        </p>
      </section>

      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6"
        aria-labelledby="shop-bestsellers-heading"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2
            id="shop-bestsellers-heading"
            className="font-cursive text-3xl sm:text-4xl font-bold text-[var(--foreground)]"
          >
            Bestsellers
          </h2>
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Top 5 by orders
          </span>
        </div>
        <p className="text-[var(--text-secondary)] text-sm mb-5">
          Most purchased favorites from our community.
        </p>

        {bestsellers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {bestsellers.map((product, index) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="group rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] shadow-warm hover:shadow-warm-lg transition-all duration-300 overflow-hidden"
                aria-label={`View bestseller ${product.name}`}
              >
                <div className="relative aspect-square bg-gradient-to-br from-[var(--accent-cream)] to-[var(--accent-blush)]">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
                    sizes="(max-width: 1024px) 50vw, 20vw"
                    priority={index < 3}
                  />
                  <span className="absolute top-2 left-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-[var(--btn-primary)] text-white text-xs font-bold">
                    {index + 1}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] line-clamp-1 group-hover:text-[var(--accent-rose)] transition-colors duration-200">
                    {product.name}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            No bestseller data yet.
          </p>
        )}
      </section>

      <ProductGrid
        products={products}
        categories={categoryNames}
        search={search}
        selectedCategory={selectedCategory}
        page={page}
        totalCount={totalCount}
        hasNextPage={hasNextPage}
        hasPreviousPage={page > 1}
      />

      <Footer />
    </div>
  );
};

export default ShopPage;
