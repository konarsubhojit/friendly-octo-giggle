import HeaderSkeleton from '@/components/skeletons/HeaderSkeleton';

import HeaderSkeleton from '@/components/skeletons/HeaderSkeleton';

const VARIATION_SKELETONS = ['v1', 'v2', 'v3', 'v4'] as const;

function ImageSkeleton() {
  return (
    <div className="relative">
      <div className="relative h-96 md:h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      </div>
      <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-30 -z-10" />
      <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-3xl opacity-30 -z-10" />
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-8 mb-6">
        <div className="h-10 w-3/4 bg-gradient-to-r from-[#e8a87c] via-[#d4856b] to-[#c7735a] rounded-lg animate-pulse mb-4" />
        <div className="mb-6">
          <div className="h-8 w-28 bg-gradient-to-r from-[#e8a87c] to-[#d4856b] rounded-full animate-pulse" />
        </div>
        <div className="space-y-3 mb-8">
          <div className="h-5 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-full bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="mb-6 p-4 bg-gradient-to-r from-[#fde8d8] to-[#f0d5c0] rounded-xl border border-[#f0d5c0]">
          <div className="h-12 w-40 bg-gradient-to-r from-[#e8a87c] to-[#d4856b] rounded-lg animate-pulse" />
        </div>
        <div className="mb-6">
          <div className="h-8 w-36 bg-green-100 rounded-full animate-pulse" />
        </div>
        <div className="mb-6">
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="flex flex-wrap gap-3">
            {VARIATION_SKELETONS.map((id) => (
              <div key={id} className="h-10 w-20 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        <div className="mb-6">
          <div className="h-6 w-20 bg-gray-200 rounded animate-pulse mb-3" />
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-12 w-16 bg-gray-200 rounded-lg animate-pulse" />
            <div className="h-12 w-12 bg-gray-200 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="h-14 w-full bg-gradient-to-r from-[#e8a87c] to-[#d4856b] rounded-xl animate-pulse" />
      </div>
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-[#fde8d8] rounded-full animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-[#d4e4c4] rounded-full animate-pulse" />
            <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-[#fde8d8] rounded-full animate-pulse" />
            <div className="h-4 w-36 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailLoading() {
  return (
    <div className="min-h-screen bg-warm-gradient">
      <HeaderSkeleton />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Breadcrumb Skeleton */}
        <nav className="mb-6 flex items-center gap-2">
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-2 bg-gray-300 rounded animate-pulse" />
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <ImageSkeleton />
          <DetailsSkeleton />
        </div>
      </main>
    </div>
  );
}
