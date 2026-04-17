'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useDispatch, useSelector } from 'react-redux'
import { Product, ProductVariant } from '@/lib/types'
import { addToCart, fetchCart } from '@/features/cart/store/cartSlice'
import { addPendingCartItem } from '@/features/cart/services/pending-cart'
import { useCurrency } from '@/contexts/CurrencyContext'
import type { AppDispatch, RootState } from '@/lib/store'
import { StockBadge } from '@/features/product/components/StockBadge'
import { VariationButton } from '@/features/product/components/VariationButton'
import { ShareButton } from '@/features/product/components/ShareButton'
import { ButterflyAccent } from '@/components/ui/DecorativeElements'
import ImageCarousel from '@/features/product/components/ImageCarousel'
import { useRecentlyViewed } from '@/features/product/hooks/useRecentlyViewed'
import RecentlyViewed from '@/features/product/components/RecentlyViewed'
import { ReviewsSection } from '@/features/product/components/ReviewsSection'
import { getVariantMinPrice } from '@/features/product/variant-utils'

const ProductAssistant = dynamic(
  () => import('@/features/product/components/ProductAssistant'),
  { ssr: false }
)

interface ProductClientProps {
  readonly product: Product
  readonly initialVariantId: string | null
  readonly aiEnabled: boolean
}

const getVariantImages = (variant: ProductVariant): string[] =>
  [...(variant.image ? [variant.image] : []), ...(variant.images ?? [])].filter(
    Boolean
  )

const getProductImages = (product: Product): string[] =>
  [product.image, ...(product.images ?? [])].filter(Boolean)

const getCarouselImages = (
  product: Product,
  selectedVariant: ProductVariant | null
): string[] => {
  if (selectedVariant) {
    const imgs = getVariantImages(selectedVariant)
    if (imgs.length > 0) return imgs
  }
  return getProductImages(product)
}

const resolveInitialVariant = (
  product: Product,
  variantId: string | null
): ProductVariant | null => {
  if (!variantId) return product.variants?.[0] ?? null
  const variants = product.variants ?? []
  return (
    variants.find((v) => v.id === variantId) ?? product.variants?.[0] ?? null
  )
}

const getClampedQtyState = (
  quantity: number,
  stock: number
): { qty: number; message: string } => {
  if (stock === 0) return { qty: quantity, message: '' }
  if (quantity > stock)
    return { qty: stock, message: `Only ${stock} available` }
  return { qty: quantity, message: '' }
}

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
)

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
)

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
)

const OutOfStockPanel = ({
  currentCartQuantity,
}: {
  readonly currentCartQuantity: number
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
          You have all {currentCartQuantity} available{' '}
          {currentCartQuantity === 1 ? 'item' : 'items'} in your cart. No more
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
)

interface PriceModifierDisplayProps {
  readonly selectedVariant: ProductVariant | null
}

const PriceModifierDisplay = ({
  selectedVariant,
}: PriceModifierDisplayProps) => {
  if (!selectedVariant) return null
  return (
    <div className="mt-2 text-sm text-[var(--text-secondary)]">
      Variant price
    </div>
  )
}

interface VariantSelectorProps {
  readonly product: Product
  readonly selectedVariant: ProductVariant | null
  readonly formatPrice: (amount: number) => string
  readonly onSelect: (v: ProductVariant) => void
  readonly cartQuantities: Record<string, number>
}

const VariantSelector = ({
  product,
  selectedVariant,
  formatPrice,
  onSelect,
  cartQuantities,
}: VariantSelectorProps) => {
  const variants = product.variants ?? []
  const options = product.options ?? []

  if (variants.length === 0) return null

  if (options.length === 0) {
    return (
      <div className="mb-6 space-y-5">
        <span
          className="block text-lg font-semibold text-[var(--foreground)]"
          id="variation-selector-label"
        >
          Choose Your Option
        </span>
        <div className="grid grid-cols-2 gap-3">
          {variants.map((v) => (
            <VariationButton
              key={v.id}
              variant={v}
              label={v.sku ?? `Option ${variants.indexOf(v) + 1}`}
              isSelected={selectedVariant?.id === v.id}
              formatPrice={formatPrice}
              onSelect={onSelect}
              cartQuantity={cartQuantities[v.id] ?? 0}
            />
          ))}
        </div>
      </div>
    )
  }

  const getVariantOptionValues = (variant: ProductVariant) =>
    variant.optionValues?.map((ov) => ov.id) ?? []

  const getVariantLabel = (variant: ProductVariant): string => {
    if (!variant.optionValues || variant.optionValues.length === 0) {
      return variant.sku ?? `Variant`
    }
    const valueMap = new Map<string, string>()
    for (const opt of options) {
      for (const val of opt.values ?? []) {
        valueMap.set(val.id, val.value)
      }
    }
    const parts = variant.optionValues
      .map((ov) => valueMap.get(ov.id))
      .filter(Boolean)
    return parts.length > 0 ? parts.join(' / ') : (variant.sku ?? 'Variant')
  }

  const selectedOptionValues = new Map<string, string>()
  if (selectedVariant?.optionValues) {
    for (const ov of selectedVariant.optionValues) {
      const ovId = ov.id
      for (const opt of options) {
        if (opt.values?.some((v) => v.id === ovId)) {
          selectedOptionValues.set(opt.id, ovId)
        }
      }
    }
  }

  /**
   * For a given option, compute which of its values are available given the
   * current selections in *preceding* options (by sortOrder).
   *
   * Options are displayed in sortOrder.  The first option always shows every
   * value.  Each subsequent option is filtered by the selections made in all
   * options that come before it – a cascading pattern that prevents "dead-end"
   * states while still hiding impossible combinations.
   */
  const getAvailableValues = (optionId: string): Set<string> => {
    const optionIndex = options.findIndex((o) => o.id === optionId)

    // Collect selected values from preceding options only
    const precedingSelections: string[] = []
    for (let i = 0; i < optionIndex; i++) {
      const selVal = selectedOptionValues.get(options[i].id)
      if (selVal) precedingSelections.push(selVal)
    }

    const available = new Set<string>()
    for (const v of variants) {
      const variantValueIds = getVariantOptionValues(v)
      // Check that the variant matches every preceding option's selection
      const matchesPreceding = precedingSelections.every((selId) =>
        variantValueIds.includes(selId)
      )
      if (!matchesPreceding) continue
      // Collect which value of *this* option the variant carries
      const option = options.find((o) => o.id === optionId)
      for (const val of option?.values ?? []) {
        if (variantValueIds.includes(val.id)) {
          available.add(val.id)
        }
      }
    }
    return available
  }

  const handleOptionChange = (optionId: string, valueId: string) => {
    const newSelections = new Map(selectedOptionValues)
    newSelections.set(optionId, valueId)

    // Find a variant matching all current selections
    let matchingVariant = variants.find((v) => {
      const variantValueIds = getVariantOptionValues(v)
      return [...newSelections.values()].every((selectedValueId) =>
        variantValueIds.includes(selectedValueId)
      )
    })

    // If no exact match exists (e.g. user picked Red but current size has no
    // Red variant), clear downstream selections and pick the first variant
    // that includes the newly selected value.
    if (!matchingVariant) {
      matchingVariant = variants.find((v) => {
        const variantValueIds = getVariantOptionValues(v)
        return variantValueIds.includes(valueId)
      })
    }

    if (matchingVariant) {
      onSelect(matchingVariant)
    }
  }

  return (
    <div className="mb-6 space-y-5">
      <span
        className="block text-lg font-semibold text-[var(--foreground)]"
        id="variation-selector-label"
      >
        Choose Your Options
      </span>

      {options.map((option) => {
        const availableValueIds = getAvailableValues(option.id)
        return (
          <div key={option.id}>
            <span className="block text-sm font-semibold text-[var(--text-secondary)] mb-2">
              {option.name}
            </span>
            <div className="flex flex-wrap gap-2">
              {(option.values ?? [])
                .filter((val) => availableValueIds.has(val.id))
                .map((val) => {
                  const isActive =
                    selectedOptionValues.get(option.id) === val.id
                  return (
                    <button
                      key={val.id}
                      onClick={() => handleOptionChange(option.id, val.id)}
                      aria-pressed={isActive}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? 'bg-[var(--accent-warm)] text-white shadow-warm'
                          : 'bg-[var(--accent-cream)] text-[var(--text-secondary)] border border-[var(--border-warm)] hover:border-[var(--accent-warm)]'
                      }`}
                    >
                      {val.value}
                    </button>
                  )
                })}
            </div>
          </div>
        )
      })}

      {selectedVariant && (
        <div className="p-4 border-2 rounded-xl border-[var(--accent-warm)] bg-[var(--accent-cream)] shadow-warm">
          <div className="text-sm font-bold text-[var(--foreground)]">
            {getVariantLabel(selectedVariant)}
          </div>
          <div className="text-xs font-semibold text-[var(--accent-warm)] mt-1">
            {formatPrice(selectedVariant.price)}
          </div>
          {selectedVariant.stock > 0 && selectedVariant.stock < 6 && (
            <div className="text-xs text-[var(--accent-rose)] font-medium mt-1">
              Only {selectedVariant.stock} left
            </div>
          )}
          {(cartQuantities[selectedVariant.id] ?? 0) > 0 && (
            <div className="text-xs font-semibold text-blue-600 mt-1">
              {cartQuantities[selectedVariant.id]} in cart
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface ProductImageSectionProps {
  readonly images: string[]
  readonly productName: string
}

const ProductImageSection = ({
  images,
  productName,
}: ProductImageSectionProps) => (
  <div className="relative">
    <ImageCarousel images={images} productName={productName} />
    <ButterflyAccent className="absolute -top-4 -left-4 w-10 h-10 opacity-30 hidden sm:block animate-float-gentle" />
  </div>
)

interface ProductInfoCardProps {
  readonly product: Product
  readonly formatPrice: (amount: number) => string
  readonly effectivePrice: number
  readonly selectedVariant: ProductVariant | null
  readonly setSelectedVariant: (v: ProductVariant | null) => void
  readonly effectiveStock: number
  readonly cartQuantities: Record<string, number>
}

const ProductInfoCard = ({
  product,
  formatPrice,
  effectivePrice,
  selectedVariant,
  setSelectedVariant,
  effectiveStock,
  cartQuantities,
}: ProductInfoCardProps) => {
  return (
    <div className="mb-6 rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/80 p-6 shadow-warm backdrop-blur-lg sm:p-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h1 className="text-3xl font-display font-bold italic text-warm-heading sm:text-4xl">
          {product.name}
        </h1>
        <ShareButton
          productId={product.id}
          variantId={selectedVariant?.id ?? null}
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

      <div className="mb-6 rounded-xl border border-[var(--border-warm)] bg-gradient-to-r from-[var(--accent-blush)] to-[var(--border-warm)] p-4">
        <span className="text-4xl font-bold text-warm-heading sm:text-5xl">
          {formatPrice(effectivePrice)}
        </span>
        <PriceModifierDisplay selectedVariant={selectedVariant} />
      </div>

      <div className="mb-6">
        <StockBadge stock={effectiveStock} showIcon size="md" />
      </div>

      <VariantSelector
        product={product}
        selectedVariant={selectedVariant}
        formatPrice={formatPrice}
        onSelect={setSelectedVariant}
        cartQuantities={cartQuantities}
      />
    </div>
  )
}

interface AddToCartSectionProps {
  readonly error: string
  readonly cartSuccess: boolean
  readonly stockWarning: string
  readonly quantity: number
  readonly quantityMessage: string
  readonly setQuantity: (q: number) => void
  readonly effectiveStock: number
  readonly effectivePrice: number
  readonly addingToCart: boolean
  readonly handleAddToCart: () => void
  readonly formatPrice: (amount: number) => string
  readonly currentCartQuantity: number
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
    <div className="rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/80 p-6 shadow-warm backdrop-blur-lg sm:p-8">
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
            in your{' '}
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
          aria-describedby={quantityMessage ? 'quantity-message' : undefined}
          className="w-full px-3 py-2.5 border-2 border-[var(--border-warm)] rounded-lg text-base font-semibold text-[var(--foreground)] bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)] focus:border-transparent transition-colors cursor-pointer"
        >
          {Array.from(
            { length: Math.min(effectiveStock, 10) },
            (_, i) => i + 1
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

      <div className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-[var(--accent-blush)] to-[var(--border-warm)] p-3">
        <span className="text-sm font-semibold text-[var(--text-secondary)]">
          Total:
        </span>
        <span className="text-right text-xl font-bold bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] bg-clip-text text-transparent sm:text-2xl">
          {formatPrice(effectivePrice * quantity)}
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleAddToCart}
          disabled={addingToCart}
          className="flex-1 bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] text-white py-4 rounded-xl font-bold text-lg hover:from-[var(--accent-rose)] hover:to-[var(--accent-warm)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-warm hover:shadow-warm-lg focus-warm"
        >
          {addingToCart ? <AddingSpinner /> : <CartButtonLabel />}
        </button>

        <Link
          href="/cart"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-blush)] px-5 py-4 font-bold text-[var(--text-secondary)] transition-all duration-300 hover:bg-[var(--accent-peach)]/50 focus-warm sm:w-auto sm:flex-shrink-0"
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
  )
}

export default function ProductClient({
  product,
  initialVariantId,
  aiEnabled,
}: ProductClientProps) {
  const { status } = useSession()
  const dispatch = useDispatch<AppDispatch>()
  const { formatPrice } = useCurrency()
  const cart = useSelector((state: RootState) => state.cart.cart)
  const { trackProduct } = useRecentlyViewed()

  const trackProductRef = useRef(trackProduct)
  trackProductRef.current = trackProduct
  const [quantity, setQuantity] = useState(1)
  const [quantityMessage, setQuantityMessage] = useState('')
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    () => resolveInitialVariant(product, initialVariantId)
  )
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartSuccess, setCartSuccess] = useState(false)
  const [error, setError] = useState('')
  const [stockWarning, setStockWarning] = useState('')

  useEffect(() => {
    if (status !== 'authenticated') return
    dispatch(fetchCart())
  }, [dispatch, status])

  const cartQuantities = useMemo(() => {
    const map: Record<string, number> = {}
    if (!cart?.items) return map
    for (const item of cart.items) {
      if (item.productId === product.id) {
        const key = item.variantId ?? '__base__'
        map[key] = (map[key] ?? 0) + item.quantity
      }
    }
    return map
  }, [cart?.items, product.id])

  const currentCartQuantity =
    cartQuantities[selectedVariant?.id ?? '__base__'] ?? 0

  useEffect(() => {
    trackProductRef.current({
      id: product.id,
      name: product.name,
      image: product.image,
      price: getVariantMinPrice(product.variants),
      category: product.category,
      viewedAt: Date.now(),
    })
  }, [
    product.id,
    product.name,
    product.image,
    product.variants,
    product.category,
  ])

  const effectivePrice =
    selectedVariant?.price ?? getVariantMinPrice(product.variants)

  const effectiveStock = selectedVariant?.stock ?? 0

  const remainingStock = Math.max(0, effectiveStock - currentCartQuantity)

  useEffect(() => {
    const { qty, message } = getClampedQtyState(quantity, remainingStock)
    if (qty !== quantity) setQuantity(qty)
    setQuantityMessage(message)
  }, [remainingStock, quantity])

  const carouselImages = useMemo(
    () => getCarouselImages(product, selectedVariant),
    [product, selectedVariant]
  )

  const handleAddToCart = async () => {
    setAddingToCart(true)
    setError('')
    setCartSuccess(false)
    setStockWarning('')

    if (!selectedVariant) {
      setError('Please select a variant before adding to cart.')
      setAddingToCart(false)
      return
    }

    try {
      if (status !== 'authenticated') {
        addPendingCartItem({
          productId: product.id,
          variantId: selectedVariant.id,
          quantity,
        })
        setCartSuccess(true)
        setTimeout(() => setCartSuccess(false), 3000)
        return
      }

      const result = await dispatch(
        addToCart({
          productId: product.id,
          variantId: selectedVariant.id,
          quantity,
        })
      ).unwrap()

      if (result.warning) {
        if (result.adjustedQuantity) {
          setQuantity(Math.min(result.adjustedQuantity, remainingStock))
        }
        setStockWarning(result.warning)
        setCartSuccess(true)
        setTimeout(() => {
          setCartSuccess(false)
          setStockWarning('')
        }, 5000)
      } else {
        setCartSuccess(true)
        setTimeout(() => setCartSuccess(false), 3000)
      }
    } catch (err) {
      setError(
        typeof err === 'string'
          ? err
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setAddingToCart(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
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
              selectedVariant={selectedVariant}
              setSelectedVariant={setSelectedVariant}
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

      {aiEnabled && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <ProductAssistant productId={product.id} productName={product.name} />
        </div>
      )}

      {/* Reviews Section */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <ReviewsSection productId={product.id} />
      </div>

      <RecentlyViewed />
    </div>
  )
}
