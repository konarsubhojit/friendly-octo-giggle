'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSelector, useDispatch } from 'react-redux'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { useLocale } from '@/contexts/LocaleContext'
import {
  clearCart,
  selectCart,
  fetchCart,
} from '@/features/cart/store/cartSlice'
import { apiClient } from '@/lib/api-client'
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
import { GradientButton } from '@/components/ui/GradientButton'
import { GradientHeading } from '@/components/ui/GradientHeading'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import Link from '@/components/ui/LocaleLink'

const CHECKOUT_POLL_INTERVAL_MS = 1500
const CHECKOUT_POLL_MAX_ATTEMPTS = 40
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

function clearPendingCheckout(): void {
  if (globalThis.window === undefined) return
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

const SECTION_CLASS =
  'rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] p-5 sm:p-6'

export default function CheckoutPaymentPage() {
  const router = useRouter()
  const { localizePath } = useLocale()
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

  useEffect(() => {
    if (!pendingCheckout) {
      router.replace(localizePath('/cart'))
    }
  }, [pendingCheckout, router, localizePath])

  useEffect(() => {
    if (status === 'authenticated') {
      dispatch(fetchCart())
    }
  }, [dispatch, status])

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

  const pollCheckoutRequest = async (
    checkoutRequestId: string
  ): Promise<CheckoutRequestStatusResponse> => {
    for (let attempt = 0; attempt < CHECKOUT_POLL_MAX_ATTEMPTS; attempt++) {
      const checkoutStatus = await apiClient.get<CheckoutRequestStatusResponse>(
        `/api/checkout/${checkoutRequestId}`
      )

      if (checkoutStatus.status === 'COMPLETED') {
        return checkoutStatus
      }

      if (checkoutStatus.status === 'FAILED') {
        throw new Error(checkoutStatus.error ?? 'Checkout failed')
      }

      setCheckoutMessage("We're processing your order…")

      await delay(CHECKOUT_POLL_INTERVAL_MS)
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
        `${localizePath('/auth/signin')}?callbackUrl=${encodeURIComponent(localizePath('/checkout/payment'))}`
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
            items: cartItems.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              customizationNote:
                pendingCheckout.customizationNotes[item.id] ?? undefined,
            })),
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
          `${localizePath('/checkout/confirmation')}?orderId=${encodeURIComponent(completedCheckout.orderId)}`
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
            <GradientButton
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              loading={isPending}
              loadingText={checkoutMessage ?? 'Processing...'}
            >
              Confirm and Place Order
            </GradientButton>
          </div>
        </div>
      </main>
    </div>
  )
}
