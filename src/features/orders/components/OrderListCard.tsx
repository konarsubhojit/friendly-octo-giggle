'use client'

import Link from 'next/link'
import { Badge, orderStatusVariant } from '@/components/ui/Badge'
import {
  countOrderUnits,
  summarizeOrderProducts,
} from '@/features/orders/services/order-summary'

const STATUS_CONFIG: Record<string, { label: string }> = {
  PENDING: { label: 'Pending' },
  PROCESSING: { label: 'Processing' },
  SHIPPED: { label: 'Shipped' },
  DELIVERED: { label: 'Delivered' },
  CANCELLED: { label: 'Cancelled' },
}

interface OrderItem {
  readonly quantity: number
  readonly product?: { name: string; image: string } | null
  readonly variant?: {
    id: string
    name: string
    price: number
  } | null
}

interface OrderSummary {
  readonly id: string
  readonly status: string
  readonly createdAt: string
  readonly items: OrderItem[]
}

interface OrderListCardProps {
  readonly order: OrderSummary
}

export const OrderListCard = ({ order }: OrderListCardProps) => {
  const statusInfo = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING
  const itemCount = countOrderUnits(order.items)
  const productSummary = summarizeOrderProducts(order.items)

  return (
    <Link
      href={`/orders/${order.id}`}
      className="block rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] p-6 shadow-warm transition-all duration-300 hover:scale-[1.01] hover:shadow-warm-lg"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Badge variant={orderStatusVariant(order.status)} size="sm">
              {statusInfo.label}
            </Badge>
            <span className="text-xs text-[var(--text-muted)]">
              {new Date(order.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
          <p className="truncate text-base font-semibold text-[var(--foreground)] sm:text-lg">
            {productSummary}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[var(--text-secondary)]">
            <span>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            <span className="text-[var(--text-muted)]">Order #{order.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 pl-2">
          <p className="hidden text-xs uppercase tracking-[0.24em] text-[var(--text-muted)] sm:block">
            View
          </p>
          <svg
            className="h-5 w-5 flex-shrink-0 text-[var(--text-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        Open the order to review pricing, shipping address, and full item
        details.
      </p>
    </Link>
  )
}
