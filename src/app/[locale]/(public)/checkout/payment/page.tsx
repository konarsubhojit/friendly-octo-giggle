'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSelector } from 'react-redux'
import { z } from 'zod'
import { useLocale } from '@/contexts/LocaleContext'
import { selectCart } from '@/features/cart/store/cartSlice'
import { useCurrency } from '@/contexts/CurrencyContext'
import {
  buildCheckoutPricingSummaryFromLineItems,
  buildCheckoutSummaryLineItems,
} from '@/features/orders/services/order-summary'
import { CheckoutProgress } from '@/features/cart/components/CheckoutProgress'
import { CartPricingSummary } from '@/features/cart/components/CartPricingSummary'
import { GradientButton } from '@/components/ui/GradientButton'
import { GradientHeading } from '@/components/ui/GradientHeading'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import Link from '@/components/ui/LocaleLink'

const PENDING_CHECKOUT_KEY = 'pending_checkout'

const PendingCheckoutSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string().default(''),
  addressLine3: z.string().default(''),
  pinCode: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  customizationNotes: z.record(z.string(), z.string()).default({}),
})

type PendingCheckout = z.infer<typeof PendingCheckoutSchema>

function readPendingCheckout(): PendingCheckout | null {
  if (globalThis.window === undefined) return null
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    const result = PendingCheckoutSchema.safeParse(parsed)
    if (!result.success) {
      sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
      return null
    }
    return result.data
  } catch {
    return null
  }
}

const SECTION_CLASS =
  'rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] p-5 sm:p-6'

export default function CheckoutPaymentPage() {
  const router = useRouter()
  const { localizePath } = useLocale()
  const { data: session, status } = useSession()
  const cart = useSelector(selectCart)
  const { formatPrice } = useCurrency()

  const [pendingCheckout] = useState<PendingCheckout | null>(() =>
    readPendingCheckout()
  )

  useEffect(() => {
    if (!pendingCheckout) {
      router.replace(localizePath('/cart'))
    }
  }, [pendingCheckout, router, localizePath])

  const cartItems = useMemo(() => cart?.items ?? [], [cart?.items])

  const checkoutItems = useMemo(
    () =>
      cartItems.map((item) => ({
        ...item,
        customizationNote: pendingCheckout?.customizationNotes[item.id] ?? null,
      })),
    [cartItems, pendingCheckout]
  )

  const lineItems = useMemo(
    () => buildCheckoutSummaryLineItems(checkoutItems),
    [checkoutItems]
  )

  const pricingSummary = useMemo(
    () => buildCheckoutPricingSummaryFromLineItems(lineItems),
    [lineItems]
  )

  if (pendingCheckout === null || status === 'loading') {
    return (
      <div className="min-h-screen bg-warm-gradient flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session?.user) {
    router.replace(
      `${localizePath('/auth/signin')}?callbackUrl=${encodeURIComponent(localizePath('/checkout/payment'))}`
    )
    return null
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <CheckoutProgress currentStep="payment" />
        <GradientHeading className="mb-2">Payment</GradientHeading>
        <p className="mb-8 text-sm text-[var(--text-secondary)]">
          Review your order total and enter payment details before confirming
          your purchase.
        </p>

        <div className="space-y-6">
          {/* Order Total */}
          <section className={SECTION_CLASS}>
            <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              Amount Due
            </h2>
            <div className="rounded-2xl bg-[var(--accent-blush)]/40 p-4">
              <CartPricingSummary
                itemCount={pricingSummary.itemCount}
                subtotal={formatPrice(pricingSummary.subtotal)}
                shipping={
                  pricingSummary.shippingAmount === 0
                    ? 'Free'
                    : formatPrice(pricingSummary.shippingAmount)
                }
                total={formatPrice(pricingSummary.total)}
              />
            </div>
          </section>

          {/* Payment Method */}
          <section className={SECTION_CLASS}>
            <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
              Payment Method
            </h2>
            <div
              className="rounded-xl border border-dashed border-[var(--border-warm)] px-4 py-6 text-center"
              aria-label="Payment gateway (coming soon)"
            >
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                Online payment integration is coming soon.
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                For now, payment details will be confirmed via email after you
                place your order.
              </p>
            </div>
          </section>

          {/* Navigation */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/checkout/shipping"
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border-warm)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors"
            >
              Back
            </Link>
            <GradientButton
              type="button"
              onClick={() => router.push(localizePath('/checkout/review'))}
            >
              Continue to Review
            </GradientButton>
          </div>
        </div>
      </main>
    </div>
  )
}
