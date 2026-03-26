"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useSelector, useDispatch } from "react-redux";
import { CartItemWithProduct } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { AlertBanner } from "@/components/ui/AlertBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { AuthRequiredState } from "@/components/ui/AuthRequiredState";
import { Card } from "@/components/ui/Card";
import { GradientHeading } from "@/components/ui/GradientHeading";
import {
  fetchCart,
  updateCartItem,
  removeCartItem,
  selectCart,
  selectCartLoading,
} from "@/lib/features/cart/cartSlice";
import type { AppDispatch } from "@/lib/store";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { CheckoutForm } from "@/components/cart/CheckoutForm";
import CartGlyph from "@/components/icons/CartGlyph";
import { LeafAccent } from "@/components/ui/DecorativeElements";
import { buildCheckoutPricingSummary } from "@/lib/order-summary";
import { CartPricingSummary } from "@/components/cart/CartPricingSummary";

export default function CartPage() {
  const { data: session, status } = useSession();
  const dispatch = useDispatch<AppDispatch>();
  const cart = useSelector(selectCart);
  const loading = useSelector(selectCartLoading);
  const { formatPrice } = useCurrency();
  const [updating, setUpdating] = useState<string | null>(null);
  const [customizationNotes, setCustomizationNotes] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    dispatch(fetchCart());
  }, [dispatch, status]);

  const handleUpdateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity < 1) return;

      setUpdating(itemId);
      try {
        await dispatch(updateCartItem({ itemId, quantity })).unwrap();
      } catch (err) {
        setError(
          typeof err === "string"
            ? err
            : "Something went wrong. Please try again.",
        );
      } finally {
        setUpdating(null);
      }
    },
    [dispatch],
  );

  const handleRemoveItem = useCallback(
    async (itemId: string) => {
      setUpdating(itemId);
      try {
        await dispatch(removeCartItem(itemId)).unwrap();
      } catch (err) {
        setError(
          typeof err === "string"
            ? err
            : "Something went wrong. Please try again.",
        );
      } finally {
        setUpdating(null);
      }
    },
    [dispatch],
  );

  const pricingSummary = useMemo(
    () => buildCheckoutPricingSummary(cart?.items ?? []),
    [cart?.items],
  );

  const handleCustomizationChange = useCallback(
    (itemId: string, note: string) => {
      setCustomizationNotes((prev) => ({ ...prev, [itemId]: note }));
    },
    [],
  );

  if ((loading && cart === null) || status === "loading") {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        </main>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-warm-gradient">
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16">
          <AuthRequiredState
            callbackUrl="/cart"
            message="Please sign in to view your cart and place orders."
          />
          <Link
            href="/shop"
            className="block mt-4 text-[var(--text-muted)] hover:text-[var(--text-secondary)] font-medium text-center"
          >
            Continue Shopping
          </Link>
        </main>
      </div>
    );
  }

  const isEmpty = !cart?.items || cart.items.length === 0;

  return (
    <div className="min-h-screen bg-warm-gradient">
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 relative">
        <LeafAccent className="absolute top-32 right-4 w-8 h-8 opacity-20 hidden sm:block animate-float-gentle" />
        <LeafAccent className="absolute bottom-20 left-2 w-10 h-10 opacity-15 hidden sm:block animate-float-slow" />

        <GradientHeading className="mb-8">Shopping Cart</GradientHeading>

        {error && (
          <AlertBanner
            message={error}
            variant="error"
            onDismiss={() => setError("")}
            className="mb-6"
          />
        )}

        {isEmpty ? (
          <Card className="p-12 text-center">
            <EmptyState
              icon={
                <CartGlyph className="inline-block h-28 w-28 shrink-0 text-[var(--accent-peach)]" />
              }
              title="Your cart is empty"
              message="Add some products to get started!"
              ctaText="Browse Products"
              ctaHref="/shop"
              className="py-0"
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <Card className="overflow-hidden">
                {cart.items.map((item: CartItemWithProduct, index: number) => (
                  <CartItemRow
                    key={item.id}
                    item={item}
                    isLast={index === cart.items.length - 1}
                    updating={updating}
                    customizationNote={customizationNotes[item.id] || ""}
                    formatPrice={formatPrice}
                    onUpdateQuantity={handleUpdateQuantity}
                    onRemoveItem={handleRemoveItem}
                    onCustomizationChange={handleCustomizationChange}
                  />
                ))}
              </Card>

              <Link
                href="/shop"
                className="inline-flex items-center gap-2 mt-4 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-colors font-medium"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Continue Shopping
              </Link>
            </div>

            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-28">
                <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
                  Order Summary
                </h2>

                <CartPricingSummary
                  className="mb-4"
                  itemCount={pricingSummary.itemCount}
                  subtotal={formatPrice(pricingSummary.subtotal)}
                  shipping={
                    pricingSummary.shippingAmount === 0
                      ? "Free"
                      : formatPrice(pricingSummary.shippingAmount)
                  }
                  total={formatPrice(pricingSummary.total)}
                />

                <div className="mb-4 p-3 bg-[var(--accent-blush)]/50 rounded-lg border border-[var(--border-warm)] text-center">
                  <p className="text-xs text-[var(--text-muted)]">
                    Payment integration coming soon
                  </p>
                </div>

                <CheckoutForm customizationNotes={customizationNotes} />
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
