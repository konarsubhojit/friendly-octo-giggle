'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useDispatch, useSelector } from 'react-redux'
import { Product, ProductVariant } from '@/lib/types'
import { addToCart, fetchCart } from '@/features/cart/store/cartSlice'
import { addPendingCartItem } from '@/features/cart/services/pending-cart'
import { useCurrency } from '@/contexts/CurrencyContext'
import type { AppDispatch, RootState } from '@/lib/store'
import { useRecentlyViewed } from '@/features/product/hooks/useRecentlyViewed'
import RecentlyViewed from '@/features/product/components/RecentlyViewed'
import { ReviewsSection } from '@/features/product/components/ReviewsSection'
import { getVariantMinPrice } from '@/features/product/variant-utils'
import { BreadcrumbNav } from './components/BreadcrumbNav'
import { OutOfStockPanel } from './components/OutOfStockPanel'
import { ProductImageSection } from './components/ProductImageSection'
import { ProductInfoCard } from './components/ProductInfoCard'
import { CartStatusAlerts } from './components/CartStatusAlerts'
import { AddToCartSection } from './components/AddToCartSection'
import { StickyMobileActionBar } from './components/StickyMobileActionBar'
import { getClampedQtyState, resolveInitialVariant } from './lib/variant-utils'
import { getCarouselImages } from './lib/images'
import { applyCartResult, computeCartQuantities } from './lib/cart-quantities'

const ProductAssistant = dynamic(
  () => import('@/features/product/components/ProductAssistant'),
  { ssr: false }
)

interface ProductClientProps {
  readonly product: Product
  readonly initialVariantId: string | null
  readonly aiEnabled: boolean
}

const ProductClient = ({
  product,
  initialVariantId,
  aiEnabled,
}: ProductClientProps) => {
  const { status } = useSession()
  const dispatch = useDispatch<AppDispatch>()
  const { formatPrice } = useCurrency()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const cart = useSelector((state: RootState) => state.cart.cart)
  const { trackProduct } = useRecentlyViewed()

  const trackProductRef = useRef(trackProduct)

  useEffect(() => {
    trackProductRef.current = trackProduct
  }, [trackProduct])
  const [quantity, setQuantity] = useState(1)
  const [quantityMessage, setQuantityMessage] = useState('')
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    () => resolveInitialVariant(product, initialVariantId)
  )

  /**
   * Update selected variant AND reflect it in the URL as `?v=<id>` so users
   * can share the exact variant by copying the address bar. We use
   * `router.replace` (no new history entry) with `scroll: false` so the page
   * doesn't jump on each click.
   */
  const handleVariantSelect = useCallback(
    (variant: ProductVariant | null) => {
      setSelectedVariant(variant)
      const params = new URLSearchParams(searchParams.toString())
      if (variant) {
        params.set('v', variant.id)
      } else {
        params.delete('v')
      }
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )
  const [addingToCart, setAddingToCart] = useState(false)
  const [cartSuccess, setCartSuccess] = useState(false)
  const [error, setError] = useState('')
  const [stockWarning, setStockWarning] = useState('')

  useEffect(() => {
    if (status !== 'authenticated') return
    dispatch(fetchCart())
  }, [dispatch, status])

  const cartQuantities = useMemo(
    () => computeCartQuantities(cart?.items, product.id),
    [cart?.items, product.id]
  )

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

    const timer = globalThis.setTimeout(() => {
      if (qty !== quantity) {
        setQuantity(qty)
      }
      setQuantityMessage(message)
    }, 0)

    return () => {
      globalThis.clearTimeout(timer)
    }
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

      applyCartResult(
        result,
        remainingStock,
        setQuantity,
        setStockWarning,
        setCartSuccess
      )
    } catch (err) {
      const message =
        typeof err === 'string'
          ? err
          : 'Something went wrong. Please try again.'
      setError(message)
    } finally {
      setAddingToCart(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-28 md:pb-16">
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
              setSelectedVariant={handleVariantSelect}
              effectiveStock={remainingStock}
              cartQuantities={cartQuantities}
            />

            {/* Add to Cart — or Out of Stock panel (hidden on mobile; sticky bar handles it) */}
            {/*
             * CartStatusAlerts is rendered once here (unconditionally) so that:
             *  - On mobile: alerts are visible above the sticky bottom bar
             *  - On desktop: alerts appear above the AddToCartSection card
             * The desktop AddToCartSection passes showAlerts={false} to avoid
             * a second render and duplicate announcements in jsdom tests.
             */}
            <CartStatusAlerts
              currentCartQuantity={currentCartQuantity}
              error={error}
              cartSuccess={cartSuccess}
              stockWarning={stockWarning}
            />
            <div className="hidden md:block">
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
                  showAlerts={false}
                />
              ) : (
                <OutOfStockPanel currentCartQuantity={currentCartQuantity} />
              )}
            </div>
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

      {/* Sticky mobile action bar */}
      <StickyMobileActionBar
        remainingStock={remainingStock}
        addingToCart={addingToCart}
        handleAddToCart={handleAddToCart}
        productId={product.id}
        productName={product.name}
        effectivePrice={effectivePrice}
        quantity={quantity}
        quantityMessage={quantityMessage}
        setQuantity={setQuantity}
        formatPrice={formatPrice}
      />
    </div>
  )
}

export default ProductClient
