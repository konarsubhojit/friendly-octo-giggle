import { auth } from '@/lib/auth'
import { logError } from '@/lib/logger'
import Link from '@/components/ui/LocaleLink'
import { AuthRequiredState } from '@/components/ui/AuthRequiredState'
import { getCart, getCartIdentity } from '@/features/cart/services/cart-service'
import type { Cart } from '@/lib/types'
import CartClient from '@/app/[locale]/(public)/cart/CartClient'

export const dynamic = 'force-dynamic'

export default async function CartPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <AuthRequiredState
            callbackUrl="/cart"
            message="Please sign in to view your cart and place orders."
          />
          <Link
            href="/shop"
            className="block mt-4 text-[var(--text-muted)] hover:text-[var(--text-secondary)] font-medium text-center"
          >
            Continue Shopping
          </Link>
        </main>
      </div>
    )
  }

  // Fetch the user's cart on the server so the page renders its content on
  // first paint instead of fetching it client-side after hydration (L5/NX4).
  // The client still reconciles afterwards (syncing guest items / merging the
  // guest cart cookie) via the existing API fetch.
  let initialCart: Cart | null = null
  try {
    const result = await getCart(getCartIdentity(session, undefined))
    initialCart = result.cart as Cart | null
  } catch (error) {
    logError({ error, context: 'cart_page_fetch' })
  }

  return <CartClient initialCart={initialCart} />
}
