'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product, ProductVariation, OrderItem } from '@/lib/types';
import CartIcon from '@/components/layout/CartIcon';

export default function ProductClient({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(
    product.variations && product.variations.length > 0 ? product.variations[0] : null
  );
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [success, setSuccess] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [error, setError] = useState('');

  // Calculate effective price and stock based on selected variation
  const effectivePrice = selectedVariation 
    ? product.price + selectedVariation.priceModifier 
    : product.price;
  
  const effectiveStock = selectedVariation 
    ? selectedVariation.stock 
    : product.stock;
  
  const currentImage = selectedVariation?.image || product.image;

  const handleOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const orderData = {
        customerName,
        customerEmail,
        customerAddress,
        items: [
          {
            productId: product.id,
            variationId: selectedVariation?.id,
            quantity,
            price: effectivePrice,
          },
        ] as OrderItem[],
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create order');
      }

      setSuccess(true);
      setCustomerName('');
      setCustomerEmail('');
      setCustomerAddress('');
      setQuantity(1);
    } catch (err) {
      console.error('Error creating order:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    setAddingToCart(true);
    setError('');
    setCartSuccess(false);

    try {
      const res = await fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product.id,
          variationId: selectedVariation?.id,
          quantity,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add to cart');
      }

      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 3000);
    } catch (err) {
      console.error('Error adding to cart:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Modern Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-white/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold flex items-center gap-2 transition-all duration-300 hover:scale-105">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Back to Store</span>
            </Link>
            <CartIcon />
          </div>
        </div>
      </header>

      {/* Main Content */}
      {/* pt-32 accounts for fixed header (matching homepage): py-4 (1rem top + 1rem bottom = 2rem) + content (~2rem) + extra spacing = ~8rem (128px) total */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image - Modern Card */}
          <div className="relative">
            <div className="relative h-96 md:h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50 group">
              <Image
                src={currentImage}
                alt={product.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                priority
              />
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-30 -z-10"></div>
            <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-3xl opacity-30 -z-10"></div>
          </div>

          {/* Product Details - Modern Card */}
          <div className="flex flex-col">
            <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-8 mb-6">
              <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                {product.name}
              </h1>
              
              <div className="mb-6">
                <span className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full px-4 py-2 text-sm font-semibold shadow-md">
                  {product.category}
                </span>
              </div>

              <p className="text-gray-700 text-lg mb-8 leading-relaxed">{product.description}</p>

              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-100">
                <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ${effectivePrice.toFixed(2)}
                </span>
                {selectedVariation && selectedVariation.priceModifier !== 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    Base: ${product.price.toFixed(2)} {selectedVariation.priceModifier > 0 ? '+' : ''}${selectedVariation.priceModifier.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Stock Badge */}
              <div className="mb-6">
                {effectiveStock > 0 ? (
                  <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full font-semibold shadow-md">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    In Stock ({effectiveStock} available)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full font-semibold shadow-md">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    Out of Stock
                  </span>
                )}
              </div>

              {/* Variation Selector */}
              {product.variations && product.variations.length > 0 && (
                <div className="mb-6">
                  <label className="block text-lg font-semibold text-gray-800 mb-3">
                    Select Design
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {product.variations.map((variation) => (
                      <button
                        key={variation.id}
                        onClick={() => setSelectedVariation(variation)}
                        className={`p-4 border-2 rounded-xl transition-all duration-300 ${
                          selectedVariation?.id === variation.id
                            ? 'border-blue-600 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg scale-105'
                            : 'border-gray-300 hover:border-blue-400 hover:shadow-md hover:scale-105'
                        }`}
                      >
                        <div className="text-sm font-bold text-gray-800">{variation.designName}</div>
                        <div className="text-xs text-gray-600 mt-1">{variation.name}</div>
                        {variation.priceModifier !== 0 && (
                          <div className="text-xs font-semibold text-blue-600 mt-1">
                            {variation.priceModifier > 0 ? '+' : ''}${variation.priceModifier.toFixed(2)}
                          </div>
                        )}
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6z" />
                          </svg>
                          Stock: {variation.stock}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart Section - Modern Card */}
            {effectiveStock > 0 && (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-8 mb-6">
                <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Add to Cart
                </h2>

                {cartSuccess && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl border border-green-200 shadow-md flex items-center gap-3">
                    <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">Added to cart! <Link href="/cart" className="underline">View cart</Link></span>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:from-green-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105 transform"
                  >
                    {addingToCart ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        Add to Cart
                      </span>
                    )}
                  </button>

                  <Link
                    href="/cart"
                    className="flex-shrink-0 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-4 rounded-xl font-bold text-lg transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105 transform flex items-center gap-2"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            {/* Order Form - Modern Card */}
            {effectiveStock > 0 && (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-8">
                <h2 className="text-2xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Place Your Order</h2>
                
                {success && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl border border-green-200 shadow-md flex items-center gap-3">
                    <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">Order placed successfully!</span>
                  </div>
                )}
                
                {error && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-rose-50 text-red-700 rounded-xl border border-red-200 shadow-md flex items-center gap-3">
                    <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">{error}</span>
                  </div>
                )}

                <form onSubmit={handleOrder} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-300"
                      placeholder="Enter your full name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-300"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Shipping Address
                    </label>
                    <textarea
                      required
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-300 resize-none"
                      placeholder="Enter your complete shipping address"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={effectiveStock}
                      value={quantity}
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        const parsed = parseInt(rawValue, 10);
                        if (Number.isNaN(parsed) || parsed < 1) {
                          setQuantity(1);
                          return;
                        }
                        const clamped = Math.min(parsed, effectiveStock);
                        setQuantity(clamped);
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/50 backdrop-blur-sm transition-all duration-300 hover:border-blue-300"
                    />
                  </div>

                  <div className="border-t-2 border-gray-200 pt-6 mt-6">
                    <div className="flex justify-between items-center mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                      <span className="text-lg font-semibold text-gray-700">Total Amount:</span>
                      <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        ${(effectivePrice * quantity).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105 transform"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          Place Order
                        </span>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
