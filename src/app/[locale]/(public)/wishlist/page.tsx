import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { logError } from '@/lib/logger'
import { AuthRequiredState } from '@/components/ui/AuthRequiredState'
import Footer from '@/components/layout/Footer'
import type { Product } from '@/lib/types'
import WishlistClient from '@/app/[locale]/(public)/wishlist/WishlistClient'

export const dynamic = 'force-dynamic'

export default async function WishlistPage() {
  const session = await auth()

  if (!session?.user?.id) {
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

  // Fetch the wishlist on the server so the page renders its content on first
  // paint instead of fetching it client-side after hydration (L5/NX4).
  let products: Product[] = []
  try {
    products = await db.wishlists.getProducts(session.user.id)
  } catch (error) {
    logError({ error, context: 'wishlist_page_fetch' })
  }

  return (
    <WishlistClient
      initialProducts={products}
      initialProductIds={products.map((p) => p.id)}
    />
  )
}
