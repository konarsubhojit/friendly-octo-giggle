'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSelector, useDispatch } from 'react-redux'
import {
  clearPendingCheckout,
  readPendingCheckout,
  type PendingCheckout,
} from '@/features/cart/pending-checkout'
import toast from 'react-hot-toast'
import {
  clearCart,
  selectCart,
  fetchCart,
} from '@/features/cart/store/cartSlice'
import { apiClient, ApiError } from '@/lib/api-client'
import type { AppDispatch } from '@/lib/store'
import type {
  CheckoutEnqueueResponse,
  CheckoutRequestStatusResponse,
} from '@/lib/types'
import { useCurrency } from '@/contexts/CurrencyContext'
import {
  buildCheckoutPricingSummaryFromLineItems,
  buildCheckoutSummaryLineItems,
} from '@/features/orders/services/order-summary'
import { CheckoutProgress } from '@/features/cart/components/CheckoutProgress'
import { CartPricingSummary } from '@/features/cart/components/CartPricingSummary'
import { Button } from '@/components/ui/Button'
import { GradientHeading } from '@/components/ui/GradientHeading'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import Link from 'next/link'

const CHECKOUT_POLL_INITIAL_INTERVAL_MS = 2_000
const CHECKOUT_POLL_MAX_INTERVAL_MS = 15_000
const CHECKOUT_POLL_BACKOFF_FACTOR = 1.5
const CHECKOUT_POLL_MAX_ATTEMPTS = 20

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

interface CouponPreviewResponse {
  data: {
    couponCode: string
    subtotal: number
    discountAmount: number
    total: number
  }
}

const SECTION_CLASS =
  'rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] p-5 sm:p-6'

export default function CheckoutPaymentPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const dispatch = useDispatch<AppDispatch>()
  const cart = useSelector(selectCart)
  const { formatPrice } = useCurrency()

  const [isPending, startTransition] = useTransition()
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [pendingCheckout] = useState<PendingCheckout | null>(() =>
    readPendingCheckout()
  )
  const [couponDiscount, setCouponDiscount] = useState(0)

  useEffect(() => {
    if (!pendingCheckout) {
      router.replace('/cart')
    }
  }, [pendingCheckout, router])

  useEffect(() => {
    if (status === 'authenticated') {
      dispatch(fetchCart())
    }
  }, [dispatch, status])

  // Preview only: the authoritative discount is recomputed server-side.
  useEffect(() => {
    const code = pendingCheckout?.couponCode
    if (status !== 'authenticated' || !code) {
      return
    }

    let cancelled = false
    apiClient
      .post<CouponPreviewResponse>('/api/cart/coupon', { couponCode: code })
      .then((response) => {
        if (!cancelled) setCouponDiscount(response.data.discountAmount)
      })
      .catch(() => {
        if (!cancelled) setCouponDiscount(0)
      })

    return () => {
      cancelled = true
    }
  }, [pendingCheckout?.couponCode, status])

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
    () =>
      buildCheckoutPricingSummaryFromLineItems(lineItems, {
        destination: pendingCheckout
          ? { state: pendingCheckout.state, pinCode: pendingCheckout.pinCode }
          : null,
        shippingMethod: pendingCheckout?.shippingMethod,
      }),
    [lineItems, pendingCheckout]
  )

  const pollCheckoutRequest = async (
    checkoutRequestId: string
  ): Promise<CheckoutRequestStatusResponse> => {
    for (let attempt = 0; attempt < CHECKOUT_POLL_MAX_ATTEMPTS; attempt++) {
      try {
        const checkoutStatus =
          await apiClient.get<CheckoutRequestStatusResponse>(
            `/api/checkout/${checkoutRequestId}`
          )

        if (checkoutStatus.status === 'COMPLETED') {
          return checkoutStatus
        }

        if (checkoutStatus.status === 'FAILED') {
          throw new Error(checkoutStatus.error ?? 'Checkout failed')
        }

        setCheckoutMessage("We're processing your order…")
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
          // Honour the Retry-After header so we don't burn through the budget.
          const waitMs = Math.max(error.retryAfter ?? 60, 1) * 1000
          setCheckoutMessage('Please wait a moment before retrying…')
          await delay(waitMs)
          continue
        }
        // Any other error (including FAILED status above) bubbles up.
        throw error
      }

      // Exponential backoff: start fast to catch quick completions, then slow
      // down to avoid hitting the rate limiter on longer Inngest runs.
      const nextInterval = Math.min(
        CHECKOUT_POLL_INITIAL_INTERVAL_MS *
          Math.pow(CHECKOUT_POLL_BACKOFF_FACTOR, attempt),
        CHECKOUT_POLL_MAX_INTERVAL_MS
      )
      await delay(nextInterval)
    }

    throw new Error(
      'Checkout is taking longer than expected. Please check your orders shortly.'
    )
  }

  const handleConfirm = () => {
    if (!pendingCheckout) return
    const sessionUser = session?.user

    if (!sessionUser?.email) {
      router.push(
        `${'/auth/signin'}?callbackUrl=${encodeURIComponent('/checkout/payment')}`
      )
      return
    }

    startTransition(async () => {
      try {
        setCheckoutError(null)
        setCheckoutMessage('Submitting your order…')

        const enqueueResult = await apiClient.post<CheckoutEnqueueResponse>(
          '/api/checkout',
          {
            customerName: sessionUser.name ?? 'Customer',
            customerEmail: sessionUser.email,
            addressLine1: pendingCheckout.addressLine1.trim(),
            addressLine2: pendingCheckout.addressLine2.trim(),
            addressLine3: pendingCheckout.addressLine3.trim(),
            pinCode: pendingCheckout.pinCode.trim(),
            city: pendingCheckout.city.trim(),
            state: pendingCheckout.state.trim(),
            shippingMethod: pendingCheckout.shippingMethod,
            items: cartItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              customizationNote:
                pendingCheckout.customizationNotes[item.id] ?? undefined,
            })),
            // Only the code travels to the server; the discount itself is
            // always recomputed there.
            couponCode: pendingCheckout.couponCode ?? undefined,
          }
        )

        const completedCheckout = await pollCheckoutRequest(
          enqueueResult.checkoutRequestId
        )

        if (!completedCheckout.orderId) {
          throw new Error('Checkout completed without an order reference.')
        }

        await dispatch(clearCart()).unwrap()
        clearPendingCheckout()
        toast.success(`Order ${completedCheckout.orderId} placed successfully!`)
        router.push(
          `${'/checkout/confirmation'}?orderId=${encodeURIComponent(completedCheckout.orderId)}`
        )
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to place order'
        setCheckoutError(message)
        toast.error(message)
      } finally {
        setCheckoutMessage(null)
      }
    })
  }

  if (pendingCheckout === null || status === 'loading') {
    return (
      <div className="min-h-screen bg-warm-gradient flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session?.user) {
    router.replace(
      `${'/auth/signin'}?callbackUrl=${encodeURIComponent('/checkout/payment')}`
    )
    return null
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <CheckoutProgress currentStep="payment" />
        <GradientHeading className="mb-2">Payment</GradientHeading>
        <p className="mb-8 text-sm text-[var(--text-secondary)]">
          Review your order total and confirm your purchase.
        </p>

        <div className="space-y-6">
          {/* Order Total */}
          <section className={SECTION_CLASS}>
            <h2 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
              Amount Due
            </h2>
            <div className="rounded-2xl bg-[var(--accent-blush)]/40 p-4">
              <CartPricingSummary
                summary={pricingSummary}
                formatPrice={formatPrice}
                discountAmount={couponDiscount}
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

          {/* Error */}
          {checkoutError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
              <p>{checkoutError}</p>
              <button
                type="button"
                onClick={handleConfirm}
                aria-label="Retry checkout after error"
                className="mt-2 text-xs font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-rose)]"
              >
                Retry checkout
              </button>
            </div>
          ) : null}

          {checkoutMessage ? (
            <output
              className="block text-xs text-[var(--text-muted)]"
              aria-live="polite"
            >
              {checkoutMessage}
            </output>
          ) : null}

          {/* Navigation */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/checkout/review"
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border-warm)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors"
            >
              Back
            </Link>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              loading={isPending}
              loadingText={checkoutMessage ?? 'Processing...'}
            >
              Confirm and Place Order
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
