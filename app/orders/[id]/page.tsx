"use client";

import { useEffect, useState, useRef, useCallback, use } from "react";
import type { ReactElement } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useSelector, useDispatch } from "react-redux";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  fetchOrderById,
  cancelOrder,
  selectCurrentOrder,
  selectOrderDetailLoading,
  selectOrdersError,
  selectOrderCancelling,
  clearCurrentOrder,
} from "@/lib/features/orders/ordersSlice";
import type { AppDispatch } from "@/lib/store";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AuthRequiredState } from "@/components/ui/AuthRequiredState";
import { Card } from "@/components/ui/Card";

interface CancelOrderDialogProps {
  readonly dialogRef: React.RefObject<HTMLDialogElement | null>;
  readonly cancelling: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

const CancelOrderDialog = ({
  dialogRef,
  cancelling,
  onClose,
  onConfirm,
}: CancelOrderDialogProps) => {
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cancel-dialog-title"
      onClose={onClose}
      className="backdrop:bg-black/40 backdrop:backdrop-blur-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4"
    >
      <h3
        id="cancel-dialog-title"
        className="text-lg font-bold text-[var(--foreground)] mb-2"
      >
        Cancel Order?
      </h3>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        This action cannot be undone. Your order will be cancelled immediately.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          disabled={cancelling}
          className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
        >
          Keep Order
        </button>
        <button
          onClick={onConfirm}
          disabled={cancelling}
          className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {cancelling ? "Cancelling..." : "Yes, Cancel"}
        </button>
      </div>
    </dialog>
  );
};

interface OrderDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

const STATUS_STEPS = ["PENDING", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Order Placed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_STEP_INDEX: Record<string, number> = {
  CANCELLED: -1,
  PENDING: 0,
  PROCESSING: 1,
  SHIPPED: 2,
  DELIVERED: 3,
};

const getStepIndex = (status: string): number => {
  return STATUS_STEP_INDEX[status] ?? -1;
};

const STEP_CLASSES = {
  completed: {
    status:
      "bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white shadow-lg",
    text: "text-[var(--accent-rose)]",
    connector:
      "bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)]",
  },
  default: {
    status: "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400",
    text: "text-gray-400 dark:text-gray-500",
    connector: "bg-gray-200 dark:bg-gray-700",
  },
} as const;

interface StatusTimelineProps {
  readonly currentStep: number;
  readonly isCancelled: boolean;
}

const StatusTimeline = ({ currentStep, isCancelled }: StatusTimelineProps) => {
  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
        <svg
          className="w-6 h-6 text-red-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-semibold text-red-700">
          This order has been cancelled
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      {STATUS_STEPS.map((step, index) => {
        const isCompleted = index <= currentStep;
        const isCurrent = index === currentStep;
        const classes = STEP_CLASSES[isCompleted ? "completed" : "default"];
        const connectorKey = index < currentStep ? "completed" : "default";
        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${classes.status}${isCurrent ? " ring-4 ring-[var(--accent-blush)]" : ""}`}
              >
                {isCompleted ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className={`text-xs mt-2 font-medium ${classes.text}`}>
                {STATUS_LABELS[step]}
              </span>
            </div>
            {index < STATUS_STEPS.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 rounded-full transition-all ${STEP_CLASSES[connectorKey].connector}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

interface OrderItemRowItem {
  readonly id: string;
  readonly productId: string;
  readonly quantity: number;
  readonly price: number;
  readonly customizationNote?: string | null;
  readonly product?: { id: string; name: string; image: string; price: number };
  readonly variation?: {
    id: string;
    name: string;
    image?: string;
    priceModifier: number;
  } | null;
}

interface OrderItemRowProps {
  readonly item: OrderItemRowItem;
  readonly formatPrice: (amount: number) => string;
}

const OrderItemRow = ({ item, formatPrice }: OrderItemRowProps) => {
  const image = item.variation?.image || item.product?.image;
  const sections: Record<string, ReactElement | null> = {
    image: image ? (
      <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
        <Image
          src={image}
          alt={item.product?.name || "Order item"}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
    ) : null,
    variation: item.variation ? (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {item.variation.name}
      </p>
    ) : null,
    customization: item.customizationNote ? (
      <div className="mt-2 ml-20 p-2 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          <span className="font-semibold">✏️ Customization:</span>{" "}
          {item.customizationNote}
        </p>
      </div>
    ) : null,
  };
  return (
    <div className="py-3 border-b border-[var(--border-warm)] last:border-0">
      <div className="flex items-center gap-4">
        {sections.image}
        <div className="flex-grow min-w-0">
          <Link
            href={`/products/${item.productId}`}
            className="text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent-rose)] transition-colors"
          >
            {item.product?.name}
          </Link>
          {sections.variation}
          <p className="text-xs text-[var(--text-muted)]">
            Qty: {item.quantity}
          </p>
        </div>
        <p className="text-sm font-bold text-[var(--foreground)]">
          {formatPrice(item.price * item.quantity)}
        </p>
      </div>
      {sections.customization}
    </div>
  );
};

interface OrderSummaryHeaderProps {
  readonly orderId: string;
  readonly createdAt: string;
  readonly totalAmount: number;
  readonly status: string;
  readonly cancelling: boolean;
  readonly formatPrice: (amount: number) => string;
  readonly onCancelClick: () => void;
}

const OrderSummaryHeader = ({
  orderId,
  createdAt,
  totalAmount,
  status,
  cancelling,
  formatPrice,
  onCancelClick,
}: OrderSummaryHeaderProps) => {
  return (
    <div className="flex justify-between items-start flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">
          Order #{orderId}
        </h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Placed on{" "}
          {new Date(createdAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className="text-2xl font-bold bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] bg-clip-text text-transparent">
          {formatPrice(totalAmount)}
        </p>
        {status === "PENDING" && (
          <button
            onClick={onCancelClick}
            disabled={cancelling}
            className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            Cancel Order
          </button>
        )}
      </div>
    </div>
  );
};

const OrderDetailPage = ({ params }: OrderDetailPageProps) => {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const { formatPrice } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const order = useSelector(selectCurrentOrder);
  const loading = useSelector(selectOrderDetailLoading);
  const error = useSelector(selectOrdersError);
  const cancelling = useSelector(selectOrderCancelling);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const cancelDialogRef = useRef<HTMLDialogElement>(null);

  const closeCancelDialog = useCallback(() => {
    setShowCancelConfirm(false);
  }, []);

  const handleCancelOrder = () => {
    dispatch(cancelOrder(id))
      .unwrap()
      .then(() => closeCancelDialog())
      .catch(() => {});
  };

  useEffect(() => {
    const dialog = cancelDialogRef.current;
    if (!dialog) return;
    if (showCancelConfirm) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [showCancelConfirm]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      dispatch(fetchOrderById(id));
    }
    return () => {
      dispatch(clearCurrentOrder());
    };
  }, [authStatus, id, dispatch]);

  if (authStatus === "loading" || loading) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <AuthRequiredState
            callbackUrl={`/orders/${id}`}
            message="Please sign in to view order details."
          />
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <Card className="p-12 text-center">
            <h2 className="text-2xl font-bold text-[var(--foreground)] mb-2">
              {error || "Order not found"}
            </h2>
            <Link
              href="/orders"
              className="mt-4 inline-block text-[var(--accent-rose)] hover:underline font-medium"
            >
              Back to My Orders
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === "CANCELLED";

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        {/* Back link */}
        <Link
          href="/orders"
          className="inline-flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-colors mb-6"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to My Orders
        </Link>

        {/* Order Header */}
        <Card className="p-8 mb-6">
          <OrderSummaryHeader
            orderId={order.id}
            createdAt={order.createdAt}
            totalAmount={order.totalAmount}
            status={order.status}
            cancelling={cancelling}
            formatPrice={formatPrice}
            onCancelClick={() => setShowCancelConfirm(true)}
          />

          {/* Cancel Confirmation Modal */}
          <CancelOrderDialog
            dialogRef={cancelDialogRef}
            cancelling={cancelling}
            onClose={closeCancelDialog}
            onConfirm={handleCancelOrder}
          />

          {/* Status Timeline */}
          <div className="mt-8">
            <StatusTimeline
              currentStep={currentStep}
              isCancelled={isCancelled}
            />
          </div>
        </Card>

        {/* Order Items */}
        <Card className="p-8 mb-6">
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
            Items
          </h2>
          <div className="space-y-4">
            {order.items.map((item) => (
              <OrderItemRow
                key={item.id}
                item={item}
                formatPrice={formatPrice}
              />
            ))}
          </div>
        </Card>

        {/* Tracking Info */}
        {(order.trackingNumber || order.shippingProvider) && (
          <Card className="p-8 mb-6">
            <h2 className="text-lg font-bold text-[var(--foreground)] mb-3">
              📦 Shipping &amp; Tracking
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {order.shippingProvider && (
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">
                    Shipping Provider
                  </p>
                  <p className="text-sm text-[var(--foreground)] font-medium">
                    {order.shippingProvider}
                  </p>
                </div>
              )}
              {order.trackingNumber && (
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase">
                    Tracking Number
                  </p>
                  <p className="text-sm text-[var(--foreground)] font-medium font-mono">
                    {order.trackingNumber}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Shipping Address */}
        <Card className="p-8">
          <h2 className="text-lg font-bold text-[var(--foreground)] mb-3">
            Shipping Address
          </h2>
          <p className="text-sm text-[var(--text-secondary)] whitespace-pre-line">
            {order.customerAddress}
          </p>
        </Card>
      </main>
    </div>
  );
};
export default OrderDetailPage;
