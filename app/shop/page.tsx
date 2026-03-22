import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import ProductGrid, {
  type ProductGridItem,
} from "@/components/sections/ProductGrid";
import { db, drizzleDb } from "@/lib/db";
import { cacheCategoriesList, cacheProductsBestsellers } from "@/lib/cache";
import { searchProductIdsCached } from "@/lib/search-service";
import { categories as categoriesTable } from "@/lib/schema";
import { isNull, asc } from "drizzle-orm";
import { logError } from "@/lib/logger";

export const revalidate = 60;

const SHOP_PAGE_SIZE = 15;

interface ShopPageProps {
  readonly searchParams?: Promise<{
    q?: string | string[];
    category?: string | string[];
  }>;
}

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
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

  let shopData: {
    products: ProductGridItem[];
    bestsellers: ProductGridItem[];
    categoryNames: string[];
    hasNextPage: boolean;
  } = {
    products: [],
    bestsellers: [],
    categoryNames: [],
    hasNextPage: false,
  };

  try {
    const selectedCategoryFilter =
      selectedCategory === "All" ? undefined : selectedCategory;

    const [topProducts, cats] = await Promise.all([
      cacheProductsBestsellers(() => db.products.findBestsellers(), 5),
      cacheCategoriesList(() =>
        drizzleDb
          .select({ name: categoriesTable.name })
          .from(categoriesTable)
          .where(isNull(categoriesTable.deletedAt))
          .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name)),
      ),
    ]);

    if (search) {
      const matchedIds = await searchProductIdsCached(search, {
        category: selectedCategoryFilter,
        limit: SHOP_PAGE_SIZE + 1,
      });

      if (matchedIds === null) {
        const allProducts = await db.products.findAllMinimal({
          limit: SHOP_PAGE_SIZE + 1,
          offset: 0,
          search,
          category: selectedCategoryFilter,
        });

        shopData = {
          products: allProducts.slice(0, SHOP_PAGE_SIZE),
          bestsellers: topProducts,
          categoryNames: cats.map((c) => c.name),
          hasNextPage: allProducts.length > SHOP_PAGE_SIZE,
        };
      } else {
        const pageIds = matchedIds.slice(0, SHOP_PAGE_SIZE);
        const matchedProducts = await db.products.findMinimalByIds(
          pageIds,
          selectedCategoryFilter,
        );
        const productsById = new Map(
          matchedProducts.map((product) => [product.id, product]),
        );
        const orderedProducts = pageIds.flatMap((id) => {
          const product = productsById.get(id);
          return product ? [product] : [];
        });

        shopData = {
          products: orderedProducts,
          bestsellers: topProducts,
          categoryNames: cats.map((c) => c.name),
          hasNextPage: matchedIds.length > SHOP_PAGE_SIZE,
        };
      }
    } else {
      const allProducts = await db.products.findAllMinimal({
        limit: SHOP_PAGE_SIZE + 1,
        offset: 0,
        search,
        category: selectedCategoryFilter,
      });

      shopData = {
        products: allProducts.slice(0, SHOP_PAGE_SIZE),
        bestsellers: topProducts,
        categoryNames: cats.map((c) => c.name),
        hasNextPage: allProducts.length > SHOP_PAGE_SIZE,
      };
    }
  } catch (error) {
    logError({ error, context: "shop_products_fetch" });
  }

  const { products, bestsellers, categoryNames, hasNextPage } = shopData;

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
        hasNextPage={hasNextPage}
        batchSize={SHOP_PAGE_SIZE}
      />

      <Footer />
    </div>
  );
};

export default ShopPage;
