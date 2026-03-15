'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSelector, useDispatch } from 'react-redux';
import { CartItemWithProduct } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import Header from '@/components/layout/Header';
import { DynamicForm, type FieldDef, type SubmitResult } from '@/components/ui/DynamicForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { EmptyState } from '@/components/ui/EmptyState';
import { AuthRequiredState } from '@/components/ui/AuthRequiredState';
import { Card } from '@/components/ui/Card';
import { GradientHeading } from '@/components/ui/GradientHeading';
import {
  fetchCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  selectCart,
  selectCartLoading,
} from '@/lib/features/cart/cartSlice';
import type { AppDispatch } from '@/lib/store';

// --- CartItemRow: extracted to reduce JSX depth (JS-0415) ---
interface CartItemRowProps {
  readonly item: CartItemWithProduct;
  readonly isLast: boolean;
  readonly updating: string | null;
  readonly customizationNote: string;
  readonly formatPrice: (amount: number) => string;
  readonly onUpdateQuantity: (itemId: string, quantity: number) => void;
  readonly onRemoveItem: (itemId: string) => void;
  readonly onCustomizationChange: (itemId: string, note: string) => void;
}

function CartItemRow({
  item,
  isLast,
  updating,
  customizationNote,
  formatPrice,
  onUpdateQuantity,
  onRemoveItem,
  onCustomizationChange,
}: CartItemRowProps) {
  const price = item.variation
    ? item.product.price + item.variation.priceModifier
    : item.product.price;
  const image = item.variation?.image || item.product.image;

  return (
    <div className={`flex gap-5 p-6 items-start${isLast ? '' : ' border-b border-gray-100'}`}>
      {/* Image */}
      <div className="relative w-24 h-24 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden">
        <Image src={image} alt={item.product.name} fill sizes="80px" className="object-cover" />
      </div>

      {/* Details */}
      <div className="flex-grow min-w-0">
        <Link
          href={`/products/${item.productId}`}
          className="text-base font-bold text-gray-900 hover:text-blue-600 transition-colors block truncate"
        >
          {item.product.name}
        </Link>
        {item.variation && (
          <p className="text-xs text-gray-500 mt-0.5">
            {item.variation.designName} - {item.variation.name}
          </p>
        )}
        <p className="text-lg font-bold text-gray-900 mt-1">{formatPrice(price)}</p>

        {/* Quantity controls */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
              disabled={updating === item.id || item.quantity <= 1}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              -
            </button>
            <span className="w-10 text-center text-sm font-semibold text-gray-900">
              {updating === item.id ? (
                <LoadingSpinner size="h-4 w-4" color="text-blue-500" />
              ) : (
                item.quantity
              )}
            </span>
            <button
              onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
              disabled={updating === item.id}
              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              +
            </button>
          </div>

          <button
            onClick={() => onRemoveItem(item.id)}
            disabled={updating === item.id}
            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40 transition-colors"
          >
            Remove
          </button>
        </div>

        {/* Customization Note */}
        <div className="mt-3">
          <input
            type="text"
            placeholder="Add customization note (e.g., color preference, message on card...)"
            value={customizationNote}
            onChange={(e) => onCustomizationChange(item.id, e.target.value)}
            className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 bg-white/50 placeholder-gray-400"
            maxLength={500}
            aria-label={`Customization note for ${item.product.name}`}
          />
        </div>
      </div>

      {/* Line total */}
      <div className="flex-shrink-0 text-right">
        <p className="text-lg font-bold text-gray-900">{formatPrice(price * item.quantity)}</p>
      </div>
    </div>
  );
}

export default function CartPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const dispatch = useDispatch<AppDispatch>();
  const cart = useSelector(selectCart);
  const loading = useSelector(selectCartLoading);
  const { formatPrice } = useCurrency();
  const [updating, setUpdating] = useState<string | null>(null);
  const [customizationNotes, setCustomizationNotes] = useState<Record<string, string>>({});
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  const handleUpdateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;

    setUpdating(itemId);
    try {
      await dispatch(updateCartItem({ itemId, quantity })).unwrap();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Something went wrong. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    setUpdating(itemId);
    try {
      await dispatch(removeCartItem(itemId)).unwrap();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Something went wrong. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const calculateTotal = () => {
    if (!cart?.items) return 0;
    return cart.items.reduce((total, item) => {
      const price = item.variation
        ? item.product.price + item.variation.priceModifier
        : item.product.price;
      return total + price * item.quantity;
    }, 0);
  };

  // Extracted helper: handles the API call to create an order (JS-R1005)
  const submitOrderToApi = useCallback(async (
    address: string,
    notes: Record<string, string>,
  ): Promise<void> => {
    const orderData = {
      customerAddress: address,
      items: (cart?.items ?? []).map((item) => ({
        productId: item.productId,
        variationId: item.variationId,
        quantity: item.quantity,
        price: item.variation
          ? item.product.price + item.variation.priceModifier
          : item.product.price,
        customizationNote: notes[item.id] || null,
      })),
    };

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to place order');
    }

    await dispatch(clearCart()).unwrap();
    setOrderSuccess(true);
    setTimeout(() => { router.push('/orders'); }, 2000);
  }, [cart, dispatch, router]);

  const handleOrderSubmit = useCallback(async (
    values: Readonly<Record<string, string>>,
  ): Promise<SubmitResult> => {
    if (!session?.user) {
      router.push('/auth/signin?callbackUrl=/cart');
      return;
    }
    if (!cart?.items.length) return 'Your cart is empty.';
    try {
      await submitOrderToApi(values.customerAddress, customizationNotes);
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    }
  }, [session, router, submitOrderToApi, customizationNotes]);

  const ADDRESS_FIELDS: ReadonlyArray<FieldDef> = [
    {
      id: 'shipping-address',
      name: 'customerAddress',
      label: 'Shipping Address',
      type: 'textarea',
      rows: 3,
      placeholder: 'Enter your shipping address',
      validate: (v) => v.trim() ? undefined : 'Please enter a shipping address.',
    },
  ];

  const CART_SUBMIT_BTN =
    'w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3.5 rounded-xl font-bold text-base hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl';

  // Show the full-page spinner only on the very first load (cart not yet fetched).
  // Background re-fetches triggered by quantity updates / removals must not
  // replace the visible cart with a blank spinner – that is the bug we are fixing.
  if ((loading && cart === null) || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Header />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Header />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <AuthRequiredState callbackUrl="/cart" message="Please sign in to view your cart and place orders." />
          <Link href="/" className="block mt-4 text-gray-500 hover:text-gray-700 font-medium text-center">
            Continue Shopping
          </Link>
        </main>
      </div>
    );
  }

  const isEmpty = !cart?.items || cart.items.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <GradientHeading className="mb-8">Shopping Cart</GradientHeading>

        {error && (
          <AlertBanner message={error} variant="error" onDismiss={() => setError('')} className="mb-6" />
        )}

        {orderSuccess && (
          <AlertBanner
            variant="success"
            className="mb-6"
            message={
              <div>
                <div className="font-bold text-lg">Order Placed Successfully!</div>
                <div className="text-sm">Thank you for your order. Redirecting to your orders...</div>
              </div>
            }
          />
        )}

        {isEmpty ? (
          <Card className="p-12 text-center">
            <EmptyState
              icon={
                <svg className="w-20 h-20 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="Your cart is empty"
              message="Add some products to get started!"
              ctaText="Browse Products"
              ctaHref="/"
              className="py-0"
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <Card className="overflow-hidden">
                {cart.items.map((item: CartItemWithProduct, index: number) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    isLast={index === cart.items.length - 1}
                    updating={updating}
                    customizationNote={customizationNotes[item.id] || ''}
                    formatPrice={formatPrice}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveItem={handleRemoveItem}
                    onCustomizationChange={(itemId, note) =>
                      setCustomizationNotes((prev) => ({ ...prev, [itemId]: note }))
                    }
                  />
                ))}
              </Card>

              <Link href="/" className="inline-flex items-center gap-2 mt-4 text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Continue Shopping
              </Link>
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-28">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>

                <div className="space-y-3 mb-4 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({cart.items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                    <span className="font-medium">{formatPrice(calculateTotal())}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  <div className="border-t border-gray-200 pt-3 flex justify-between">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {formatPrice(calculateTotal())}
                    </span>
                  </div>
                </div>

                {/* Payment placeholder */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                  <p className="text-xs text-gray-500">Payment integration coming soon</p>
                </div>

                {/* Shipping address + Place Order */}
                <DynamicForm
                  fields={ADDRESS_FIELDS}
                  onSubmit={handleOrderSubmit}
                  submitLabel="Place Order"
                  submittingLabel="Processing..."
                  submitButtonClassName={CART_SUBMIT_BTN}
                />
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
