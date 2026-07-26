'use client'

import { useId, useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSelector } from 'react-redux'
import Link from 'next/link'
import { z } from 'zod'
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
import { Button } from '@/components/ui/Button'
import { apiClient } from '@/lib/api-client'
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
  couponCode: z.string().nullish(),
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

interface AppliedCouponState {
  code: string
  discountAmount: number
}

interface CouponPreviewResponse {
  data: {
    couponCode: string
    subtotal: number
    discountAmount: number
    total: number
  }
}

/** Persist the applied code so the payment step can submit it with the order. */
function persistCouponCode(code: string | null): void {
  if (globalThis.window === undefined) return
  const current = readPendingCheckout()
  if (!current) return
  sessionStorage.setItem(
    PENDING_CHECKOUT_KEY,
    JSON.stringify({ ...current, couponCode: code })
  )
}

const SECTION_CLASS =
  'rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] p-5 sm:p-6'

export default function CheckoutReviewPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const cart = useSelector(selectCart)
  const { formatPrice } = useCurrency()

  const [isAcknowledged, setIsAcknowledged] = useState(false)
  const [pendingCheckout] = useState<PendingCheckout | null>(() =>
    readPendingCheckout()
  )

  const acknowledgmentId = useId()
  const couponInputId = useId()

  const [couponCode, setCouponCode] = useState(
    pendingCheckout?.couponCode ?? ''
  )
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCouponState | null>(
    null
  )
  const [couponError, setCouponError] = useState<string | null>(null)
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  // Re-validate a code restored from session storage so the summary never shows
  // a total that differs from what will actually be charged.
  useEffect(() => {
    const code = pendingCheckout?.couponCode
    if (status !== 'authenticated' || !code) return

    let cancelled = false
    apiClient
      .post<CouponPreviewResponse>('/api/cart/coupon', { couponCode: code })
      .then((response) => {
        if (cancelled) return
        setAppliedCoupon({
          code: response.data.couponCode,
          discountAmount: response.data.discountAmount,
        })
      })
      .catch(() => {
        if (cancelled) return
        setAppliedCoupon(null)
        persistCouponCode(null)
      })

    return () => {
      cancelled = true
    }
  }, [pendingCheckout?.couponCode, status])

  const handleApplyCoupon = async () => {
    const code = couponCode.trim()
    if (!code) return

    setApplyingCoupon(true)
    setCouponError(null)
    try {
      const response = await apiClient.post<CouponPreviewResponse>(
        '/api/cart/coupon',
        { couponCode: code }
      )
      const applied: AppliedCouponState = {
        code: response.data.couponCode,
        discountAmount: response.data.discountAmount,
      }
      setAppliedCoupon(applied)
      setCouponCode(applied.code)
      persistCouponCode(applied.code)
    } catch (error) {
      setAppliedCoupon(null)
      persistCouponCode(null)
      setCouponError(
        error instanceof Error ? error.message : 'Coupon could not be applied'
      )
    } finally {
      setApplyingCoupon(false)
    }
  }

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null)
    setCouponCode('')
    setCouponError(null)
    persistCouponCode(null)
  }

  useEffect(() => {
    if (!pendingCheckout) {
      router.replace('/cart')
    }
  }, [pendingCheckout, router])

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
      `${'/auth/signin'}?callbackUrl=${encodeURIComponent('/checkout/review')}`
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
                    discount={
                      appliedCoupon
                        ? formatPrice(appliedCoupon.discountAmount)
                        : null
                    }
                    total={formatPrice(
                      pricingSummary.total -
                        (appliedCoupon?.discountAmount ?? 0)
                    )}
                  />
                </div>

                <div className="rounded-2xl border border-dashed border-[var(--border-warm)] px-4 py-3">
                  <label
                    htmlFor={couponInputId}
                    className="text-xs font-medium text-[var(--text-secondary)]"
                  >
                    Promo / coupon code
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id={couponInputId}
                      value={couponCode}
                      onChange={(event) => setCouponCode(event.target.value)}
                      disabled={appliedCoupon !== null}
                      placeholder="Enter code"
                      className="w-full rounded-xl border border-[var(--border-warm)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--text-muted)] focus:border-[var(--accent-warm)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 disabled:opacity-60"
                    />
                    {appliedCoupon ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveCoupon}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        onClick={handleApplyCoupon}
                        loading={applyingCoupon}
                        loadingText="Checking…"
                        disabled={!couponCode.trim()}
                      >
                        Apply
                      </Button>
                    )}
                  </div>
                  {appliedCoupon ? (
                    <p className="mt-2 text-xs text-[var(--accent-sage)]">
                      {appliedCoupon.code} applied — you save{' '}
                      {formatPrice(appliedCoupon.discountAmount)}.
                    </p>
                  ) : null}
                  {couponError ? (
                    <p className="mt-2 text-xs text-red-600" role="alert">
                      {couponError}
                    </p>
                  ) : null}
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
              <Button
                type="button"
                onClick={() => router.push('/checkout/payment')}
                disabled={!isAcknowledged || policyUnavailable}
              >
                Continue to Payment
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
