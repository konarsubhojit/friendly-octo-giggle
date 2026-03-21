"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchCart, selectCartItemCount } from "@/lib/features/cart/cartSlice";
import type { AppDispatch } from "@/lib/store";
import { FloralCartIcon } from "@/components/ui/DecorativeElements";

const CartIcon = () => {
  const dispatch = useDispatch<AppDispatch>();
  const itemCount = useSelector(selectCartItemCount);

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  return (
    <Link
      href="/cart"
      className="relative text-[var(--text-secondary)] hover:text-[var(--accent-rose)] transition-all duration-300 focus-warm rounded-full"
      aria-label="Shopping cart"
    >
      <FloralCartIcon className="w-6 h-6" />
      {itemCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-gradient-to-r from-[var(--accent-rose)] to-[var(--accent-pink)] text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-warm">
          {itemCount}
        </span>
      )}
    </Link>
  );
}
export default CartIcon;
