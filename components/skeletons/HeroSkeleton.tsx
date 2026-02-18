/**
 * Shared hero section skeleton component
 * Used in the home page loading state
 */
export default function HeroSkeleton() {
  return (
    <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <div className="h-12 w-3/4 mx-auto bg-gray-200 rounded-lg animate-pulse mb-6" />
        <div className="h-6 w-1/2 mx-auto bg-gray-200 rounded animate-pulse mb-4" />
        <div className="h-6 w-2/5 mx-auto bg-gray-200 rounded animate-pulse mb-8" />
        <div className="h-12 w-40 mx-auto bg-gradient-to-r from-blue-200 to-purple-200 rounded-full animate-pulse" />
      </div>
    </section>
  );
}
