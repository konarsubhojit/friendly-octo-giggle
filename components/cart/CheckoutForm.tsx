"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSelector } from "react-redux";
import { selectCart } from "@/lib/features/cart/cartSlice";
import { GradientButton } from "@/components/ui/GradientButton";
import {
  buildCheckoutSummaryLineItems,
} from "@/lib/order-summary";
import toast from "react-hot-toast";

const PENDING_CHECKOUT_KEY = "pending_checkout";

interface CheckoutFormProps {
  readonly customizationNotes: Record<string, string>;
}

export const CheckoutForm = ({ customizationNotes }: CheckoutFormProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const cart = useSelector(selectCart);

  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);

  const cartItems = useMemo(() => cart?.items ?? [], [cart?.items]);
  const checkoutItems = useMemo(
    () =>
      cartItems.map((item) => ({
        ...item,
        customizationNote: customizationNotes[item.id] ?? null,
      })),
    [cartItems, customizationNotes],
  );
  const lineItems = useMemo(
    () => buildCheckoutSummaryLineItems(checkoutItems),
    [checkoutItems],
  );

  const handleSubmit: NonNullable<React.ComponentProps<"form">["onSubmit"]> = (
    e,
  ) => {
    e.preventDefault();

    if (!session?.user?.id || !session.user.email) {
      router.push("/auth/signin?callbackUrl=/cart");
      return;
    }

    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 10) {
      setAddressError("Please enter a valid shipping address.");
      return;
    }
    setAddressError(null);

    if (!cartItems.length) {
      toast.error("Your cart is empty.");
      return;
    }

    try {
      sessionStorage.setItem(
        PENDING_CHECKOUT_KEY,
        JSON.stringify({ address: trimmedAddress, customizationNotes }),
      );
    } catch {
      toast.error("Unable to proceed. Please try again.");
      return;
    }

    router.push("/checkout/review");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="checkout-address"
          className="block text-sm font-semibold text-[var(--foreground)] mb-1.5"
        >
          Shipping Address
        </label>
        <textarea
          id="checkout-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={3}
          placeholder="Enter your shipping address"
          aria-describedby={addressError ? "checkout-address-error" : undefined}
          className="w-full px-3 py-2 border border-[var(--border-warm)] rounded-xl text-sm text-[var(--foreground)] bg-[var(--surface)]/50 placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 focus:border-[var(--accent-warm)] resize-none transition-colors"
        />
        {addressError && (
          <p
            id="checkout-address-error"
            className="mt-1 text-xs text-red-500"
            role="alert"
          >
            {addressError}
          </p>
        )}
      </div>

      {lineItems.length > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          {lineItems.length} item{lineItems.length !== 1 ? "s" : ""} · Review
          policies before placing order
        </p>
      )}

      <GradientButton
        type="submit"
        size="lg"
        fullWidth
        disabled={!cartItems.length}
      >
        Review & Place Order
      </GradientButton>
    </form>
  );
};
