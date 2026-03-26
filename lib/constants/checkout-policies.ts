export const SUPPORT_EMAIL = "support@estore.example.com";

export interface CheckoutPolicySection {
  readonly title: string;
  readonly items: readonly string[];
}

export interface CheckoutPolicies {
  readonly cancellation: CheckoutPolicySection;
  readonly returns: CheckoutPolicySection;
  readonly refunds: CheckoutPolicySection;
  readonly damagedItems: CheckoutPolicySection;
}

export const CHECKOUT_POLICIES: CheckoutPolicies = {
  cancellation: {
    title: "Cancellation",
    items: [
      "Orders can only be cancelled before they are shipped.",
      "Once an order has shipped, it cannot be cancelled and no refund will be issued.",
    ],
  },
  returns: {
    title: "Returns",
    items: [
      "Orders cannot be returned unless the product is received in damaged condition.",
      "Shoppers must contact support with detailed photos and a description of the issue before any damaged-item return is reviewed.",
    ],
  },
  refunds: {
    title: "Refunds",
    items: [
      "Refunds are not issued for orders.",
      "Damaged products are handled through review and replacement rather than refund.",
    ],
  },
  damagedItems: {
    title: "Damaged Items",
    items: [
      `Email ${SUPPORT_EMAIL} with detailed photos and a description of the damage.`,
      "If the damage claim is approved, you will be asked to send the product back before a replacement is sent.",
      "You are responsible for the shipping cost to send the damaged product back.",
      "We do not charge shipping for sending the replacement product.",
    ],
  },
} as const;

export const CHECKOUT_POLICY_ACKNOWLEDGMENT =
  "I have reviewed the cancellation, return, refund, and damaged-item replacement policy for this order.";

export const CHECKOUT_POLICY_ERROR_MESSAGE =
  "Order policy details are currently unavailable. Please try again before placing your order.";
