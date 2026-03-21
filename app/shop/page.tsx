import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/lib/types";
import Footer from "@/components/layout/Footer";
import ProductGrid from "@/components/sections/ProductGrid";
import { db, drizzleDb } from "@/lib/db";
import { categories as categoriesTable } from "@/lib/schema";
import { isNull, asc } from "drizzle-orm";
import { logError } from "@/lib/logger";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Shop | The Kiyon Store",
  description:
    "Browse our full collection of handmade crochet flowers, bags, keychains, hair accessories, and more.",
};

const ShopPage = async () => {
  let products: Product[] = [];
  let bestsellers: Product[] = [];
  let categoryNames: string[] = [];

  try {
    const [allProducts, topProducts, cats] = await Promise.all([
      db.products.findAll({ withCache: true }),
      db.products.findBestsellers(),
      drizzleDb
        .select({ name: categoriesTable.name })
        .from(categoriesTable)
        .where(isNull(categoriesTable.deletedAt))
        .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.name)),
    ]);

    products = allProducts;
    bestsellers = topProducts;
    categoryNames = cats.map((c) => c.name);
  } catch (error) {
    logError({ error, context: "shop_products_fetch" });
  }

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

      <ProductGrid products={products} categories={categoryNames} />

      <Footer />
    </div>
  );
};

export default ShopPage;
