'use client';

import { useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useSelector, useDispatch } from 'react-redux';
import Header from '@/components/layout/Header';
import { useCurrency } from '@/contexts/CurrencyContext';
import { fetchOrderById, selectCurrentOrder, selectOrderDetailLoading, selectOrdersError, clearCurrentOrder } from '@/lib/features/orders/ordersSlice';
import type { AppDispatch } from '@/lib/store';

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

function getStepIndex(status: string): number {
  if (status === 'CANCELLED') return -1;
  return STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = use(params);
  const { data: session, status: authStatus } = useSession();
  const { formatPrice } = useCurrency();
  const dispatch = useDispatch<AppDispatch>();
  const order = useSelector(selectCurrentOrder);
  const loading = useSelector(selectOrderDetailLoading);
  const error = useSelector(selectOrdersError);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="flex items-center justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-6">Please sign in to view order details.</p>
            <Link
              href={`/auth/signin?callbackUrl=/orders/${id}`}
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold"
            >
              Sign In
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Header />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{error || 'Order not found'}</h2>
            <Link href="/orders" className="mt-4 inline-block text-blue-600 hover:underline font-medium">
              Back to My Orders
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Back link */}
        <Link href="/orders" className="inline-flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to My Orders
        </Link>

        {/* Order Header */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-8 mb-6">
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order #{order.id.slice(0, 8)}</h1>
              <p className="text-sm text-gray-500 mt-1">
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
            <p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {formatPrice(order.totalAmount)}
            </p>
          </div>

          {/* Status Timeline */}
          <div className="mt-8">
            {isCancelled ? (
              <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
                <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-red-700">This order has been cancelled</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                {STATUS_STEPS.map((step, index) => {
                  const isCompleted = index <= currentStep;
                  const isCurrent = index === currentStep;
                  return (
                    <div key={step} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                            isCompleted
                              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                              : 'bg-gray-200 text-gray-500'
                          } ${isCurrent ? 'ring-4 ring-blue-200' : ''}`}
                        >
                          {isCompleted ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span className={`text-xs mt-2 font-medium ${isCompleted ? 'text-blue-600' : 'text-gray-400'}`}>
                          {STATUS_LABELS[step]}
                        </span>
                      </div>
                      {index < STATUS_STEPS.length - 1 && (
                        <div
                          className={`flex-1 h-1 mx-2 rounded-full transition-all ${
                            index < currentStep ? 'bg-gradient-to-r from-blue-500 to-purple-500' : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-8 mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Items</h2>
          <div className="space-y-4">
            {order.items.map((item) => {
              const image = (item.variation as Record<string, unknown>)?.image as string | undefined || item.product?.image;
              return (
                <div key={item.id} className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
                  {image && (
                    <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                      <Image src={image} alt={item.product?.name || 'Order item'} fill sizes="80px" className="object-cover" />
                    </div>
                  )}
                  <div className="flex-grow min-w-0">
                    <Link
                      href={`/products/${item.productId}`}
                      className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {item.product?.name}
                    </Link>
                    {item.variation && (
                      <p className="text-xs text-gray-500">
                        {item.variation.name}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900">{formatPrice(item.price * item.quantity)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Shipping Address</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">{order.customerAddress}</p>
        </div>
      </main>
    </div>
  );
}
