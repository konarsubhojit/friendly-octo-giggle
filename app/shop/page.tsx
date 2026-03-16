import type { Metadata } from "next";
import { Product } from "@/lib/types";
import Footer from "@/components/layout/Footer";
import ProductGrid from "@/components/sections/ProductGrid";
import { db } from "@/lib/db";
import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop | The Kiyon Store",
  description:
    "Browse our full collection of handmade crochet flowers, bags, keychains, hair accessories, and more.",
};

const ShopPage = async () => {
  let products: Product[] = [];
  try {
    products = await db.products.findBestsellers({ withCache: true });
  } catch (error) {
    logError({ error, context: "shop_products_fetch" });
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <div className="pt-28 pb-4 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h1 className="font-cursive text-4xl sm:text-5xl font-bold text-[var(--foreground)] mb-2 animate-fade-in-up">
          Shop
        </h1>
        <p className="text-[var(--text-secondary)] mb-6 animate-fade-in-up animation-delay-100">
          Browse our handmade collection — each piece crafted with care.
        </p>
      </div>

      <ProductGrid products={products} />

      <Footer />
    </div>
  );
};

export default ShopPage;
