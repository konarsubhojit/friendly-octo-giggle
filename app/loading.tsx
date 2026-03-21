import HeroSkeleton from "@/components/skeletons/HeroSkeleton";
import ProductCardSkeleton from "@/components/skeletons/ProductCardSkeleton";

const LINK_SKELETONS = ["l1", "l2", "l3", "l4"] as const;
const PRODUCT_SKELETONS = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;

const FooterSkeleton = () => {
  return (
    <footer className="bg-gradient-to-b from-[var(--accent-blush)] to-[var(--accent-peach)] border-t border-[var(--border-warm)] py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="h-6 w-32 bg-[var(--accent-peach)] rounded animate-pulse mb-4" />
            <div className="h-4 w-full bg-[var(--accent-peach)] rounded animate-pulse mb-2" />
            <div className="h-4 w-3/4 bg-[var(--accent-peach)] rounded animate-pulse" />
          </div>
          <div>
            <div className="h-6 w-24 bg-[var(--accent-peach)] rounded animate-pulse mb-4" />
            <div className="space-y-2">
              {LINK_SKELETONS.map((id) => (
                <div
                  key={id}
                  className="h-4 w-20 bg-[var(--accent-peach)] rounded animate-pulse"
                />
              ))}
            </div>
          </div>
          <div>
            <div className="h-6 w-28 bg-[var(--accent-peach)] rounded animate-pulse mb-4" />
            <div className="h-10 w-full bg-[var(--accent-peach)] rounded animate-pulse" />
          </div>
        </div>
      </div>
    </footer>
  );
}

const Loading = () => {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <HeroSkeleton />

      {/* Product Grid Skeleton */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="h-9 w-56 bg-[var(--accent-peach)] rounded-lg animate-pulse mb-8" />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {PRODUCT_SKELETONS.map((id) => (
            <ProductCardSkeleton key={id} />
          ))}
        </div>
      </main>

      <FooterSkeleton />
    </div>
  );
}
export default Loading;
