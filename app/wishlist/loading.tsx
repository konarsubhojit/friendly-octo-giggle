import ProductCardSkeleton from "@/components/skeletons/ProductCardSkeleton";

const SKELETON_IDS = ["w1", "w2", "w3", "w4"] as const;

const WishlistLoading = () => {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        {/* Heading skeleton */}
        <div className="mb-8">
          <div className="h-10 w-48 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] rounded-lg animate-pulse mb-2" />
          <div className="h-4 w-32 bg-[var(--accent-blush)] rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {SKELETON_IDS.map((id) => (
            <ProductCardSkeleton key={id} />
          ))}
        </div>
      </main>
    </div>
  );
}
export default WishlistLoading;
