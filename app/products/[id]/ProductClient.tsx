'use client';

import { useState } from 'react';
import Link from 'next/link'
import Image from 'next/image';
import { useDispatch } from 'react-redux';
import { Product, ProductVariation } from '@/lib/types';
import { addToCart } from '@/lib/features/cart/cartSlice';
import { useCurrency } from '@/contexts/CurrencyContext';
import type { AppDispatch } from '@/lib/store';
import Header from '@/components/layout/Header';

interface ProductClientProps {
  readonly product: Product;
}

// Helper component for stock badge to avoid nested ternary
function ProductStockBadge({ stock }: { readonly stock: number }) {
  if (stock > 5) {
    return (
      <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full font-semibold shadow-md">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        In Stock
      </span>
    );
  }
  if (stock > 0) {
    return (
      <span className="inline-flex items-center gap-2 bg-amber-100 text-amber-700 px-4 py-2 rounded-full font-semibold shadow-md">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Only {stock} left in stock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-full font-semibold shadow-md">
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      Out of Stock
    </span>
  );
}

export default function ProductClient({ product }: ProductClientProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { formatPrice } = useCurrency();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(
    product.variations && product.variations.length > 0 ? product.variations[0] : null
  );
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [error, setError] = useState('');

  const effectivePrice = selectedVariation
    ? product.price + selectedVariation.priceModifier
    : product.price;

  const effectiveStock = selectedVariation
    ? selectedVariation.stock
    : product.stock;

  const currentImage = selectedVariation?.image || product.image;

  const handleAddToCart = async () => {
    setAddingToCart(true);
    setError('');
    setCartSuccess(false);

    try {
      await dispatch(addToCart({
        productId: product.id,
        variationId: selectedVariation?.id,
        quantity,
      })).unwrap();

      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 3000);
    } catch (err) {
      console.error('Error adding to cart:', err);
      setError(typeof err === 'string' ? err : 'Something went wrong. Please try again.');
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <Link href="/" className="text-gray-500 hover:text-blue-600 transition-colors">Home</Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-700 font-medium">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="relative">
            <div className="relative h-96 md:h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-white/50 group">
              <Image
                src={currentImage}
                alt={product.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-30 -z-10"></div>
            <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-3xl opacity-30 -z-10"></div>
          </div>

          {/* Product Details */}
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
                  {formatPrice(effectivePrice)}
                </span>
                {selectedVariation && selectedVariation.priceModifier !== 0 && (
                  <div className="mt-2 text-sm text-gray-600">
                    Base: {formatPrice(product.price)} {selectedVariation.priceModifier > 0 ? '+' : '-'}{formatPrice(Math.abs(selectedVariation.priceModifier))}
                  </div>
                )}
              </div>

              {/* Stock Badge */}
              <div className="mb-6">
                <ProductStockBadge stock={effectiveStock} />
              </div>

              {/* Variation Selector */}
              {product.variations && product.variations.length > 0 && (
                <div className="mb-6">
                  <span className="block text-lg font-semibold text-gray-800 mb-3" id="variation-selector-label">
                    Select Design
                  </span>
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
                            {variation.priceModifier > 0 ? '+' : '-'}{formatPrice(Math.abs(variation.priceModifier))}
                          </div>
                        )}
                        {variation.stock > 0 && variation.stock < 6 && (
                          <div className="text-xs text-amber-600 font-medium mt-1">Only {variation.stock} left</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart Section */}
            {effectiveStock > 0 && (
              <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-xl border border-white/50 p-8">
                {error && (
                  <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">{error}</span>
                  </div>
                )}

                {cartSuccess && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">Added to cart! <Link href="/cart" className="underline">View cart</Link></span>
                  </div>
                )}

                {/* Quantity selector */}
                <div className="mb-5">
                  <label htmlFor="quantity-input" className="block text-sm font-semibold text-gray-800 mb-2">Quantity</label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors font-bold text-lg"
                    >
                      -
                    </button>
                    <input
                      id="quantity-input"
                      type="number"
                      min="1"
                      max={effectiveStock}
                      value={quantity}
                      onChange={(e) => {
                        const parsed = Number.parseInt(e.target.value, 10);
                        if (Number.isNaN(parsed) || parsed < 1) {
                          setQuantity(1);
                          return;
                        }
                        setQuantity(Math.min(parsed, effectiveStock));
                      }}
                      className="w-16 text-center px-2 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(effectiveStock, quantity + 1))}
                      className="w-10 h-10 rounded-lg border-2 border-gray-200 flex items-center justify-center text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors font-bold text-lg"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-between items-center mb-5 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                  <span className="text-sm font-semibold text-gray-700">Total:</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {formatPrice(effectivePrice * quantity)}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-2xl"
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
                    className="flex-shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-4 rounded-xl font-bold transition-all duration-300 flex items-center gap-2"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    View Cart
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
