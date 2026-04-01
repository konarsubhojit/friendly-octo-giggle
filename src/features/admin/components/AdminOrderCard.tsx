"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import { OrderStatus } from "@/lib/types";
import { Badge, orderStatusVariant } from "@/components/ui/Badge";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { countOrderUnits, summarizeOrderProducts } from "@/features/orders/services/order-summary";

interface AdminOrderItem {
  id: string;
  quantity: number;
  price: number;
  customizationNote?: string | null;
  product?: { id: string; name: string; image: string };
  variation?: { id: string; name: string; price: number } | null;
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
}

function OrderItemRow({ item }: OrderItemRowProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {item.product?.name || "Unknown Product"}
        </p>
        <Badge variant="neutral" size="sm">
          Qty {item.quantity}
        </Badge>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
        {item.variation && (
          <p className="text-blue-600 dark:text-blue-400">
            {item.variation.name}
          </p>
        )}
        <p>{item.quantity === 1 ? "Single unit" : `${item.quantity} units`}</p>
        {item.customizationNote && (
          <p className="inline-block rounded bg-amber-50 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            ✏️ {item.customizationNote}
          </p>
        )}
      </div>
    </div>
  );
}

interface ShippingInfoSectionProps {
  readonly orderId: string;
  readonly orderStatus: string;
  readonly order: AdminOrder;
  readonly edit: { trackingNumber: string; shippingProvider: string };
  readonly savingShippingId: string | null;
  readonly onShippingFieldChange: AdminOrderCardProps["onShippingFieldChange"];
  readonly onSaveShipping: AdminOrderCardProps["onSaveShipping"];
}

function ShippingInfoSection({
  orderId,
  orderStatus,
  order,
  edit,
  savingShippingId,
  onShippingFieldChange,
  onSaveShipping,
}: ShippingInfoSectionProps) {
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
}

export function AdminOrderCard({
  order,
  updatingOrderId,
  savingShippingId,
  edit,
  onStatusChange,
  onShippingFieldChange,
  onSaveShipping,
}: AdminOrderCardProps) {
  const hasTracking = Boolean(order.trackingNumber || order.shippingProvider);
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const itemCount = countOrderUnits(order.items);
  const productSummary = summarizeOrderProducts(order.items);

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
  const detailsId = `order-details-${order.id}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-gray-800">
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

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant={orderStatusVariant(order.status)}>
              {order.status}
            </Badge>
            {hasTracking ? (
              <Badge variant="sage" size="sm">
                Tracking attached
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Shipping pending
              </Badge>
            )}
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
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
            {productSummary}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium text-gray-900 dark:text-white">
              {order.customerName}
            </span>
            <span>{order.customerEmail}</span>
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
            <span>Order #{order.id.toUpperCase()}</span>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {new Date(order.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start lg:self-auto">
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
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            aria-expanded={isExpanded}
            aria-controls={detailsId}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
          >
            {isExpanded ? "Hide details" : "Show details"}
            <svg
              className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div id={detailsId} className="space-y-4">
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
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
              <h4 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
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

          <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Ordered products
              </h4>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
                Pricing in order details
              </p>
            </div>
            <div className="space-y-2">
              {order.items.map((item) => (
                <OrderItemRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Expand for details.
        </p>
      )}
    </div>
  );
}
