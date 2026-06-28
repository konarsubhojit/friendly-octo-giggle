'use client'

import { useId, useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSelector } from 'react-redux'
import Link from '@/components/ui/LocaleLink'
import { z } from 'zod'
import { useLocale } from '@/contexts/LocaleContext'
import { formatStructuredAddress } from '@/lib/address-utils'
import { selectCart } from '@/features/cart/store/cartSlice'
import {
  buildCheckoutPricingSummaryFromLineItems,
  buildCheckoutSummaryLineItems,
} from '@/features/orders/services/order-summary'
import {
  CHECKOUT_POLICIES,
  CHECKOUT_POLICY_ACKNOWLEDGMENT,
  CHECKOUT_POLICY_ERROR_MESSAGE,
  SUPPORT_EMAIL,
  type CheckoutPolicySection,
} from '@/lib/constants/checkout-policies'
import { CartPricingSummary } from '@/features/cart/components/CartPricingSummary'
import { GradientButton } from '@/components/ui/GradientButton'
import { GradientHeading } from '@/components/ui/GradientHeading'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { useCurrency } from '@/contexts/CurrencyContext'
import { CheckoutProgress } from '@/features/cart/components/CheckoutProgress'

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

export default function CheckoutReviewPage() {
  const router = useRouter()
  const { localizePath } = useLocale()
  const { data: session, status } = useSession()
  const cart = useSelector(selectCart)
  const { formatPrice } = useCurrency()

  const [isAcknowledged, setIsAcknowledged] = useState(false)
  const [pendingCheckout] = useState<PendingCheckout | null>(() =>
    readPendingCheckout()
  )

  const acknowledgmentId = useId()

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

  const policyUnavailable =
    lineItems.length === 0 ||
    Object.values(CHECKOUT_POLICIES).some(
      (section) => section.items.length === 0
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
      `${localizePath('/auth/signin')}?callbackUrl=${encodeURIComponent(localizePath('/checkout/review'))}`
    )
    return null
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <CheckoutProgress currentStep="review" />
        <GradientHeading className="mb-2">Review Your Order</GradientHeading>
        <p className="mb-8 text-sm text-[var(--text-secondary)]">
          Review your order details and policy terms before proceeding to
          payment.
        </p>

        <div className="space-y-6">
          {/* Shipping Address */}
          <section className={SECTION_CLASS}>
            <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
              Shipping Address
            </h2>
            <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
              {pendingCheckout
                ? formatStructuredAddress({
                    customerAddress: '',
                    addressLine1: pendingCheckout.addressLine1,
                    addressLine2: pendingCheckout.addressLine2,
                    addressLine3: pendingCheckout.addressLine3,
                    pinCode: pendingCheckout.pinCode,
                    city: pendingCheckout.city,
                    state: pendingCheckout.state,
                  })
                : ''}
            </p>
            <Link
              href="/checkout/shipping"
              className="mt-3 inline-block text-xs font-medium text-[var(--accent-rose)] hover:underline"
            >
              ← Edit shipping details
            </Link>
          </section>

          {/* Order Policy */}
          <section className={SECTION_CLASS}>
            <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              Order Policy
            </h2>
            <div className="space-y-5">
              {Object.values(CHECKOUT_POLICIES).map(
                (section: CheckoutPolicySection) => (
                  <div key={section.title}>
                    <h3 className="mb-2 font-semibold text-[var(--foreground)]">
                      {section.title}
                    </h3>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                      {section.items.map((item: string) => (
                        <li key={item} className="flex gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-1 text-[var(--accent-rose)]"
                          >
                            •
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
            <p className="mt-5 text-sm text-[var(--text-secondary)]">
              Support contact: {SUPPORT_EMAIL}
            </p>
          </section>

          {/* Order Summary */}
          <section className={SECTION_CLASS}>
            <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              Order Summary
            </h2>

            {policyUnavailable ? (
              <p
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                role="alert"
              >
                {CHECKOUT_POLICY_ERROR_MESSAGE}
              </p>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                    Selected Products
                  </h3>
                  <div className="space-y-3">
                    {lineItems.map((item) => (
                      <article
                        key={`${item.name}-${item.variantLabel ?? 'default'}`}
                        className="rounded-2xl border border-[var(--border-warm)] bg-[var(--surface-raised)] px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-[var(--foreground)]">
                              {item.name}
                            </h4>
                            {item.variantLabel ? (
                              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                {item.variantLabel}
                              </p>
                            ) : null}
                            {item.customizationNote ? (
                              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                Customization: {item.customizationNote}
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-semibold text-[var(--foreground)]">
                              {formatPrice(item.lineTotal)}
                            </p>
                            <p className="text-[var(--text-secondary)]">
                              {item.quantity} × {formatPrice(item.unitPrice)}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

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

                <div className="rounded-2xl border border-dashed border-[var(--border-warm)] px-4 py-3">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Promo / coupon code
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Promo support is coming soon.
                  </p>
                </div>

                <p className="text-xs text-[var(--text-muted)]">
                  Delivery estimate: 3-7 business days (based on shipping
                  settings).
                </p>
              </div>
            )}
          </section>

          {/* Acknowledgment & Continue */}
          <div className={SECTION_CLASS}>
            <label
              htmlFor={acknowledgmentId}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-warm)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--foreground)]"
            >
              <input
                id={acknowledgmentId}
                type="checkbox"
                checked={isAcknowledged}
                disabled={policyUnavailable}
                onChange={(event) => setIsAcknowledged(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--border-warm)] accent-[var(--accent-rose)]"
              />
              <span>{CHECKOUT_POLICY_ACKNOWLEDGMENT}</span>
            </label>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/checkout/shipping"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border-warm)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors"
              >
                Back
              </Link>
              <GradientButton
                type="button"
                onClick={() => router.push(localizePath('/checkout/payment'))}
                disabled={!isAcknowledged || policyUnavailable}
              >
                Continue to Payment
              </GradientButton>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
