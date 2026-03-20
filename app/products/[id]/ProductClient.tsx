"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useDispatch, useSelector } from "react-redux";
import { Product, ProductVariation } from "@/lib/types";
import { addToCart, fetchCart } from "@/lib/features/cart/cartSlice";
import { useCurrency } from "@/contexts/CurrencyContext";
import type { AppDispatch, RootState } from "@/lib/store";
import { ProductStockBadge } from "@/components/product/ProductStockBadge";
import { VariationButton } from "@/components/product/VariationButton";
import { ShareButton } from "@/components/product/ShareButton";
import { ButterflyAccent } from "@/components/ui/DecorativeElements";
import ImageCarousel from "@/components/product/ImageCarousel";
import { useRecentlyViewed } from "@/lib/hooks";
import RecentlyViewed from "@/components/sections/RecentlyViewed";
import { ReviewsSection } from "@/components/sections/ReviewsSection";

interface ProductClientProps {
  readonly product: Product;
  readonly initialVariationId: string | null;
}

// ─── Pure module-level helpers ────────────────────────────

const getVariationImages = (variation: ProductVariation): string[] =>
  [
    ...(variation.image ? [variation.image] : []),
    ...(variation.images ?? []),
  ].filter(Boolean);

const getProductImages = (product: Product): string[] =>
  [product.image, ...(product.images ?? [])].filter(Boolean);

const getCarouselImages = (
  product: Product,
  selectedVariation: ProductVariation | null,
): string[] => {
  if (selectedVariation) {
    const imgs = getVariationImages(selectedVariation);
    if (imgs.length > 0) return imgs;
  }
  return getProductImages(product);
};

const resolveInitialVariation = (
  product: Product,
  variationId: string | null,
): ProductVariation | null => {
  if (!variationId) return null;
  const variations = product.variations ?? [];
  return variations.find((v) => v.id === variationId) ?? null;
};

const getClampedQtyState = (
  quantity: number,
  stock: number,
): { qty: number; message: string } => {
  if (stock === 0) return { qty: quantity, message: "" };
  if (quantity > stock)
    return { qty: stock, message: `Only ${stock} available` };
  return { qty: quantity, message: "" };
};

// ─── Small button-content helpers ────────────────────────

const AddingSpinner = () => (
  <span className="flex items-center justify-center gap-2">
    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    Adding...
  </span>
);

const CartButtonLabel = () => (
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
);

const BreadcrumbNav = ({ productName }: { readonly productName: string }) => (
  <nav className="mb-6 text-sm">
    <div className="inline-flex items-center gap-1 px-4 py-2 bg-[var(--surface)]/90 backdrop-blur-sm rounded-full border border-[var(--border-warm)] shadow-warm">
      <Link
        href="/shop"
        className="text-[var(--foreground)] font-medium hover:text-[var(--accent-rose)] transition-colors"
      >
        Shop
      </Link>
      <span className="mx-1 text-[var(--accent-warm)] font-bold">/</span>
      <span className="text-[var(--foreground)] font-semibold">
        {productName}
      </span>
    </div>
  </nav>
);

const OutOfStockPanel = ({
  currentCartQuantity,
}: {
  readonly currentCartQuantity: number;
}) => (
  <div className="bg-[var(--surface)]/80 backdrop-blur-lg rounded-2xl shadow-warm border border-[var(--border-warm)] p-8">
    {currentCartQuantity > 0 ? (
      <>
        <div className="flex items-center gap-3 text-blue-600">
          <svg
            className="w-6 h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span className="text-lg font-bold">All Available Stock in Cart</span>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          You have all {currentCartQuantity} available{" "}
          {currentCartQuantity === 1 ? "item" : "items"} in your cart. No more
          can be added.
        </p>
        <Link
          href="/cart"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white rounded-xl font-semibold text-sm shadow-warm hover:shadow-warm-lg transition-all duration-300 focus-warm"
        >
          Go to Cart
        </Link>
      </>
    ) : (
      <>
        <div className="flex items-center gap-3 text-red-500">
          <svg
            className="w-6 h-6 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
          <span className="text-lg font-bold">Out of Stock</span>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This item is currently unavailable. Check back later or explore other
          products.
        </p>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white rounded-xl font-semibold text-sm shadow-warm hover:shadow-warm-lg transition-all duration-300 focus-warm"
        >
          Browse Products
        </Link>
      </>
    )}
  </div>
);

// ─── Product Info sub-components ─────────────────────────

interface PriceModifierDisplayProps {
  readonly product: Product;
  readonly selectedVariation: ProductVariation | null;
  readonly formatPrice: (amount: number) => string;
}

const PriceModifierDisplay = ({
  product,
  selectedVariation,
  formatPrice,
}: PriceModifierDisplayProps) => {
  if (!selectedVariation || selectedVariation.priceModifier === 0) return null;
  const sign = selectedVariation.priceModifier > 0 ? "+" : "-";
  return (
    <div className="mt-2 text-sm text-[var(--text-secondary)]">
      Base: {formatPrice(product.price)} {sign}
      {formatPrice(Math.abs(selectedVariation.priceModifier))}
    </div>
  );
};

interface VariationSelectorProps {
  readonly variations: ProductVariation[] | null | undefined;
  readonly selectedVariation: ProductVariation | null;
  readonly formatPrice: (amount: number) => string;
  readonly onSelect: (v: ProductVariation) => void;
  readonly onSelectBase: () => void;
  readonly basePrice: number;
  readonly cartQuantities: Record<string, number>;
}

const baseButtonClass = (isSelected: boolean) => {
  const base =
    "p-4 border-2 rounded-xl transition-all duration-300 focus-warm text-left";
  return isSelected
    ? `${base} border-[var(--accent-warm)] bg-[var(--accent-cream)] shadow-warm scale-105`
    : `${base} border-[var(--border-warm)] hover:border-[var(--accent-warm)] hover:shadow-warm hover:scale-105 bg-[var(--accent-cream)]/50`;
};

const VariationSelector = ({
  variations,
  selectedVariation,
  formatPrice,
  onSelect,
  onSelectBase,
  basePrice,
  cartQuantities,
}: VariationSelectorProps) => {
  if (!variations || variations.length === 0) return null;
  const baseInCart = cartQuantities["__base__"] ?? 0;
  return (
    <div className="mb-6">
      <span
        className="block text-lg font-semibold text-[var(--foreground)] mb-3"
        id="variation-selector-label"
      >
        Select Design
      </span>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onSelectBase}
          aria-label="Select standard base design"
          aria-pressed={selectedVariation === null}
          className={baseButtonClass(selectedVariation === null)}
        >
          <div className="text-sm font-bold text-[var(--foreground)]">
            Standard
          </div>
          <div className="text-xs text-[var(--text-secondary)] mt-1">
            Base design
          </div>
          <div className="text-xs font-semibold text-[var(--accent-warm)] mt-1">
            {formatPrice(basePrice)}
          </div>
          {baseInCart > 0 && (
            <div className="text-xs font-semibold text-blue-600 mt-1">
              {baseInCart} in cart
            </div>
          )}
        </button>
        {variations.map((variation) => (
          <VariationButton
            key={variation.id}
            variation={variation}
            isSelected={selectedVariation?.id === variation.id}
            formatPrice={formatPrice}
            onSelect={onSelect}
            cartQuantity={cartQuantities[variation.id] ?? 0}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Image Section ────────────────────────────────────────

interface ProductImageSectionProps {
  readonly images: string[];
  readonly productName: string;
}

const ProductImageSection = ({
  images,
  productName,
}: ProductImageSectionProps) => (
  <div className="relative">
    <ImageCarousel images={images} productName={productName} />
    <ButterflyAccent className="absolute -top-4 -left-4 w-10 h-10 opacity-30 hidden sm:block animate-float-gentle" />
  </div>
);

// ─── Info Card ────────────────────────────────────────────

interface ProductInfoCardProps {
  readonly product: Product;
  readonly formatPrice: (amount: number) => string;
  readonly effectivePrice: number;
  readonly selectedVariation: ProductVariation | null;
  readonly setSelectedVariation: (v: ProductVariation | null) => void;
  readonly effectiveStock: number;
  readonly cartQuantities: Record<string, number>;
}

const ProductInfoCard = ({
  product,
  formatPrice,
  effectivePrice,
  selectedVariation,
  setSelectedVariation,
  effectiveStock,
  cartQuantities,
}: ProductInfoCardProps) => {
  return (
    <div className="bg-[var(--surface)]/80 backdrop-blur-lg rounded-2xl shadow-warm border border-[var(--border-warm)] p-8 mb-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h1 className="text-4xl font-display font-bold text-warm-heading italic">
          {product.name}
        </h1>
        <ShareButton
          productId={product.id}
          variationId={selectedVariation?.id ?? null}
        />
      </div>

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
        <PriceModifierDisplay
          product={product}
          selectedVariation={selectedVariation}
          formatPrice={formatPrice}
        />
      </div>

      <div className="mb-6">
        <ProductStockBadge stock={effectiveStock} />
      </div>

      <VariationSelector
        variations={product.variations}
        selectedVariation={selectedVariation}
        formatPrice={formatPrice}
        onSelect={setSelectedVariation}
        onSelectBase={() => setSelectedVariation(null)}
        basePrice={product.price}
        cartQuantities={cartQuantities}
      />
    </div>
  );
};

// ─── Add-to-Cart Section ──────────────────────────────────

interface AddToCartSectionProps {
  readonly error: string;
  readonly cartSuccess: boolean;
  readonly stockWarning: string;
  readonly quantity: number;
  readonly quantityMessage: string;
  readonly setQuantity: (q: number) => void;
  readonly effectiveStock: number;
  readonly effectivePrice: number;
  readonly addingToCart: boolean;
  readonly handleAddToCart: () => void;
  readonly formatPrice: (amount: number) => string;
  readonly currentCartQuantity: number;
}

const AddToCartSection = ({
  error,
  cartSuccess,
  stockWarning,
  quantity,
  quantityMessage,
  setQuantity,
  effectiveStock,
  effectivePrice,
  addingToCart,
  handleAddToCart,
  formatPrice,
  currentCartQuantity,
}: AddToCartSectionProps) => {
  return (
    <div className="bg-[var(--surface)]/80 backdrop-blur-lg rounded-2xl shadow-warm border border-[var(--border-warm)] p-8">
      {currentCartQuantity > 0 && (
        <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-200 flex items-center gap-3">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <span className="font-medium text-sm">
            You already have <strong>{currentCartQuantity}</strong> of this item
            in your{" "}
            <Link href="/cart" className="underline font-semibold">
              cart
            </Link>
          </span>
        </div>
      )}

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
          <span className="font-semibold">Added to cart!</span>
        </div>
      )}

      {stockWarning && (
        <div className="mb-4 p-4 bg-amber-500/10 text-amber-700 rounded-xl border border-amber-500/20 flex items-start gap-3">
          <svg
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="font-medium">{stockWarning}</span>
        </div>
      )}

      <div className="mb-5">
        <label
          htmlFor="quantity-input"
          className="block text-sm font-semibold text-[var(--foreground)] mb-2"
        >
          Quantity
        </label>
        <select
          id="quantity-input"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          aria-label="Select quantity"
          aria-describedby={quantityMessage ? "quantity-message" : undefined}
          className="w-full px-3 py-2.5 border-2 border-[var(--border-warm)] rounded-lg text-base font-semibold text-[var(--foreground)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)] focus:border-transparent transition-colors cursor-pointer"
        >
          {Array.from(
            { length: Math.min(effectiveStock, 10) },
            (_, i) => i + 1,
          ).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        {quantityMessage && (
          <p
            id="quantity-message"
            className="mt-1.5 text-sm font-medium text-[var(--accent-rose)] flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            {quantityMessage}
          </p>
        )}
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
          {addingToCart ? <AddingSpinner /> : <CartButtonLabel />}
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
};

// ─── Main Component ───────────────────────────────────────

export default function ProductClient({
  product,
  initialVariationId,
}: ProductClientProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { formatPrice } = useCurrency();
  const cart = useSelector((state: RootState) => state.cart.cart);
  const { trackProduct } = useRecentlyViewed();
  // Use a ref so the effect only depends on product.id, not on trackProduct identity
  const trackProductRef = useRef(trackProduct);
  trackProductRef.current = trackProduct;
  const [quantity, setQuantity] = useState(1);
  const [quantityMessage, setQuantityMessage] = useState("");
  const [selectedVariation, setSelectedVariation] =
    useState<ProductVariation | null>(() =>
      resolveInitialVariation(product, initialVariationId),
    );
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartSuccess, setCartSuccess] = useState(false);
  const [error, setError] = useState("");
  const [stockWarning, setStockWarning] = useState("");

  // Fetch cart on mount so we can show "already in cart" indicators
  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  // Build a map of variationId (or "__base__") -> quantity in cart for this product
  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    if (!cart?.items) return map;
    for (const item of cart.items) {
      if (item.productId === product.id) {
        const key = item.variationId ?? "__base__";
        map[key] = (map[key] ?? 0) + item.quantity;
      }
    }
    return map;
  }, [cart?.items, product.id]);

  const currentCartQuantity =
    cartQuantities[selectedVariation?.id ?? "__base__"] ?? 0;

  // Track this product as recently viewed when product.id changes
  useEffect(() => {
    trackProductRef.current({
      id: product.id,
      name: product.name,
      image: product.image,
      price: product.price,
      category: product.category,
      viewedAt: Date.now(),
    });
  }, [
    product.id,
    product.name,
    product.image,
    product.price,
    product.category,
  ]);

  const effectivePrice = selectedVariation
    ? product.price + selectedVariation.priceModifier
    : product.price;

  const effectiveStock = selectedVariation
    ? selectedVariation.stock
    : product.stock;

  // Remaining stock accounts for items already in the user's cart
  const remainingStock = Math.max(0, effectiveStock - currentCartQuantity);

  // Clamp quantity when remaining stock changes (e.g. variation switch, cart update)
  useEffect(() => {
    const { qty, message } = getClampedQtyState(quantity, remainingStock);
    if (qty !== quantity) setQuantity(qty);
    setQuantityMessage(message);
  }, [remainingStock, quantity]);

  const carouselImages = useMemo(
    () => getCarouselImages(product, selectedVariation),
    [product, selectedVariation],
  );

  const handleAddToCart = async () => {
    setAddingToCart(true);
    setError("");
    setCartSuccess(false);
    setStockWarning("");

    try {
      const result = await dispatch(
        addToCart({
          productId: product.id,
          // null = base product (no variation); each variationId is a distinct cart line
          variationId: selectedVariation?.id ?? null,
          quantity,
        }),
      ).unwrap();

      if (result.warning) {
        // Auto-adjust quantity dropdown to max available
        if (result.adjustedQuantity) {
          setQuantity(Math.min(result.adjustedQuantity, remainingStock));
        }
        setStockWarning(result.warning);
        setCartSuccess(true);
        setTimeout(() => {
          setCartSuccess(false);
          setStockWarning("");
        }, 5000);
      } else {
        setCartSuccess(true);
        setTimeout(() => setCartSuccess(false), 3000);
      }
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <BreadcrumbNav productName={product.name} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <ProductImageSection
            images={carouselImages}
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
              effectiveStock={remainingStock}
              cartQuantities={cartQuantities}
            />

            {/* Add to Cart — or Out of Stock panel */}
            {remainingStock > 0 ? (
              <AddToCartSection
                error={error}
                cartSuccess={cartSuccess}
                stockWarning={stockWarning}
                quantity={quantity}
                quantityMessage={quantityMessage}
                setQuantity={setQuantity}
                effectiveStock={remainingStock}
                effectivePrice={effectivePrice}
                addingToCart={addingToCart}
                handleAddToCart={handleAddToCart}
                formatPrice={formatPrice}
                currentCartQuantity={currentCartQuantity}
              />
            ) : (
              <OutOfStockPanel currentCartQuantity={currentCartQuantity} />
            )}
          </div>
        </div>
      </main>

      {/* Reviews Section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <ReviewsSection productId={product.id} />
      </div>

      <RecentlyViewed />
    </div>
  );
}
