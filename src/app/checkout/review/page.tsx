'use client'

import { useId, useMemo, useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useSelector, useDispatch } from 'react-redux'
import Link from 'next/link'
import toast from 'react-hot-toast'
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

const CHECKOUT_POLL_INTERVAL_MS = 1500
const CHECKOUT_POLL_MAX_ATTEMPTS = 40
const PENDING_CHECKOUT_KEY = 'pending_checkout'

interface PendingCheckout {
  address: string
  customizationNotes: Record<string, string>
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms)
  })

function readPendingCheckout(): PendingCheckout | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY)
    return raw ? (JSON.parse(raw) as PendingCheckout) : null
  } catch {
    return null
  }
}

function clearPendingCheckout(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(PENDING_CHECKOUT_KEY)
}

const SECTION_CLASS =
  'rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] p-5 sm:p-6'

export default function CheckoutReviewPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const dispatch = useDispatch<AppDispatch>()
  const cart = useSelector(selectCart)
  const { formatPrice } = useCurrency()

  const [isPending, startTransition] = useTransition()
  const [isAcknowledged, setIsAcknowledged] = useState(false)
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null)
  const [pendingCheckout, setPendingCheckout] =
    useState<PendingCheckout | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  const acknowledgmentId = useId()

  useEffect(() => {
    const data = readPendingCheckout()
    if (!data) {
      router.replace('/cart')
      return
    }
    setPendingCheckout(data)
    setIsHydrated(true)
  }, [router])

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

  const policyUnavailable =
    lineItems.length === 0 ||
    Object.values(CHECKOUT_POLICIES).some(
      (section) => section.items.length === 0
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

      setCheckoutMessage('Processing your order...')

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
      router.push('/auth/signin?callbackUrl=/checkout/review')
      return
    }

    startTransition(async () => {
      try {
        setCheckoutMessage('Submitting your order...')

        const enqueueResult = await apiClient.post<CheckoutEnqueueResponse>(
          '/api/checkout',
          {
            customerName: sessionUser.name ?? 'Customer',
            customerEmail: sessionUser.email,
            customerAddress: pendingCheckout.address.trim(),
            items: cartItems.map((item) => ({
              productId: item.productId,
              variationId: item.variationId ?? undefined,
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
        router.push('/orders')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to place order'
        )
      } finally {
        setCheckoutMessage(null)
      }
    })
  }

  if (!isHydrated || status === 'loading') {
    return (
      <div className="min-h-screen bg-warm-gradient flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!session?.user) {
    router.replace('/auth/signin?callbackUrl=/checkout/review')
    return null
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <GradientHeading className="mb-2">Review Your Order</GradientHeading>
        <p className="mb-8 text-sm text-[var(--text-secondary)]">
          Review your order details and policy terms before confirming your
          purchase.
        </p>

        <div className="space-y-6">
          {/* Shipping Address */}
          <section className={SECTION_CLASS}>
            <h2 className="mb-3 text-lg font-semibold text-[var(--foreground)]">
              Shipping Address
            </h2>
            <p className="whitespace-pre-wrap text-sm text-[var(--text-secondary)]">
              {pendingCheckout?.address}
            </p>
            <Link
              href="/cart"
              className="mt-3 inline-block text-xs font-medium text-[var(--accent-rose)] hover:underline"
            >
              ← Edit address
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
                        key={`${item.name}-${item.variationLabel ?? 'default'}`}
                        className="rounded-2xl border border-[var(--border-warm)] bg-[var(--surface-raised)] px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-semibold text-[var(--foreground)]">
                              {item.name}
                            </h4>
                            {item.variationLabel ? (
                              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                                {item.variationLabel}
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
              </div>
            )}
          </section>

          {/* Acknowledgment & Confirm */}
          <div className={SECTION_CLASS}>
            <label
              htmlFor={acknowledgmentId}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-warm)] bg-[var(--surface-raised)] px-4 py-3 text-sm text-[var(--foreground)]"
            >
              <input
                id={acknowledgmentId}
                type="checkbox"
                checked={isAcknowledged}
                disabled={isPending || policyUnavailable}
                onChange={(event) => setIsAcknowledged(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--border-warm)] accent-[var(--accent-rose)]"
              />
              <span>{CHECKOUT_POLICY_ACKNOWLEDGMENT}</span>
            </label>

            {checkoutMessage ? (
              <output
                className="mt-3 block text-xs text-[var(--text-muted)]"
                aria-live="polite"
              >
                {checkoutMessage}
              </output>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link
                href="/cart"
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border-warm)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors"
              >
                Cancel
              </Link>
              <GradientButton
                type="button"
                onClick={handleConfirm}
                disabled={!isAcknowledged || isPending || policyUnavailable}
                loading={isPending}
                loadingText={checkoutMessage ?? 'Processing...'}
              >
                Confirm and Place Order
              </GradientButton>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
