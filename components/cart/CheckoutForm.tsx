"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSelector, useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { createOrder } from "@/actions/orders";
import { clearCart, selectCart } from "@/lib/features/cart/cartSlice";
import type { AppDispatch } from "@/lib/store";
import { useCurrency } from "@/contexts/CurrencyContext";
import { GradientButton } from "@/components/ui/GradientButton";

interface CheckoutFormProps {
  readonly customizationNotes: Record<string, string>;
  readonly cartTotal: number;
}

export const CheckoutForm = ({
  customizationNotes,
  cartTotal,
}: CheckoutFormProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const dispatch = useDispatch<AppDispatch>();
  const cart = useSelector(selectCart);
  const { formatPrice } = useCurrency();
  const [isPending, startTransition] = useTransition();
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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

    if (!cart?.items.length) {
      toast.error("Your cart is empty.");
      return;
    }

    startTransition(async () => {
      const result = await createOrder(session.user.id, {
        customerName: session.user.name ?? "Customer",
        customerEmail: session.user.email!,
        customerAddress: trimmedAddress,
        items: cart.items.map((item) => ({
          productId: item.productId,
          variationId: item.variationId ?? undefined,
          quantity: item.quantity,
          price: item.variation
            ? item.product.price + item.variation.priceModifier
            : item.product.price,
          customizationNote: customizationNotes[item.id] ?? undefined,
        })),
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      await dispatch(clearCart()).unwrap();
      toast.success(`Order ${result.data.orderId} placed successfully!`);
      router.push("/orders");
    });
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
          disabled={isPending}
          aria-describedby={
            addressError ? "checkout-address-error" : undefined
          }
          className="w-full px-3 py-2 border border-[var(--border-warm)] rounded-xl text-sm text-[var(--foreground)] bg-[var(--surface)]/50 placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-warm)]/40 focus:border-[var(--accent-warm)] disabled:opacity-50 disabled:cursor-not-allowed resize-none transition-colors"
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

      <div className="flex justify-between items-center border-t border-[var(--border-warm)] pt-3 text-sm">
        <span className="text-[var(--text-secondary)]">Total</span>
        <span className="text-xl font-bold text-warm-heading">
          {formatPrice(cartTotal)}
        </span>
      </div>

      <GradientButton
        type="submit"
        size="lg"
        fullWidth
        loading={isPending}
        loadingText="Processing..."
        disabled={isPending || !cart?.items.length}
      >
        Place Order
      </GradientButton>
    </form>
  );
};
