import type { Metadata } from "next";
import { Product } from "@/lib/types";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/sections/Hero";
import ProductGrid from "@/components/sections/ProductGrid";
import { FloralBorder } from "@/components/ui/DecorativeElements";
import { db } from "@/lib/db";

import { logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Kiyon Store | Handcrafted with Love",
  description:
    "Handmade crochet flowers, bags, keychains, and accessories — crafted with love, delivered to your door.",
};

export default async function Home() {
  let products: Product[] = [];
  try {
    products = await db.products.findBestsellers({ withCache: true });
  } catch (error) {
    logError({ error, context: "home_bestsellers_fetch" });
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />

      <Hero />

      <FloralBorder />

      <ProductGrid products={products} />

      <Footer />
    </div>
  );
}
