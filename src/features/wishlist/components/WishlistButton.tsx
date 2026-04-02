"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "@/lib/store";
import {
  fetchWishlist,
  addToWishlist,
  removeFromWishlist,
  optimisticToggle,
} from "@/features/wishlist/store/wishlistSlice";

interface WishlistButtonProps {
  readonly productId: string;
  readonly productName: string;
  readonly className?: string;
}

export const WishlistButton = ({
  productId,
  productName,
  className = "",
}: WishlistButtonProps) => {
  const { data: session } = useSession();
  const dispatch = useDispatch<AppDispatch>();
  const productIds = useSelector(
    (state: RootState) => state.wishlist.productIds,
  );
  const wishlistLoaded = useSelector(
    (state: RootState) =>
      !state.wishlist.loading && state.wishlist.productIds !== undefined,
  );
  const isWishlisted = productIds.includes(productId);

  // Fetch wishlist once when user is authenticated and not yet loaded
  useEffect(() => {
    if (session?.user?.id && !wishlistLoaded) {
      dispatch(fetchWishlist());
    }
  }, [session?.user?.id, wishlistLoaded, dispatch]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user?.id) {
      // Not logged in — do nothing (could open login modal in future)
      return;
    }

    // Optimistic update for instant UI feedback
    dispatch(optimisticToggle(productId));

    if (isWishlisted) {
      await dispatch(removeFromWishlist(productId));
    } else {
      await dispatch(addToWishlist(productId));
    }
  };

  return (
    <button
      type="button"
      className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-[var(--surface)]/90 backdrop-blur-sm border flex items-center justify-center transition-all duration-200 shadow-warm focus-warm ${
        isWishlisted
          ? "bg-[var(--accent-blush)] border-[var(--accent-pink)] text-[var(--accent-pink)] scale-110"
          : "border-[var(--border-warm)] text-[var(--accent-pink)] hover:bg-[var(--accent-blush)] hover:scale-110 hover:border-[var(--accent-pink)]"
      } ${className}`}
      aria-label={
        isWishlisted
          ? `Remove ${productName} from wishlist`
          : `Add ${productName} to wishlist`
      }
      aria-pressed={isWishlisted}
      onClick={handleToggle}
    >
      <svg
        className="w-5 h-5"
        fill={isWishlisted ? "currentColor" : "none"}
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </button>
  );
};
