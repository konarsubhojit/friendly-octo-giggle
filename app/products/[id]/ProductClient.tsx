'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product, ProductVariation, OrderItem } from '@/lib/types';

export default function ProductClient({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedVariation, setSelectedVariation] = useState<ProductVariation | null>(
    product.variations && product.variations.length > 0 ? product.variations[0] : null
  );
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            ← Back to Store
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Product Image */}
          <div className="relative h-96 md:h-[600px] w-full rounded-lg overflow-hidden">
            <Image
              src={currentImage}
              alt={product.name}
              fill
              className="object-cover"
              priority
            />
          </div>

          {/* Product Details */}
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {product.name}
            </h1>
            
            <div className="mb-4">
              <span className="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700">
                {product.category}
              </span>
            </div>

            <p className="text-gray-700 text-lg mb-6">{product.description}</p>

            <div className="mb-6">
              <span className="text-4xl font-bold text-gray-900">
                ${effectivePrice.toFixed(2)}
              </span>
              {selectedVariation && selectedVariation.priceModifier !== 0 && (
                <span className="ml-2 text-sm text-gray-600">
                  (Base: ${product.price.toFixed(2)} {selectedVariation.priceModifier > 0 ? '+' : ''}${selectedVariation.priceModifier.toFixed(2)})
                </span>
              )}
            </div>

            {/* Variation Selector */}
            {product.variations && product.variations.length > 0 && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Design
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {product.variations.map((variation) => (
                    <button
                      key={variation.id}
                      onClick={() => setSelectedVariation(variation)}
                      className={`p-3 border-2 rounded-lg transition ${
                        selectedVariation?.id === variation.id
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div className="text-sm font-medium">{variation.designName}</div>
                      <div className="text-xs text-gray-600">{variation.name}</div>
                      {variation.priceModifier !== 0 && (
                        <div className="text-xs text-gray-500">
                          {variation.priceModifier > 0 ? '+' : ''}${variation.priceModifier.toFixed(2)}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        Stock: {variation.stock}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6">
              {effectiveStock > 0 ? (
                <span className="text-green-600 font-semibold">
                  In Stock ({effectiveStock} available)
                </span>
              ) : (
                <span className="text-red-600 font-semibold">Out of Stock</span>
              )}
            </div>

            {/* Order Form */}
            {effectiveStock > 0 && (
              <div className="bg-white p-6 rounded-lg shadow-md">
                <h2 className="text-xl font-bold mb-4">Place Order</h2>
                
                {success && (
                  <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">
                    Order placed successfully!
                  </div>
                )}
                
                {error && (
                  <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
                    {error}
                  </div>
                )}

                <form onSubmit={handleOrder} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shipping Address
                    </label>
                    <textarea
                      required
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between mb-4">
                      <span className="font-semibold">Total:</span>
                      <span className="text-2xl font-bold">
                        ${(effectivePrice * quantity).toFixed(2)}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                    >
                      {loading ? 'Processing...' : 'Place Order'}
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
