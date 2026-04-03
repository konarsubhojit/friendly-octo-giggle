'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRecentlyViewed } from '@/features/product/hooks/useRecentlyViewed'
import { useCurrency } from '@/contexts/CurrencyContext'
import { GradientHeading } from '@/components/ui/GradientHeading'

const RecentlyViewed = () => {
  const { recentlyViewed } = useRecentlyViewed()
  const { formatPrice } = useCurrency()

  if (recentlyViewed.length === 0) return null

  return (
    <section
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      aria-labelledby="recently-viewed-heading"
    >
      <GradientHeading as="h2" size="lg" className="mb-6">
        <span id="recently-viewed-heading">Recently Viewed</span>
      </GradientHeading>

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-[var(--border-warm)]">
        {recentlyViewed.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="flex-none w-40 sm:w-48 snap-start group"
            aria-label={product.name}
          >
            <div className="bg-[var(--surface)] rounded-2xl shadow-warm border border-[var(--border-warm)] overflow-hidden hover:shadow-warm-lg hover:scale-[1.03] hover:border-[var(--accent-rose)] transition-all duration-300">
              <div className="relative w-full aspect-square bg-gradient-to-br from-[var(--accent-cream)] to-[var(--accent-blush)] overflow-hidden">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                  sizes="192px"
                />
              </div>
              <div className="p-3">
                <p className="text-xs font-semibold text-[var(--foreground)] line-clamp-2 group-hover:text-[var(--accent-rose)] transition-colors duration-200 leading-snug">
                  {product.name}
                </p>
                <p className="text-sm font-bold text-[var(--btn-primary)] mt-1">
                  {formatPrice(product.price)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default RecentlyViewed
