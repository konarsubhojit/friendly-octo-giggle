'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSelector, useDispatch } from 'react-redux';
import { CartItemWithProduct } from '@/lib/types';
import { useCurrency } from '@/contexts/CurrencyContext';
import Header from '@/components/layout/Header';
import {
  fetchCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  selectCart,
  selectCartLoading,
} from '@/lib/features/cart/cartSlice';
import type { AppDispatch } from '@/lib/store';

export default function CartPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const dispatch = useDispatch<AppDispatch>();
  const cart = useSelector(selectCart);
  const loading = useSelector(selectCartLoading);
  const { formatPrice } = useCurrency();
  const [updating, setUpdating] = useState<string | null>(null);
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
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
      console.error('Error updating item:', err);
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
      console.error('Error removing item:', err);
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

  const handlePlaceOrder = async () => {
    if (!session?.user) {
      router.push('/auth/signin?callbackUrl=/cart');
      return;
    }

    if (!cart?.items || cart.items.length === 0) {
      setError('Your cart is empty');
      return;
    }

    if (!customerAddress.trim()) {
      setError('Please enter a shipping address');
      return;
    }

    setOrderLoading(true);
    setError('');

    try {
      const orderData = {
        customerAddress,
        items: cart.items.map((item) => ({
          productId: item.productId,
          variationId: item.variationId,
          quantity: item.quantity,
          price: item.variation
            ? item.product.price + item.variation.priceModifier
            : item.product.price,
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

      setTimeout(() => {
        router.push('/orders');
      }, 2000);
    } catch (err: unknown) {
      console.error('Error placing order:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setOrderLoading(false);
    }
  };

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <Header />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
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
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-12 text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In Required</h2>
            <p className="text-gray-600 mb-6">Please sign in to view your cart and place orders.</p>
            <Link
              href="/auth/signin?callbackUrl=/cart"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Sign In
            </Link>
            <Link href="/" className="block mt-4 text-gray-500 hover:text-gray-700 font-medium">
              Continue Shopping
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const isEmpty = !cart?.items || cart.items.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Shopping Cart
        </h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}

        {orderSuccess && (
          <div className="mb-6 p-6 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-4">
            <svg className="w-10 h-10 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-bold text-lg">Order Placed Successfully!</div>
              <div className="text-sm">Thank you for your order. Redirecting to your orders...</div>
            </div>
          </div>
        )}

        {isEmpty ? (
          <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-12 text-center">
            <svg className="w-20 h-20 mx-auto mb-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-700 mb-2">Your cart is empty</h2>
            <p className="text-gray-500 mb-6">Add some products to get started!</p>
            <Link
              href="/"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                {cart.items.map((item: CartItemWithProduct, index: number) => {
                  const price = item.variation
                    ? item.product.price + item.variation.priceModifier
                    : item.product.price;
                  const image = item.variation?.image || item.product.image;

                  return (
                    <div
                      key={item.id}
                      className={`flex gap-5 p-6 items-start ${index < cart.items.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
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
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              disabled={updating === item.id || item.quantity <= 1}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              -
                            </button>
                            <span className="w-10 text-center text-sm font-semibold text-gray-900">
                              {updating === item.id ? (
                                <svg className="animate-spin h-4 w-4 mx-auto text-blue-500" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                </svg>
                              ) : (
                                item.quantity
                              )}
                            </span>
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              disabled={updating === item.id}
                              className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              +
                            </button>
                          </div>

                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={updating === item.id}
                            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40 transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Line total */}
                      <div className="flex-shrink-0 text-right">
                        <p className="text-lg font-bold text-gray-900">{formatPrice(price * item.quantity)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Link href="/" className="inline-flex items-center gap-2 mt-4 text-sm text-gray-600 hover:text-blue-600 transition-colors font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Continue Shopping
              </Link>
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-6 sticky top-28">
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

                {/* Shipping Address */}
                <div className="mb-4">
                  <label htmlFor="shipping-address" className="block text-sm font-semibold text-gray-700 mb-2">
                    Shipping Address
                  </label>
                  <textarea
                    id="shipping-address"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none bg-white/50"
                    placeholder="Enter your shipping address"
                    aria-describedby="shipping-address-hint"
                  />
                </div>

                {/* Payment placeholder */}
                <div className="mb-5 p-3 bg-gray-50 rounded-lg border border-gray-200 text-center">
                  <p className="text-xs text-gray-500">Payment integration coming soon</p>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handlePlaceOrder}
                  disabled={orderLoading || !customerAddress.trim()}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3.5 rounded-xl font-bold text-base hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  {orderLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Place Order'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
