const PRODUCT_SKELETONS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;
const LINK_SKELETONS = ['l1', 'l2', 'l3', 'l4'] as const;

export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header Skeleton */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="flex items-center gap-4">
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
          </div>
        </div>
      </header>

      {/* Hero Skeleton */}
      <section className="relative pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="h-12 w-3/4 mx-auto bg-gray-200 rounded-lg animate-pulse mb-6" />
          <div className="h-6 w-1/2 mx-auto bg-gray-200 rounded animate-pulse mb-4" />
          <div className="h-6 w-2/5 mx-auto bg-gray-200 rounded animate-pulse mb-8" />
          <div className="h-12 w-40 mx-auto bg-gradient-to-r from-blue-200 to-purple-200 rounded-full animate-pulse" />
        </div>
      </section>

      {/* Product Grid Skeleton */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="h-9 w-56 bg-gray-200 rounded-lg animate-pulse mb-8" />
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {PRODUCT_SKELETONS.map((id) => (
            <div
              key={id}
              className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-gray-100"
            >
              <div className="h-64 w-full bg-gray-200 animate-pulse" />
              <div className="p-4">
                <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse mb-2" />
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-1" />
                <div className="h-4 w-2/3 bg-gray-200 rounded animate-pulse mb-4" />
                <div className="flex justify-between items-center mb-3">
                  <div className="h-8 w-24 bg-blue-100 rounded animate-pulse" />
                  <div className="h-6 w-20 bg-green-100 rounded-full animate-pulse" />
                </div>
                <div className="h-6 w-20 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Footer Skeleton */}
      <footer className="bg-gray-100 border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse" />
            </div>
            <div>
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-2">
                {LINK_SKELETONS.map((id) => (
                  <div key={id} className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </div>
            <div>
              <div className="h-6 w-28 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
