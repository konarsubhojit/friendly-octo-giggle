'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { CheckoutProgress } from '@/features/cart/components/CheckoutProgress'
import { GradientHeading } from '@/components/ui/GradientHeading'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { Order } from '@/lib/types'

export default function CheckoutConfirmationPage() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get('orderId')
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orderId) return

    const run = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`)
        const payload = (await res.json()) as {
          success?: boolean
          data?: { order?: Order }
          error?: string
        }

        if (!res.ok || !payload.success || !payload.data?.order) {
          setError(payload.error ?? 'Unable to load order confirmation.')
          return
        }

        setOrder(payload.data.order)
      } catch {
        setError('Unable to load order confirmation.')
      }
    }

    void run()
  }, [orderId])

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <CheckoutProgress currentStep="confirmation" />
        <GradientHeading className="mb-2">Order Confirmed</GradientHeading>
        <p className="mb-8 text-sm text-[var(--text-secondary)]">
          Thank you! We&apos;re processing your order now.
        </p>

        {!order && !error ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {order ? (
          <section className="rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] p-5 sm:p-6">
            <p className="text-sm text-[var(--text-secondary)]">
              Order ID:{' '}
              <span className="font-semibold text-[var(--foreground)]">
                {order.id}
              </span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3">
                  <span>{item.product.name}</span>
                  <span>× {item.quantity}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Tracking:{' '}
              {order.trackingNumber ? (
                <Link
                  href={`/orders/${order.id}`}
                  className="font-medium text-[var(--accent-rose)] hover:underline"
                >
                  {order.trackingNumber}
                </Link>
              ) : (
                'Will be shared once dispatched'
              )}
            </p>
          </section>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center rounded-xl border border-[var(--border-warm)] px-5 py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] transition-colors"
          >
            Continue shopping
          </Link>
          <Link
            href={order ? `/orders/${order.id}` : '/orders'}
            className="inline-flex items-center justify-center rounded-xl bg-[var(--accent-rose)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            View order
          </Link>
        </div>
      </main>
    </div>
  )
}
