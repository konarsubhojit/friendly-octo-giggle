'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Cart, CartItemWithProduct } from '@/lib/types';

export default function CartPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [error, setError] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      const res = await fetch('/api/cart');
      const data = await res.json();
      setCart(data.cart);
    } catch (err) {
      console.error('Error fetching cart:', err);
      setError('Unable to load cart');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity < 1) return;
    
    setUpdating(itemId);
    try {
      const res = await fetch(`/api/cart/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      await fetchCart();
    } catch (err) {
      console.error('Error updating item:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const removeItem = async (itemId: string) => {
    setUpdating(itemId);
    try {
      const res = await fetch(`/api/cart/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to remove item');
      }

      await fetchCart();
    } catch (err) {
      console.error('Error removing item:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setUpdating(null);
    }
  };

  const calculateTotal = () => {
    if (!cart || !cart.items) return 0;
    return cart.items.reduce((total, item) => {
      const price = item.variation
        ? item.product.price + item.variation.priceModifier
        : item.product.price;
      return total + price * item.quantity;
    }, 0);
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check terms agreement
    if (!agreedToTerms) {
      setError('Please agree to the Terms and Conditions');
      return;
    }
    
    // Check authentication
    if (!session?.user) {
      setError('Please sign in to place an order');
      router.push('/auth/signin?callbackUrl=/cart');
      return;
    }
    
    if (!cart || !cart.items || cart.items.length === 0) {
      setError('Your cart is empty');
      return;
    }

    setOrderLoading(true);
    setError('');

    try {
      // Create order from cart items - customer info comes from session
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

      // Clear cart after successful order
      await fetch('/api/cart', { method: 'DELETE' });

      // Show success message
      setOrderSuccess(true);
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/');
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xl font-semibold text-gray-700">Loading...</span>
        </div>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-12 text-center max-w-md">
          <svg className="w-20 h-20 mx-auto mb-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-3xl font-bold mb-4 text-gray-900">
            Sign In Required
          </h2>
          <p className="text-gray-700 mb-8 text-lg">
            Please sign in to view your cart and place orders.
          </p>
          <Link
            href="/auth/signin?callbackUrl=/cart"
            className="inline-block bg-black text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-800 transition-all duration-300 shadow-lg hover:shadow-2xl"
          >
            Sign In
          </Link>
          <Link
            href="/"
            className="block mt-4 text-gray-600 hover:text-gray-800 font-medium"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  const isEmpty = !cart || !cart.items || cart.items.length === 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Header Navigation */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Logo/Brand */}
            <Link href="/" className="text-2xl font-bold flex items-center gap-2">
              <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-gray-900">E-Store</span>
            </Link>

            {/* Right Navigation Icons */}
            <div className="flex items-center gap-6">
              <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors" title="Home">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>
              <button className="text-gray-600 hover:text-gray-900 transition-colors" title="Notifications" aria-label="Notifications">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <Link href="/cart" className="text-blue-600 hover:text-blue-700 transition-colors" title="Cart">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </Link>
              <button className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center" title="User Profile" aria-label="User Profile">
                {session?.user?.image ? (
                  <Image src={session.user.image} alt="User" width={32} height={32} className="rounded-full" />
                ) : (
                  <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-black mb-8">
          Cart Products
        </h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-center gap-3">
            <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {orderSuccess && (
          <div className="mb-6 p-6 bg-green-50 text-green-700 rounded-lg border border-green-200 flex items-center gap-4">
            <svg className="w-12 h-12 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-bold text-xl mb-1">Order Placed Successfully! 🎉</div>
              <div className="text-sm">Thank you for your order. Redirecting to home page...</div>
            </div>
          </div>
        )}

        {isEmpty ? (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-12 text-center">
            <svg className="w-24 h-24 mx-auto mb-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h2 className="text-2xl font-bold text-gray-700 mb-4">Your cart is empty</h2>
            <p className="text-gray-600 mb-8">Add some products to get started!</p>
            <Link
              href="/"
              className="inline-block bg-black text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-800 transition-all duration-300"
            >
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Cart Items (Left Column - 65%) */}
            <div className="lg:col-span-2">
              <div className="space-y-0">
                {cart.items.map((item: CartItemWithProduct) => {
                  const price = item.variation
                    ? item.product.price + item.variation.priceModifier
                    : item.product.price;
                  const image = item.variation?.image || item.product.image;

                  return (
                    <div
                      key={item.id}
                      className="flex gap-6 py-6 border-b border-gray-200 items-start"
                    >
                      {/* Product Image */}
                      <div className="relative w-36 h-36 flex-shrink-0 bg-gray-50 rounded overflow-hidden">
                        <Image
                          src={image}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                        />
                      </div>

                      {/* Product Details */}
                      <div className="flex-grow">
                        <Link
                          href={`/products/${item.productId}`}
                          className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors block"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-sm text-gray-600 mt-1" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {item.product.description}
                        </p>
                        {item.variation && (
                          <p className="text-sm text-gray-500 mt-1">
                            {item.variation.designName} - {item.variation.name}
                          </p>
                        )}
                        <p className="text-lg font-semibold text-gray-900 mt-2">
                          ${price.toFixed(2)} <span className="text-sm text-gray-500 font-normal">× {item.quantity}</span>
                        </p>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={updating === item.id}
                        className="flex-shrink-0 text-sm text-white bg-pink-500 hover:bg-pink-600 px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cart Summary Sidebar (Right Column - 35%) */}
            <div className="lg:col-span-1">
              <div className="bg-rose-50 rounded-lg p-6 sticky top-8">
                {/* Cart Total */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-gray-700 uppercase">Cart Total</span>
                    <span className="text-2xl font-bold text-gray-900">${calculateTotal().toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-500">Shipping &amp; taxes calculated at checkout</p>
                </div>

                {/* Terms and Conditions */}
                <div className="mb-4">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(e) => setAgreedToTerms(e.target.checked)}
                      className="mt-1"
                    />
                    <span className="text-sm text-gray-700">
                      I agree to the{' '}
                      <Link href="/terms" className="text-blue-600 hover:underline">
                        Terms and Conditions
                      </Link>
                    </span>
                  </label>
                </div>

                {/* Saved Payment Method - Note: Hardcoded for UI demonstration */}
                <div className="mb-6 p-3 bg-white rounded border border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Saved Card:</p>
                      <p className="text-sm text-gray-600">VISA **** 3567</p>
                    </div>
                    <button className="text-sm text-blue-600 hover:underline" onClick={() => console.log('Change payment method')}>
                      (change)
                    </button>
                  </div>
                </div>

                {/* Address Field */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Shipping Address *
                  </label>
                  <textarea
                    required
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    placeholder="Enter your shipping address"
                  />
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handlePlaceOrder}
                  disabled={orderLoading || !agreedToTerms}
                  aria-label={!agreedToTerms ? "Please agree to Terms and Conditions to checkout" : "Proceed to checkout"}
                  className="w-full bg-black text-white py-3 rounded font-bold text-base hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      CHECKOUT
                    </>
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
