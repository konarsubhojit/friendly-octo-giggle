'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Badge, orderStatusVariant } from '@/components/ui/Badge';

const STATUS_CONFIG: Record<string, { label: string }> = {
  PENDING: { label: 'Pending' },
  PROCESSING: { label: 'Processing' },
  SHIPPED: { label: 'Shipped' },
  DELIVERED: { label: 'Delivered' },
  CANCELLED: { label: 'Cancelled' },
};

interface OrderItem {
  readonly quantity: number;
  readonly product?: { name: string; image: string } | null;
  readonly variation?: { id: string; name: string; priceModifier: number } | null;
}

interface OrderSummary {
  readonly id: string;
  readonly status: string;
  readonly createdAt: string;
  readonly totalAmount: number;
  readonly items: OrderItem[];
}

interface OrderListCardProps {
  readonly order: OrderSummary;
  readonly formatPrice: (amount: number) => string;
}

export const OrderListCard = ({ order, formatPrice }: OrderListCardProps) => {
  const statusInfo = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const firstItem = order.items[0];
  const firstImage = firstItem?.product?.image;

  return (
    <Link
      href={`/orders/${order.id}`}
      className="block bg-[var(--surface)] backdrop-blur-lg rounded-xl shadow-warm border border-[var(--border-warm)] p-6 hover:shadow-warm-lg hover:scale-[1.01] transition-all duration-300"
    >
      <div className="flex items-center gap-6">
        {firstImage && (
          <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
            <Image
              src={firstImage}
              alt={firstItem?.product?.name || 'Order item'}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
        )}
        <div className="flex-grow min-w-0">
          <div className="flex items-center gap-3 mb-1">
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
          <p className="text-sm text-[var(--text-secondary)] truncate">
            {firstItem?.product?.name}
            {order.items.length > 1 && ` and ${order.items.length - 1} more`}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-lg font-bold text-[var(--foreground)]">
            {formatPrice(order.totalAmount)}
          </p>
          <p className="text-xs text-[var(--text-muted)]">Order #{order.id}</p>
        </div>
        <svg
          className="w-5 h-5 text-[var(--text-muted)] flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
};
