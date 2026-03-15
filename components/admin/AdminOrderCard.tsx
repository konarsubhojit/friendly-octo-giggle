'use client';

import { useState } from 'react';
import { OrderStatus } from '@/lib/types';
import { Badge, orderStatusVariant } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface AdminOrderItem {
  id: string;
  quantity: number;
  price: number;
  customizationNote?: string | null;
  product?: { id: string; name: string; image: string };
  variation?: { id: string; name: string; priceModifier: number } | null;
}

interface AdminOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  totalAmount: number;
  status: string;
  trackingNumber?: string | null;
  shippingProvider?: string | null;
  createdAt: string;
  items: AdminOrderItem[];
}

interface AdminOrderCardProps {
  readonly order: AdminOrder;
  readonly updatingOrderId: string | null;
  readonly savingShippingId: string | null;
  readonly edit: { trackingNumber: string; shippingProvider: string };
  readonly formatPrice: (amount: number) => string;
  readonly onStatusChange: (orderId: string, status: OrderStatus) => void;
  readonly onShippingFieldChange: (
    orderId: string,
    field: 'trackingNumber' | 'shippingProvider',
    value: string,
    order: AdminOrder,
  ) => void;
  readonly onSaveShipping: (orderId: string, status: string, order: AdminOrder) => void;
}

export function AdminOrderCard({
  order,
  updatingOrderId,
  savingShippingId,
  edit,
  formatPrice,
  onStatusChange,
  onShippingFieldChange,
  onSaveShipping,
}: AdminOrderCardProps) {
  const hasTracking = Boolean(order.trackingNumber || order.shippingProvider);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as OrderStatus;
    if (newStatus !== order.status) {
      setPendingStatus(newStatus);
    }
  };

  const handleConfirmStatus = () => {
    if (pendingStatus) {
      onStatusChange(order.id, pendingStatus);
      setPendingStatus(null);
    }
  };

  const handleCancelStatus = () => setPendingStatus(null);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <ConfirmDialog
        isOpen={pendingStatus !== null}
        title="Change Order Status"
        message={`Update this order from "${order.status}" to "${pendingStatus ?? ''}"?`}
        confirmLabel="Yes, update"
        variant="warning"
        loading={updatingOrderId === order.id}
        onConfirm={handleConfirmStatus}
        onCancel={handleCancelStatus}
      />

      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-lg">
            {hasTracking && <span role="img" aria-label="Tracking info available" title="Tracking info available" className="mr-1">📦</span>}
            Order #{order.id.toUpperCase()}
          </h3>
          <p className="text-sm text-gray-600">
            {new Date(order.createdAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={orderStatusVariant(order.status)}>
            {order.status}
          </Badge>
          {updatingOrderId === order.id ? (
            <LoadingSpinner size="h-5 w-5" />
          ) : (
            <select
              value={order.status}
              onChange={handleSelectChange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={updatingOrderId !== null}
              aria-label={`Change status for order ${order.id}`}
            >
              {Object.values(OrderStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-1">Customer</h4>
          <p className="text-sm">{order.customerName}</p>
          <p className="text-sm text-gray-600">{order.customerEmail}</p>
        </div>
        <div>
          <h4 className="font-semibold text-sm text-gray-700 mb-1">Shipping Address</h4>
          <p className="text-sm text-gray-600">{order.customerAddress}</p>
        </div>
      </div>

      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="font-semibold text-sm text-gray-700 mb-2">Shipping Information</h4>
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label htmlFor={`tracking-${order.id}`} className="block text-xs text-gray-500 mb-1">
              Tracking Number
            </label>
            <input
              id={`tracking-${order.id}`}
              type="text"
              value={edit.trackingNumber}
              onChange={(e) => onShippingFieldChange(order.id, 'trackingNumber', e.target.value, order)}
              placeholder="e.g. 1Z999AA10123456784"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 w-full">
            <label htmlFor={`provider-${order.id}`} className="block text-xs text-gray-500 mb-1">
              Shipping Provider
            </label>
            <input
              id={`provider-${order.id}`}
              type="text"
              value={edit.shippingProvider}
              onChange={(e) => onShippingFieldChange(order.id, 'shippingProvider', e.target.value, order)}
              placeholder="e.g. FedEx, UPS, USPS"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => onSaveShipping(order.id, order.status, order)}
            disabled={savingShippingId === order.id}
            className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400 transition whitespace-nowrap"
          >
            {savingShippingId === order.id ? 'Saving…' : 'Save Shipping'}
          </button>
        </div>
      </div>

      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3">Items ({order.items.length})</h4>
        <div className="space-y-2">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
              <div className="flex-1">
                <p className="font-medium text-sm">{item.product?.name || 'Unknown Product'}</p>
                {item.variation && (
                  <p className="text-xs text-blue-600">{item.variation.name}</p>
                )}
                <p className="text-xs text-gray-500">
                  {formatPrice(item.price)} × {item.quantity}
                </p>
                {item.customizationNote && (
                  <p className="text-xs text-amber-700 bg-amber-50 inline-block mt-1 px-2 py-0.5 rounded">
                    ✏️ {item.customizationNote}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatPrice(item.price * item.quantity)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t mt-3 pt-3 flex justify-between items-center">
          <span className="font-bold text-lg">Total</span>
          <span className="font-bold text-xl text-gray-900">{formatPrice(order.totalAmount)}</span>
        </div>
      </div>
    </div>
  );
}
