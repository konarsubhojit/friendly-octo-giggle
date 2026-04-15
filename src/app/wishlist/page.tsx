'use client'

import { useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession } from 'next-auth/react'
import { useSelector, useDispatch } from 'react-redux'
import { useCurrency } from '@/contexts/CurrencyContext'
import {
  getVariantMinPrice,
} from '@/features/product/variant-utils'
import {
  fetchWishlist,
  removeFromWishlist,
  optimisticToggle,
} from '@/features/wishlist/store/wishlistSlice'
import type { RootState, AppDispatch } from '@/lib/store'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { AuthRequiredState } from '@/components/ui/AuthRequiredState'
import { GradientHeading } from '@/components/ui/GradientHeading'
import { AlertBanner } from '@/components/ui/AlertBanner'
import { Product } from '@/lib/types'
import Footer from '@/components/layout/Footer'

interface WishlistCardProps {
  readonly product: Product
  readonly formatPrice: (amount: number) => string
  readonly onRemove: (productId: string) => void
}

const WishlistCard = ({
  product,
  formatPrice,
  onRemove,
}: WishlistCardProps) => (
  <div className="bg-[var(--surface)] rounded-3xl shadow-warm overflow-hidden border border-[var(--border-warm)] group hover:shadow-warm-lg hover:scale-[1.02] hover:-translate-y-1 hover:border-[var(--accent-rose)] transition-all duration-300 relative">
    <Link
      href={`/products/${product.id}`}
      className="block"
      aria-label={product.name}
    >
      <div className="relative w-full aspect-square bg-gradient-to-br from-[var(--accent-cream)] to-[var(--accent-blush)] overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="object-contain p-4 group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>
      <div className="p-5">
        <h3 className="text-base font-bold text-[var(--foreground)] mb-1.5 line-clamp-1 group-hover:text-[var(--accent-rose)] transition-colors duration-200">
          {product.name}
        </h3>
        <p className="text-[var(--text-muted)] text-sm mb-4 line-clamp-2 leading-relaxed">
          {product.description}
        </p>
        <span className="text-xl font-bold text-[var(--btn-primary)]">
          {formatPrice(getVariantMinPrice(product.variants))}
        </span>
      </div>
    </Link>
    <div className="px-5 pb-5">
      <button
        type="button"
        onClick={() => onRemove(product.id)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full border border-[var(--border-warm)] text-sm font-semibold text-red-500 hover:bg-red-50/50 hover:border-red-300 transition-all duration-200"
        aria-label={`Remove ${product.name} from wishlist`}
      >
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        Remove
      </button>
    </div>
  </div>
)

const WishlistPage = () => {
  const { data: session, status: authStatus } = useSession()
  const { formatPrice } = useCurrency()
  const dispatch = useDispatch<AppDispatch>()
  const products = useSelector((state: RootState) => state.wishlist.products)
  const loading = useSelector((state: RootState) => state.wishlist.loading)
  const error = useSelector((state: RootState) => state.wishlist.error)

  useEffect(() => {
    if (authStatus === 'authenticated') {
      dispatch(fetchWishlist())
    }
  }, [authStatus, dispatch])

  const handleRemove = useCallback(
    (productId: string) => {
      dispatch(optimisticToggle(productId))
      dispatch(removeFromWishlist(productId))
    },
    [dispatch]
  )

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        </main>
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <AuthRequiredState
            callbackUrl="/wishlist"
            message="Please sign in to view your wishlist."
          />
        </main>
        <Footer />
      </div>
    )
  }

  const plural = products.length === 1 ? '' : 's'
  const wishlistCountText =
    products.length === 0
      ? 'Your wishlist is empty'
      : `${products.length} saved item${plural}`

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <div className="mb-8">
          <GradientHeading as="h1" size="xl">
            My Wishlist
          </GradientHeading>
          <p className="text-[var(--text-muted)] mt-1">{wishlistCountText}</p>
        </div>

        {error && (
          <AlertBanner message={error} variant="error" className="mb-6" />
        )}

        {products.length === 0 ? (
          <div className="bg-[var(--surface)] rounded-3xl shadow-warm border border-[var(--border-warm)] p-16 text-center">
            <EmptyState
              icon={
                <svg
                  className="w-20 h-20 text-[var(--accent-rose)]/40"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              }
              title="No saved items yet"
              message="Browse our collection and tap the heart icon to save items you love."
              ctaText="Shop Now"
              ctaHref="/shop"
              className="py-0"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <WishlistCard
                key={product.id}
                product={product}
                formatPrice={formatPrice}
                onRemove={handleRemove}
              />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

export default WishlistPage
