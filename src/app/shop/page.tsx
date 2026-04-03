import type { Metadata } from "next";
import Footer from "@/components/layout/Footer";
import ProductGrid, {
  type ProductGridItem,
} from "@/features/product/components/ProductGrid";
import { BestsellersScroller } from "@/features/product/components/BestsellersScroller";
import { db, drizzleDb } from "@/lib/db";
import { cacheCategoriesList, cacheProductsBestsellers } from "@/lib/cache";
import { searchProductIdsCached } from "@/lib/search";
import { categories as categoriesTable } from "@/lib/schema";
import { isNull, asc } from "drizzle-orm";
import { logError } from "@/lib/logger";

export const revalidate = 60;

const SHOP_INITIAL_SIZE = 24;
const SHOP_BATCH_SIZE = 20;

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
        limit: SHOP_INITIAL_SIZE + 1,
      });

      if (matchedIds === null) {
        const allProducts = await db.products.findAllMinimal({
          limit: SHOP_INITIAL_SIZE + 1,
          offset: 0,
          search,
          category: selectedCategoryFilter,
        });

        shopData = {
          products: allProducts.slice(0, SHOP_INITIAL_SIZE),
          bestsellers: topProducts,
          categoryNames: cats.map((c) => c.name),
          hasNextPage: allProducts.length > SHOP_INITIAL_SIZE,
        };
      } else {
        const pageIds = matchedIds.slice(0, SHOP_INITIAL_SIZE);
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
          hasNextPage: matchedIds.length > SHOP_INITIAL_SIZE,
        };
      }
    } else {
      const allProducts = await db.products.findAllMinimal({
        limit: SHOP_INITIAL_SIZE + 1,
        offset: 0,
        search,
        category: selectedCategoryFilter,
      });

      shopData = {
        products: allProducts.slice(0, SHOP_INITIAL_SIZE),
        bestsellers: topProducts,
        categoryNames: cats.map((c) => c.name),
        hasNextPage: allProducts.length > SHOP_INITIAL_SIZE,
      };
    }
  } catch (error) {
    logError({ error, context: "shop_products_fetch" });
  }

  const { products, bestsellers, categoryNames, hasNextPage } = shopData;

  return (
    <div className="min-h-screen bg-warm-gradient">
      <section
        className="mx-auto w-full max-w-[96rem] px-4 pb-4 pt-8 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
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
        className="mx-auto w-full max-w-[96rem] px-4 pb-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12"
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

        <BestsellersScroller bestsellers={bestsellers} />
      </section>

      <ProductGrid
        products={products}
        categories={categoryNames}
        search={search}
        selectedCategory={selectedCategory}
        hasNextPage={hasNextPage}
        batchSize={SHOP_BATCH_SIZE}
      />

      <Footer />
    </div>
  );
};

export default ShopPage;
