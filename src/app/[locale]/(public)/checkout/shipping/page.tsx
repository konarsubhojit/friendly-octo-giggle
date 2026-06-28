'use client'

import Link from '@/components/ui/LocaleLink'
import { useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useSelector } from 'react-redux'
import { selectCart } from '@/features/cart/store/cartSlice'
import { useCurrency } from '@/contexts/CurrencyContext'
import { Card } from '@/components/ui/Card'
import { GradientHeading } from '@/components/ui/GradientHeading'
import { AuthRequiredState } from '@/components/ui/AuthRequiredState'
import { EmptyState } from '@/components/ui/EmptyState'
import CartGlyph from '@/components/icons/CartGlyph'
import { CheckoutForm } from '@/features/cart/components/CheckoutForm'
import { CheckoutProgress } from '@/features/cart/components/CheckoutProgress'
import { buildCheckoutPricingSummary } from '@/features/orders/services/order-summary'
import { CartPricingSummary } from '@/features/cart/components/CartPricingSummary'

export default function CheckoutShippingPage() {
  const { data: session, status } = useSession()
  const cart = useSelector(selectCart)
  const { formatPrice } = useCurrency()

  const pricingSummary = useMemo(
    () => buildCheckoutPricingSummary(cart?.items ?? []),
    [cart?.items]
  )

  if (status === 'loading') {
    return null
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <CheckoutProgress currentStep="shipping" />
          <AuthRequiredState
            callbackUrl="/checkout/shipping"
            message="Please sign in to add a shipping address."
          />
        </main>
      </div>
    )
  }

  if (!cart?.items?.length) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <CheckoutProgress currentStep="shipping" />
          <Card className="p-10 text-center">
            <EmptyState
              icon={
                <CartGlyph className="inline-block h-28 w-28 shrink-0 text-[var(--accent-peach)]" />
              }
              title="Your cart is empty"
              message="Add products before entering shipping details."
              ctaText="Browse Products"
              ctaHref="/shop"
              className="py-0"
            />
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <CheckoutProgress currentStep="shipping" />
        <GradientHeading className="mb-8">Shipping Details</GradientHeading>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <CheckoutForm customizationNotes={{}} />
            </Card>
            <Link
              href="/cart"
              className="inline-flex items-center gap-2 mt-4 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-colors font-medium"
            >
              ← Back to cart
            </Link>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 sticky top-28">
              <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
                Order Summary
              </h2>

              <CartPricingSummary
                className="mb-2"
                itemCount={pricingSummary.itemCount}
                subtotal={formatPrice(pricingSummary.subtotal)}
                shipping={
                  pricingSummary.shippingAmount === 0
                    ? 'Free'
                    : formatPrice(pricingSummary.shippingAmount)
                }
                total={formatPrice(pricingSummary.total)}
              />

              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Payment will be collected on the next step.
              </p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
