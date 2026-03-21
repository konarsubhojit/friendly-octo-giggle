"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSelector, useDispatch } from "react-redux";
import { CartItemWithProduct } from "@/lib/types";
import { useCurrency } from "@/contexts/CurrencyContext";
import {
  DynamicForm,
  type FieldDef,
  type SubmitResult,
} from "@/components/ui/DynamicForm";
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
  clearCart,
  selectCart,
  selectCartLoading,
} from "@/lib/features/cart/cartSlice";
import type { AppDispatch } from "@/lib/store";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { LeafAccent } from "@/components/ui/DecorativeElements";

export default function CartPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const dispatch = useDispatch<AppDispatch>();
  const cart = useSelector(selectCart);
  const loading = useSelector(selectCartLoading);
  const { formatPrice } = useCurrency();
  const [updating, setUpdating] = useState<string | null>(null);
  const [customizationNotes, setCustomizationNotes] = useState<
    Record<string, string>
  >({});
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

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

  const cartTotal = useMemo(() => {
    if (!cart?.items) return 0;
    return cart.items.reduce((total, item) => {
      const price = item.variation
        ? item.product.price + item.variation.priceModifier
        : item.product.price;
      return total + price * item.quantity;
    }, 0);
  }, [cart?.items]);

  const cartItemCount = useMemo(
    () => cart?.items?.reduce((s, i) => s + i.quantity, 0) ?? 0,
    [cart?.items],
  );

  const handleCustomizationChange = useCallback(
    (itemId: string, note: string) => {
      setCustomizationNotes((prev) => ({ ...prev, [itemId]: note }));
    },
    [],
  );

  const submitOrderToApi = useCallback(
    async (address: string, notes: Record<string, string>): Promise<void> => {
      const orderData = {
        customerAddress: address,
        items: (cart?.items ?? []).map((item) => ({
          productId: item.productId,
          variationId: item.variationId,
          quantity: item.quantity,
          price: item.variation
            ? item.product.price + item.variation.priceModifier
            : item.product.price,
          customizationNote: notes[item.id] || null,
        })),
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to place order");
      }

      await dispatch(clearCart()).unwrap();
      setOrderSuccess(true);
      setTimeout(() => {
        router.push("/orders");
      }, 2000);
    },
    [cart, dispatch, router],
  );

  const handleOrderSubmit = useCallback(
    async (values: Readonly<Record<string, string>>): Promise<SubmitResult> => {
      if (!session?.user) {
        router.push("/auth/signin?callbackUrl=/cart");
        return;
      }
      if (!cart?.items.length) return "Your cart is empty.";
      try {
        await submitOrderToApi(values.customerAddress, customizationNotes);
      } catch (err: unknown) {
        return err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.";
      }
    },
    [session, router, submitOrderToApi, customizationNotes, cart],
  );

  const ADDRESS_FIELDS: ReadonlyArray<FieldDef> = [
    {
      id: "shipping-address",
      name: "customerAddress",
      label: "Shipping Address",
      type: "textarea",
      rows: 3,
      placeholder: "Enter your shipping address",
      validate: (v) =>
        v.trim() ? undefined : "Please enter a shipping address.",
    },
  ];

  const CART_SUBMIT_BTN =
    "w-full bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white py-3.5 rounded-full font-bold text-base hover:from-[var(--accent-pink)] hover:to-[var(--accent-rose)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-warm hover:shadow-warm-lg focus-warm";

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
        {/* Decorative leaf accents */}
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

        {orderSuccess && (
          <AlertBanner
            variant="success"
            className="mb-6"
            message={
              <div>
                <div className="font-bold text-lg">
                  Order Placed Successfully!
                </div>
                <div className="text-sm">
                  Thank you for your order. Redirecting to your orders...
                </div>
              </div>
            }
          />
        )}

        {isEmpty ? (
          <Card className="p-12 text-center">
            <EmptyState
              icon={
                <svg
                  className="w-20 h-20 text-[var(--accent-peach)]"
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
            {/* Cart Items */}
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

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="p-6 sticky top-28">
                <h2 className="text-lg font-bold text-[var(--foreground)] mb-4">
                  Order Summary
                </h2>

                <div className="space-y-3 mb-4 text-sm">
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>Subtotal ({cartItemCount} items)</span>
                    <span className="font-medium">
                      {formatPrice(cartTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>Shipping</span>
                    <span className="text-[var(--accent-sage)] font-medium">
                      Free
                    </span>
                  </div>
                  <div className="border-t border-[var(--border-warm)] pt-3 flex justify-between">
                    <span className="font-bold text-[var(--foreground)]">
                      Total
                    </span>
                    <span className="text-xl font-bold text-warm-heading">
                      {formatPrice(cartTotal)}
                    </span>
                  </div>
                </div>

                {/* Payment placeholder */}
                <div className="mb-4 p-3 bg-[var(--accent-blush)]/50 rounded-lg border border-[var(--border-warm)] text-center">
                  <p className="text-xs text-[var(--text-muted)]">
                    Payment integration coming soon
                  </p>
                </div>

                {/* Shipping address + Place Order */}
                <DynamicForm
                  fields={ADDRESS_FIELDS}
                  onSubmit={handleOrderSubmit}
                  submitLabel="Place Order"
                  submittingLabel="Processing..."
                  submitButtonClassName={CART_SUBMIT_BTN}
                />
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
