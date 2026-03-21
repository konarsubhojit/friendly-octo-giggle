"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { OrderStatus } from "@/lib/types";
import { Badge, orderStatusVariant } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

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
    field: "trackingNumber" | "shippingProvider",
    value: string,
    order: AdminOrder,
  ) => void;
  readonly onSaveShipping: (
    orderId: string,
    status: string,
    order: AdminOrder,
  ) => void;
}

interface OrderItemRowProps {
  readonly item: AdminOrderItem;
  readonly formatPrice: (amount: number) => string;
}

const OrderItemRow = ({ item, formatPrice }: OrderItemRowProps) => {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <div className="flex-1">
        <p className="font-medium text-sm text-gray-900 dark:text-white">
          {item.product?.name || "Unknown Product"}
        </p>
        {item.variation && (
          <p className="text-xs text-blue-600 dark:text-blue-400">
            {item.variation.name}
          </p>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatPrice(item.price)} × {item.quantity}
        </p>
        {item.customizationNote && (
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 inline-block mt-1 px-2 py-0.5 rounded">
            ✏️ {item.customizationNote}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="font-semibold text-gray-900 dark:text-white">
          {formatPrice(item.price * item.quantity)}
        </p>
      </div>
    </div>
  );
};

interface ShippingInfoSectionProps {
  readonly orderId: string;
  readonly orderStatus: string;
  readonly order: AdminOrder;
  readonly edit: { trackingNumber: string; shippingProvider: string };
  readonly savingShippingId: string | null;
  readonly onShippingFieldChange: AdminOrderCardProps["onShippingFieldChange"];
  readonly onSaveShipping: AdminOrderCardProps["onSaveShipping"];
}

const ShippingInfoSection = ({
  orderId,
  orderStatus,
  order,
  edit,
  savingShippingId,
  onShippingFieldChange,
  onSaveShipping,
}: ShippingInfoSectionProps) => {
  return (
    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg">
      <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">
        Shipping Information
      </h4>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 w-full">
          <label
            htmlFor={`tracking-${orderId}`}
            className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            Tracking Number
          </label>
          <input
            id={`tracking-${orderId}`}
            type="text"
            value={edit.trackingNumber}
            onChange={(e) =>
              onShippingFieldChange(
                orderId,
                "trackingNumber",
                e.target.value,
                order,
              )
            }
            placeholder="e.g. 1Z999AA10123456784"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1 w-full">
          <label
            htmlFor={`provider-${orderId}`}
            className="block text-xs text-gray-500 dark:text-gray-400 mb-1"
          >
            Shipping Provider
          </label>
          <input
            id={`provider-${orderId}`}
            type="text"
            value={edit.shippingProvider}
            onChange={(e) =>
              onShippingFieldChange(
                orderId,
                "shippingProvider",
                e.target.value,
                order,
              )
            }
            placeholder="e.g. FedEx, UPS, USPS"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => onSaveShipping(orderId, orderStatus, order)}
          disabled={savingShippingId === orderId}
          className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:bg-gray-400 transition whitespace-nowrap"
        >
          {savingShippingId === orderId ? "Saving…" : "Save Shipping"}
        </button>
      </div>
    </div>
  );
};

export const AdminOrderCard = ({
  order,
  updatingOrderId,
  savingShippingId,
  edit,
  formatPrice,
  onStatusChange,
  onShippingFieldChange,
  onSaveShipping,
}: AdminOrderCardProps) => {
  const hasTracking = Boolean(order.trackingNumber || order.shippingProvider);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);

  const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
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
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
      <ConfirmDialog
        isOpen={pendingStatus !== null}
        title="Change Order Status"
        message={`Update this order from "${order.status}" to "${pendingStatus ?? ""}"?`}
        confirmLabel="Yes, update"
        variant="warning"
        loading={updatingOrderId === order.id}
        onConfirm={handleConfirmStatus}
        onCancel={handleCancelStatus}
      />

      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            {hasTracking && (
              <span
                role="img"
                aria-label="Tracking info available"
                title="Tracking info available"
                className="mr-1"
              >
                📦
              </span>
            )}
            Order #{order.id.toUpperCase()}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {new Date(order.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
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
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={updatingOrderId !== null}
              aria-label={`Change status for order ${order.id}`}
            >
              {Object.values(OrderStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">
            Customer
          </h4>
          <p className="text-sm text-gray-900 dark:text-white">
            {order.customerName}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {order.customerEmail}
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">
            Shipping Address
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {order.customerAddress}
          </p>
        </div>
      </div>

      <ShippingInfoSection
        orderId={order.id}
        orderStatus={order.status}
        order={order}
        edit={edit}
        savingShippingId={savingShippingId}
        onShippingFieldChange={onShippingFieldChange}
        onSaveShipping={onSaveShipping}
      />

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">
          Items ({order.items.length})
        </h4>
        <div className="space-y-2">
          {order.items.map((item) => (
            <OrderItemRow key={item.id} item={item} formatPrice={formatPrice} />
          ))}
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 mt-3 pt-3 flex justify-between items-center">
          <span className="font-bold text-lg text-gray-900 dark:text-white">
            Total
          </span>
          <span className="font-bold text-xl text-gray-900 dark:text-white">
            {formatPrice(order.totalAmount)}
          </span>
        </div>
      </div>
    </div>
  );
};
