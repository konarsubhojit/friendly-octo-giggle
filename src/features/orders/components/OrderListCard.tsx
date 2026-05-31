'use client'

import Link from '@/components/ui/LocaleLink'
import Image from 'next/image'
import { Badge, orderStatusVariant } from '@/components/ui/Badge'
import { useCurrency } from '@/contexts/CurrencyContext'
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
    sku: string | null
    price: number
  } | null
}

interface OrderSummary {
  readonly id: string
  readonly status: string
  readonly createdAt: string
  readonly totalAmount: number
  readonly items: OrderItem[]
}

interface OrderListCardProps {
  readonly order: OrderSummary
}

const ProductThumbnails = ({ items }: { readonly items: OrderItem[] }) => {
  const images = items
    .map((item) =>
      item.product?.image
        ? {
            key: `${item.product.name}|${item.product.image}|${item.variant?.id ?? 'base'}|${item.quantity}|${item.variant?.price ?? 0}`,
            src: item.product.image,
          }
        : null
    )
    .filter((item): item is { key: string; src: string } => Boolean(item))
    .slice(0, 3)

  if (images.length === 0) return null

  return (
    <div className="flex -space-x-2 flex-shrink-0">
      {images.map(({ key, src }, index) => (
        <div
          key={key}
          className="relative w-10 h-10 rounded-lg overflow-hidden border-2 border-[var(--surface)] bg-[var(--accent-cream)]"
          style={{ zIndex: images.length - index }}
        >
          <Image src={src} alt="" fill sizes="40px" className="object-cover" />
        </div>
      ))}
      {items.length > 3 && (
        <div className="relative w-10 h-10 rounded-lg border-2 border-[var(--surface)] bg-[var(--accent-blush)] flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[var(--accent-rose)]">
            +{items.length - 3}
          </span>
        </div>
      )}
    </div>
  )
}

export const OrderListCard = ({ order }: OrderListCardProps) => {
  const { formatPrice } = useCurrency()
  const statusInfo = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING
  const itemCount = countOrderUnits(order.items)
  const productSummary = summarizeOrderProducts(order.items)

  return (
    <Link
      href={`/orders/${order.id}`}
      className="block rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)] p-5 shadow-warm transition-all duration-300 hover:scale-[1.01] hover:shadow-warm-lg"
    >
      <div className="flex items-center gap-4">
        <ProductThumbnails items={order.items} />

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
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
            <span className="text-xs text-[var(--text-muted)]">
              · Order #{order.id}
            </span>
          </div>

          <p className="truncate text-sm font-semibold text-[var(--foreground)]">
            {productSummary}
          </p>

          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 pl-2 flex-shrink-0">
          <p className="text-base font-bold text-[var(--foreground)]">
            {formatPrice(order.totalAmount)}
          </p>
          <svg
            className="h-4 w-4 text-[var(--text-muted)]"
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
    </Link>
  )
}
