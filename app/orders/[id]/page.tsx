'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import type { ReactElement } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useSelector, useDispatch } from 'react-redux';
import Header from '@/components/layout/Header';
import { useCurrency } from '@/contexts/CurrencyContext';
import { fetchOrderById, cancelOrder, selectCurrentOrder, selectOrderDetailLoading, selectOrdersError, selectOrderCancelling, clearCurrentOrder } from '@/lib/features/orders/ordersSlice';
import type { AppDispatch } from '@/lib/store';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AuthRequiredState } from '@/components/ui/AuthRequiredState';
import { Card } from '@/components/ui/Card';

interface OrderDetailPageProps {
  readonly params: Promise<{ id: string }>;
}

const STATUS_STEPS = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Order Placed',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

const STATUS_STEP_INDEX: Record<string, number> = {
  CANCELLED: -1,
  PENDING: 0,
  PROCESSING: 1,
  SHIPPED: 2,
  DELIVERED: 3,
};

function getStepIndex(status: string): number {
  return STATUS_STEP_INDEX[status] ?? -1;
}

const STEP_CLASSES = {
  completed: {
    status: 'bg-gradient-to-r from-[#e8a87c] to-[#d4856b] text-white shadow-lg',
    text: 'text-[#d4856b]',
    connector: 'bg-gradient-to-r from-[#e8a87c] to-[#d4856b]',
  },
  default: {
    status: 'bg-gray-200 text-gray-500',
    text: 'text-gray-400',
    connector: 'bg-gray-200',
  },
} as const;

interface StatusTimelineProps {
  readonly currentStep: number;
  readonly isCancelled: boolean;
}

function StatusTimeline({ currentStep, isCancelled }: StatusTimelineProps) {
  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
        <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
        <span className="font-semibold text-red-700">This order has been cancelled</span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      {STATUS_STEPS.map((step, index) => {
        const isCompleted = index <= currentStep;
        const isCurrent = index === currentStep;
        const classes = STEP_CLASSES[isCompleted ? 'completed' : 'default'];
        const connectorKey = index < currentStep ? 'completed' : 'default';
        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${classes.status}${isCurrent ? ' ring-4 ring-[#fde8d8]' : ''}`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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
}

interface OrderItemRowItem {
  readonly id: string;
  readonly productId: string;
  readonly quantity: number;
  readonly price: number;
  readonly customizationNote?: string | null;
  readonly product?: { id: string; name: string; image: string; price: number };
  readonly variation?: { id: string; name: string; image?: string; priceModifier: number } | null;
}

interface OrderItemRowProps {
  readonly item: OrderItemRowItem;
  readonly formatPrice: (amount: number) => string;
}

function OrderItemRow({ item, formatPrice }: OrderItemRowProps) {
  const image = item.variation?.image || item.product?.image;
  const sections: Record<string, ReactElement | null> = {
    image: image ? (
      <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
        <Image src={image} alt={item.product?.name || 'Order item'} fill sizes="80px" className="object-cover" />
      </div>
    ) : null,
    variation: item.variation ? (
      <p className="text-xs text-gray-500">
        {item.variation.name}
      </p>
    ) : null,
    customization: item.customizationNote ? (
      <div className="mt-2 ml-20 p-2 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-xs text-amber-800">
          <span className="font-semibold">✏️ Customization:</span>{' '}
          {item.customizationNote}
        </p>
      </div>
    ) : null
  };
  return (
    <div className="py-3 border-b border-[#f0d5c0] last:border-0">
      <div className="flex items-center gap-4">
        {sections.image}
        <div className="flex-grow min-w-0">
          <Link
            href={`/products/${item.productId}`}
            className="text-sm font-semibold text-[#4a3728] hover:text-[#d4856b] transition-colors"
          >
            {item.product?.name}
          </Link>
          {sections.variation}
          <p className="text-xs text-[#b89a85]">Qty: {item.quantity}</p>
        </div>
        <p className="text-sm font-bold text-[#4a3728]">{formatPrice(item.price * item.quantity)}</p>
      </div>
      {sections.customization}
    </div>
  );
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
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
    if (authStatus === 'authenticated') {
      dispatch(fetchOrderById(id));
    }
    return () => {
      dispatch(clearCurrentOrder());
    };
  }, [authStatus, id, dispatch]);

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
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
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
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
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <Card className="p-12 text-center">
            <h2 className="text-2xl font-bold text-[#4a3728] mb-2">{error || 'Order not found'}</h2>
            <Link href="/orders" className="mt-4 inline-block text-[#d4856b] hover:underline font-medium">
              Back to My Orders
            </Link>
          </Card>
        </main>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Back link */}
        <Link href="/orders" className="inline-flex items-center gap-2 text-[#7a6355] hover:text-[#d4856b] transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to My Orders
        </Link>

        {/* Order Header */}
        <Card className="p-8 mb-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#4a3728]">Order #{order.id}</h1>
              <p className="text-sm text-[#b89a85] mt-1">
                Placed on{' '}
                {new Date(order.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-bold bg-gradient-to-r from-[#e8a87c] to-[#d4856b] bg-clip-text text-transparent">
                {formatPrice(order.totalAmount)}
              </p>
              {order.status === 'PENDING' && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={cancelling}
                  className="px-4 py-2 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  Cancel Order
                </button>
              )}
            </div>
          </div>

          {/* Cancel Confirmation Modal */}
          <dialog
            ref={cancelDialogRef}
            aria-labelledby="cancel-dialog-title"
            onClose={closeCancelDialog}
            className="backdrop:bg-black/40 backdrop:backdrop-blur-sm bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4"
          >
            <h3 id="cancel-dialog-title" className="text-lg font-bold text-[#4a3728] mb-2">Cancel Order?</h3>
            <p className="text-sm text-[#7a6355] mb-6">This action cannot be undone. Your order will be cancelled immediately.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={closeCancelDialog}
                disabled={cancelling}
                className="px-4 py-2 text-sm font-medium text-[#7a6355] bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </dialog>

          {/* Status Timeline */}
          <div className="mt-8">
            <StatusTimeline currentStep={currentStep} isCancelled={isCancelled} />
          </div>
        </Card>

        {/* Order Items */}
        <Card className="p-8 mb-6">
          <h2 className="text-lg font-bold text-[#4a3728] mb-4">Items</h2>
          <div className="space-y-4">
            {order.items.map((item) => (
              <OrderItemRow key={item.id} item={item} formatPrice={formatPrice} />
            ))}
          </div>
        </Card>

        {/* Tracking Info */}
        {(order.trackingNumber || order.shippingProvider) && (
          <Card className="p-8 mb-6">
            <h2 className="text-lg font-bold text-[#4a3728] mb-3">📦 Shipping &amp; Tracking</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {order.shippingProvider && (
                <div>
                  <p className="text-xs font-semibold text-[#b89a85] uppercase">Shipping Provider</p>
                  <p className="text-sm text-[#4a3728] font-medium">{order.shippingProvider}</p>
                </div>
              )}
              {order.trackingNumber && (
                <div>
                  <p className="text-xs font-semibold text-[#b89a85] uppercase">Tracking Number</p>
                  <p className="text-sm text-[#4a3728] font-medium font-mono">{order.trackingNumber}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Shipping Address */}
        <Card className="p-8">
          <h2 className="text-lg font-bold text-[#4a3728] mb-3">Shipping Address</h2>
          <p className="text-sm text-[#7a6355] whitespace-pre-line">{order.customerAddress}</p>
        </Card>
      </main>
    </div>
  );
}
