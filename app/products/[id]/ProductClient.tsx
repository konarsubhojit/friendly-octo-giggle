"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useDispatch } from "react-redux";
import { Product, ProductVariation } from "@/lib/types";
import { addToCart } from "@/lib/features/cart/cartSlice";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { AppDispatch } from "@/lib/store";
import Header from "@/components/layout/Header";
import { ProductStockBadge } from "@/components/product/ProductStockBadge";
import { VariationButton } from "@/components/product/VariationButton";
import { ButterflyAccent } from "@/components/ui/DecorativeElements";

interface ProductClientProps {
  readonly product: Product;
}

interface ProductImageSectionProps {
  readonly currentImage: string;
  readonly productName: string;
}

function ProductImageSection({
  currentImage,
  productName,
}: ProductImageSectionProps) {
  return (
    <div className="relative">
      <div className="relative h-96 md:h-[600px] w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-[var(--border-warm)] group">
        <Image
          src={currentImage}
          alt={productName}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
      </div>
      <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-r from-[var(--accent-peach)] to-[var(--accent-blush)] rounded-full blur-3xl opacity-30 -z-10"></div>
      <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-gradient-to-r from-[var(--accent-sage)] to-[#d4e4c4] rounded-full blur-3xl opacity-30 -z-10"></div>
      <ButterflyAccent className="absolute -top-4 -left-4 w-10 h-10 opacity-30 hidden sm:block animate-float-gentle" />
    </div>
  );
}

interface ProductInfoCardProps {
  readonly product: Product;
  readonly formatPrice: (amount: number) => string;
  readonly effectivePrice: number;
  readonly selectedVariation: ProductVariation | null;
  readonly setSelectedVariation: (v: ProductVariation) => void;
  readonly effectiveStock: number;
}

function ProductInfoCard({
  product,
  formatPrice,
  effectivePrice,
  selectedVariation,
  setSelectedVariation,
  effectiveStock,
}: ProductInfoCardProps) {
  return (
    <div className="bg-[var(--surface)]/80 backdrop-blur-lg rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 mb-6">
      <h1 className="text-4xl font-display font-bold mb-4 text-warm-heading italic">
        {product.name}
      </h1>

      <div className="mb-6">
        <span className="inline-block bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white rounded-full px-4 py-2 text-sm font-semibold shadow-warm">
          {product.category}
        </span>
      </div>

      <p className="text-[var(--text-secondary)] text-lg mb-8 leading-relaxed">
        {product.description}
      </p>

      <div className="mb-6 p-4 bg-gradient-to-r from-[var(--accent-blush)] to-[var(--border-warm)] rounded-xl border border-[var(--border-warm)]">
        <span className="text-5xl font-bold text-warm-heading">
          {formatPrice(effectivePrice)}
        </span>
        {selectedVariation && selectedVariation.priceModifier !== 0 && (
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            Base: {formatPrice(product.price)}{" "}
            {selectedVariation.priceModifier > 0 ? "+" : "-"}
            {formatPrice(Math.abs(selectedVariation.priceModifier))}
          </div>
        )}
      </div>

      <div className="mb-6">
        <ProductStockBadge stock={effectiveStock} />
      </div>

      {product.variations && product.variations.length > 0 && (
        <div className="mb-6">
          <span
            className="block text-lg font-semibold text-[var(--foreground)] mb-3"
            id="variation-selector-label"
          >
            Select Design
          </span>
          <div className="grid grid-cols-2 gap-3">
            {product.variations.map((variation) => (
              <VariationButton
                key={variation.id}
                variation={variation}
                isSelected={selectedVariation?.id === variation.id}
                formatPrice={formatPrice}
                onSelect={setSelectedVariation}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface AddToCartSectionProps {
  readonly error: string;
  readonly cartSuccess: boolean;
  readonly quantity: number;
  readonly setQuantity: (q: number) => void;
  readonly effectiveStock: number;
  readonly effectivePrice: number;
  readonly addingToCart: boolean;
  readonly handleAddToCart: () => void;
  readonly formatPrice: (amount: number) => string;
}

function AddToCartSection({
  error,
  cartSuccess,
  quantity,
  setQuantity,
  effectiveStock,
  effectivePrice,
  addingToCart,
  handleAddToCart,
  formatPrice,
}: AddToCartSectionProps) {
  return (
    <div className="bg-[var(--surface)]/80 backdrop-blur-lg rounded-2xl shadow-warm border border-[var(--border-warm)] p-8">
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 flex items-center gap-3">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">{error}</span>
        </div>
      )}

      {cartSuccess && (
        <div className="mb-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl border border-green-200 flex items-center gap-3">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-semibold">
            Added to cart!{" "}
            <Link href="/cart" className="underline">
              View cart
            </Link>
          </span>
        </div>
      )}

      <div className="mb-5">
        <label
          htmlFor="quantity-input"
          className="block text-sm font-semibold text-[var(--foreground)] mb-2"
        >
          Quantity
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-10 h-10 rounded-lg border-2 border-[var(--border-warm)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent-warm)] hover:text-[var(--accent-rose)] transition-colors font-bold text-lg focus-warm"
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
            className="w-16 text-center px-2 py-2 border-2 border-[var(--border-warm)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)] focus:border-transparent font-semibold"
          />
          <button
            onClick={() => setQuantity(Math.min(effectiveStock, quantity + 1))}
            className="w-10 h-10 rounded-lg border-2 border-[var(--border-warm)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent-warm)] hover:text-[var(--accent-rose)] transition-colors font-bold text-lg focus-warm"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-5 p-3 bg-gradient-to-r from-[var(--accent-blush)] to-[var(--border-warm)] rounded-xl">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">
          Total:
        </span>
        <span className="text-2xl font-bold bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] bg-clip-text text-transparent">
          {formatPrice(effectivePrice * quantity)}
        </span>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleAddToCart}
          disabled={addingToCart}
          className="flex-1 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white py-4 rounded-xl font-bold text-lg hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-warm hover:shadow-warm-lg focus-warm"
        >
          {addingToCart ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Adding...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Add to Cart
            </span>
          )}
        </button>

        <Link
          href="/cart"
          className="flex-shrink-0 bg-[var(--accent-blush)] hover:bg-[var(--accent-peach)]/50 text-[var(--text-secondary)] px-5 py-4 rounded-xl font-bold transition-all duration-300 flex items-center gap-2 focus-warm"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          View Cart
        </Link>
      </div>
    </div>
  );
}

export default function ProductClient({ product }: ProductClientProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { formatPrice } = useCurrency();
  const [quantity, setQuantity] = useState(1);
  const [selectedVariation, setSelectedVariation] =
    useState<ProductVariation | null>(
      product.variations && product.variations.length > 0
        ? product.variations[0]
        : null,
    );
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [error, setError] = useState("");

  const effectivePrice = selectedVariation
    ? product.price + selectedVariation.priceModifier
    : product.price;

  const effectiveStock = selectedVariation
    ? selectedVariation.stock
    : product.stock;

  const currentImage = selectedVariation?.image || product.image;

  const handleAddToCart = async () => {
    setAddingToCart(true);
    setError("");
    setCartSuccess(false);

    try {
      await dispatch(
        addToCart({
          productId: product.id,
          variationId: selectedVariation?.id ?? null,
          quantity,
        }),
      ).unwrap();

      setCartSuccess(true);
      setTimeout(() => setCartSuccess(false), 3000);
    } catch (err) {
      setError(
        typeof err === "string"
          ? err
          : "Something went wrong. Please try again.",
      );
    } finally {
      setAddingToCart(false);
    }
  };

  return (
    <div className="min-h-screen bg-warm-gradient">
      <Header />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <Link
            href="/"
            className="text-[#b89a85] hover:text-[#d4856b] transition-colors"
          >
            Home
          </Link>
          <span className="mx-2 text-[var(--text-muted)]">/</span>
          <span className="text-[var(--text-secondary)] font-medium">
            {product.name}
          </span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <ProductImageSection
            currentImage={currentImage}
            productName={product.name}
          />

          {/* Product Details */}
          <div className="flex flex-col">
            <ProductInfoCard
              product={product}
              formatPrice={formatPrice}
              effectivePrice={effectivePrice}
              selectedVariation={selectedVariation}
              setSelectedVariation={setSelectedVariation}
              effectiveStock={effectiveStock}
            />

            {/* Add to Cart Section */}
            {effectiveStock > 0 && (
              <AddToCartSection
                error={error}
                cartSuccess={cartSuccess}
                quantity={quantity}
                setQuantity={setQuantity}
                effectiveStock={effectiveStock}
                effectivePrice={effectivePrice}
                addingToCart={addingToCart}
                handleAddToCart={handleAddToCart}
                formatPrice={formatPrice}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
