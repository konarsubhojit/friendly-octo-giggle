"use client";

import { useId } from "react";
import {
  CHECKOUT_POLICIES,
  CHECKOUT_POLICY_ACKNOWLEDGMENT,
  CHECKOUT_POLICY_ERROR_MESSAGE,
  SUPPORT_EMAIL,
  type CheckoutPolicySection,
} from "@/lib/constants/checkout-policies";
import type {
  CheckoutPricingSummary,
  CheckoutSummaryLineItem,
} from "@/lib/order-summary";
import { CartPricingSummary } from "@/components/cart/CartPricingSummary";

interface OrderPolicyConfirmDialogProps {
  readonly isOpen: boolean;
  readonly lineItems: readonly CheckoutSummaryLineItem[];
  readonly pricingSummary: CheckoutPricingSummary;
  readonly isAcknowledged: boolean;
  readonly onAcknowledgedChange: (checked: boolean) => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly isSubmitting?: boolean;
  readonly errorMessage?: string | null;
  readonly formatPrice: (amount: number) => string;
}

export function OrderPolicyConfirmDialog({
  isOpen,
  lineItems,
  pricingSummary,
  isAcknowledged,
  onAcknowledgedChange,
  onCancel,
  onConfirm,
  isSubmitting = false,
  errorMessage,
  formatPrice,
}: OrderPolicyConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const acknowledgmentId = useId();
  const policyUnavailable =
    Boolean(errorMessage) ||
    lineItems.length === 0 ||
    Object.values(CHECKOUT_POLICIES).some(
      (section) => section.items.length === 0,
    );
  const resolvedError =
    errorMessage ?? (policyUnavailable ? CHECKOUT_POLICY_ERROR_MESSAGE : null);

  if (!isOpen) {
    return null;
  }

  return (
    <dialog
      open
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent border-none p-4 m-0 w-full max-w-none"
    >
      <div
        className="absolute inset-0 bg-black/50"
        aria-hidden="true"
        onClick={isSubmitting ? undefined : onCancel}
      />

      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[var(--border-warm)] bg-[var(--surface)] shadow-2xl p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2
              id={titleId}
              className="text-2xl font-bold text-[var(--foreground)]"
            >
              Review Order Policy
            </h2>
            <p
              id={descriptionId}
              className="mt-2 text-sm text-[var(--text-secondary)]"
            >
              Review your order details and policy terms before confirming your
              purchase.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-full border border-[var(--border-warm)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {resolvedError ? (
          <div
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {resolvedError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/70 p-5">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              Selected Items
            </h3>
            <div className="space-y-4">
              {lineItems.map((item) => (
                <article
                  key={`${item.name}-${item.variationLabel ?? "default"}`}
                  className="rounded-2xl border border-[var(--border-warm)] bg-white/60 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h4 className="font-semibold text-[var(--foreground)]">
                        {item.name}
                      </h4>
                      {item.variationLabel ? (
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {item.variationLabel}
                        </p>
                      ) : null}
                      {item.customizationNote ? (
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          Customization: {item.customizationNote}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right text-sm">
                      <p className="font-semibold text-[var(--foreground)]">
                        {formatPrice(item.lineTotal)}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        {item.quantity} x {formatPrice(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-2xl bg-[var(--accent-blush)]/40 p-4">
              <CartPricingSummary
                itemCount={pricingSummary.itemCount}
                subtotal={formatPrice(pricingSummary.subtotal)}
                shipping={
                  pricingSummary.shippingAmount === 0
                    ? "Free"
                    : formatPrice(pricingSummary.shippingAmount)
                }
                total={formatPrice(pricingSummary.total)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border-warm)] bg-[var(--surface)]/70 p-5">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              Order Policy
            </h3>
            <div className="space-y-5">
              {Object.values(CHECKOUT_POLICIES).map(
                (section: CheckoutPolicySection) => (
                  <div key={section.title}>
                    <h4 className="font-semibold text-[var(--foreground)] mb-2">
                      {section.title}
                    </h4>
                    <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
                      {section.items.map((item: string) => (
                        <li key={item} className="flex gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-1 text-[var(--accent-rose)]"
                          >
                            •
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>

            <p className="mt-5 text-sm text-[var(--text-secondary)]">
              Support contact: {SUPPORT_EMAIL}
            </p>

            <label
              htmlFor={acknowledgmentId}
              className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--border-warm)] bg-white/60 px-4 py-3 text-sm text-[var(--foreground)]"
            >
              <input
                id={acknowledgmentId}
                type="checkbox"
                checked={isAcknowledged}
                disabled={isSubmitting || Boolean(resolvedError)}
                onChange={(event) => onAcknowledgedChange(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[var(--border-warm)] text-[var(--accent-rose)]"
              />
              <span>{CHECKOUT_POLICY_ACKNOWLEDGMENT}</span>
            </label>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="rounded-xl border border-[var(--border-warm)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--accent-blush)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={
                  !isAcknowledged || isSubmitting || Boolean(resolvedError)
                }
                className="rounded-xl bg-gradient-to-r from-[var(--accent-warm)] to-[var(--accent-rose)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Submitting..." : "Confirm and Place Order"}
              </button>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  );
}
