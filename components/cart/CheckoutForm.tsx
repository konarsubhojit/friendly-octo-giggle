"use client";

import { useMemo, useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useSelector, useDispatch } from "react-redux";
import toast from "react-hot-toast";
import { clearCart, selectCart } from "@/lib/features/cart/cartSlice";
import { apiClient } from "@/lib/api-client";
import type { AppDispatch } from "@/lib/store";
import type {
  CheckoutEnqueueResponse,
  CheckoutRequestStatusResponse,
} from "@/lib/types";
import { GradientButton } from "@/components/ui/GradientButton";
import {
  buildCheckoutPricingSummaryFromLineItems,
  buildCheckoutSummaryLineItems,
} from "@/lib/order-summary";
import { useCurrency } from "@/contexts/CurrencyContext";
import { OrderPolicyConfirmDialog } from "@/components/cart/OrderPolicyConfirmDialog";

const CHECKOUT_POLL_INTERVAL_MS = 1500;
const CHECKOUT_POLL_MAX_ATTEMPTS = 40;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });

interface CheckoutFormProps {
  readonly customizationNotes: Record<string, string>;
}

export const CheckoutForm = ({ customizationNotes }: CheckoutFormProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const dispatch = useDispatch<AppDispatch>();
  const cart = useSelector(selectCart);
  const { formatPrice } = useCurrency();
  const [isPending, startTransition] = useTransition();
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [isPolicyAcknowledged, setIsPolicyAcknowledged] = useState(false);

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
  const pricingSummary = useMemo(
    () => buildCheckoutPricingSummaryFromLineItems(lineItems),
    [lineItems],
  );

  const pollCheckoutRequest = async (
    checkoutRequestId: string,
  ): Promise<CheckoutRequestStatusResponse> => {
    for (let attempt = 0; attempt < CHECKOUT_POLL_MAX_ATTEMPTS; attempt++) {
      const status = await apiClient.get<CheckoutRequestStatusResponse>(
        `/api/checkout/${checkoutRequestId}`,
      );

      if (status.status === "COMPLETED") {
        return status;
      }

      if (status.status === "FAILED") {
        throw new Error(status.error ?? "Checkout failed");
      }

      setCheckoutMessage(
        status.status === "PROCESSING"
          ? "Finalizing your order..."
          : "Queueing your order...",
      );

      await delay(CHECKOUT_POLL_INTERVAL_MS);
    }

    throw new Error(
      "Checkout is taking longer than expected. Please check your orders shortly.",
    );
  };

  const validateCheckout = () => {
    if (!session?.user?.id || !session.user.email) {
      router.push("/auth/signin?callbackUrl=/cart");
      return false;
    }

    const trimmedAddress = address.trim();
    if (trimmedAddress.length < 10) {
      setAddressError("Please enter a valid shipping address.");
      return false;
    }
    setAddressError(null);

    if (!cartItems.length) {
      toast.error("Your cart is empty.");
      return false;
    }

    return true;
  };

  const submitCheckout = () => {
    const trimmedAddress = address.trim();
    const sessionUser = session?.user;

    if (!sessionUser?.email) {
      router.push("/auth/signin?callbackUrl=/cart");
      return;
    }

    startTransition(async () => {
      try {
        setCheckoutMessage("Submitting your order...");

        const enqueueResult = await apiClient.post<CheckoutEnqueueResponse>(
          "/api/checkout",
          {
            customerName: sessionUser.name ?? "Customer",
            customerEmail: sessionUser.email,
            customerAddress: trimmedAddress,
            items: cartItems.map((item) => ({
              productId: item.productId,
              variationId: item.variationId ?? undefined,
              quantity: item.quantity,
              customizationNote: customizationNotes[item.id] ?? undefined,
            })),
          },
        );

        const status = await pollCheckoutRequest(
          enqueueResult.checkoutRequestId,
        );

        if (!status.orderId) {
          throw new Error("Checkout completed without an order reference.");
        }

        await dispatch(clearCart()).unwrap();
        setIsPolicyDialogOpen(false);
        setIsPolicyAcknowledged(false);
        toast.success(`Order ${status.orderId} placed successfully!`);
        router.push("/orders");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to place order",
        );
      } finally {
        setCheckoutMessage(null);
      }
    });
  };

  const handleSubmit: NonNullable<React.ComponentProps<"form">["onSubmit"]> = (
    e,
  ) => {
    e.preventDefault();

    if (!validateCheckout()) {
      return;
    }

    setIsPolicyAcknowledged(false);
    setIsPolicyDialogOpen(true);
  };

  const handlePolicyDialogCancel = () => {
    if (isPending) {
      return;
    }

    setIsPolicyDialogOpen(false);
    setIsPolicyAcknowledged(false);
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
          aria-describedby={addressError ? "checkout-address-error" : undefined}
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

      <GradientButton
        type="submit"
        size="lg"
        fullWidth
        loading={isPending}
        loadingText={checkoutMessage ?? "Processing..."}
        disabled={isPending || !cartItems.length}
      >
        Place Order
      </GradientButton>

      {checkoutMessage ? (
        <output className="text-xs text-[var(--text-muted)]" aria-live="polite">
          {checkoutMessage}
        </output>
      ) : null}

      <OrderPolicyConfirmDialog
        isOpen={isPolicyDialogOpen}
        lineItems={lineItems}
        pricingSummary={pricingSummary}
        isAcknowledged={isPolicyAcknowledged}
        onAcknowledgedChange={setIsPolicyAcknowledged}
        onCancel={handlePolicyDialogCancel}
        onConfirm={submitCheckout}
        isSubmitting={isPending}
        formatPrice={formatPrice}
      />
    </form>
  );
};
