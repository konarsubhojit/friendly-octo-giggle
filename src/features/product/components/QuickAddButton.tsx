"use client";

import { useState, useCallback } from "react";
import type { MouseEvent } from "react";
import { useDispatch } from "react-redux";
import { useSession } from "next-auth/react";
import type { AppDispatch } from "@/lib/store";
import { addToCart } from "@/features/cart/store/cartSlice";
import { addPendingCartItem } from "@/features/cart/services/pending-cart";
import toast from "react-hot-toast";
import type { Product } from "@/lib/types";

type QuickAddProduct = Pick<Product, "id" | "name" | "stock">;

export function QuickAddButton({
  product,
}: {
  readonly product: QuickAddProduct;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const { status } = useSession();
  const [adding, setAdding] = useState(false);

  const handleQuickAdd = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setAdding(true);
      try {
        if (status !== "authenticated") {
          addPendingCartItem({
            productId: product.id,
            variationId: null,
            quantity: 1,
          });
          toast.success(`${product.name} saved! Sign in to checkout.`);
          return;
        }

        const result = await dispatch(
          addToCart({ productId: product.id, quantity: 1 }),
        ).unwrap();
        if (result.warning) {
          toast(result.warning, { icon: "⚠️" });
        } else {
          toast.success(`${product.name} added to cart!`);
        }
      } catch (err) {
        toast.error(
          typeof err === "string"
            ? err
            : "Failed to add to cart. Please try again.",
        );
      } finally {
        setAdding(false);
      }
    },
    [dispatch, product, status],
  );

  if (product.stock === 0) return null;

  return (
    <button
      onClick={handleQuickAdd}
      disabled={adding}
      aria-label={`Add ${product.name} to cart`}
      className="absolute bottom-4 right-4 z-20 bg-[var(--surface)]/90 hover:bg-gradient-to-r hover:from-[var(--accent-rose)] hover:to-[var(--accent-pink)] text-[var(--accent-rose)] hover:text-white rounded-full p-2.5 shadow-warm transition-all duration-200 hover:scale-110 hover:shadow-warm-lg disabled:opacity-50 border border-[var(--border-warm)] focus-warm"
    >
      {adding ? (
        <svg
          className="w-5 h-5 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
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
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        <svg
          className="w-5 h-5"
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
      )}
    </button>
  );
}
