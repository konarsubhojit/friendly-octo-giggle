import { INSTAGRAM_HANDLE } from '@/lib/constants/store'

export const SUPPORT_EMAIL = 'support@estore.example.com'

export interface CheckoutPolicySection {
  readonly title: string
  readonly items: readonly string[]
}

export interface CheckoutPolicies {
  readonly cancellation: CheckoutPolicySection
  readonly returns: CheckoutPolicySection
  readonly refunds: CheckoutPolicySection
  readonly damagedItems: CheckoutPolicySection
}

export const CHECKOUT_POLICIES: CheckoutPolicies = {
  cancellation: {
    title: 'Cancellation',
    items: [
      'Orders can only be cancelled before they are shipped.',
      'Once an order has shipped, it cannot be cancelled and no refund will be issued.',
    ],
  },
  returns: {
    title: 'Returns',
    items: [
      'Orders cannot be returned unless the product is received in damaged, defective, or incorrect condition.',
      'Eligible returns are requested from the order page within 7 days of delivery — no email to support is required.',
      'Photos of the problem are attached to the request; a short video can be sent separately if we ask for one.',
    ],
  },
  refunds: {
    title: 'Refunds',
    items: [
      'Refunds are not issued for change of mind or for any reason other than an approved damaged-item claim.',
      'Approved damaged-item claims are normally resolved by replacement. Where a replacement is unavailable, the claim is settled by refund to the original payment method.',
      'Return shipping is refunded only when the entire order is returned.',
    ],
  },
  damagedItems: {
    title: 'Damaged Items',
    items: [
      'Open the order and start a return, attaching clear photos of the damage.',
      `If we ask for a short video, send it to @${INSTAGRAM_HANDLE} on Instagram quoting your return ID, or email ${SUPPORT_EMAIL}.`,
      'If the claim is approved, you will be asked to send the product back before a replacement or refund is issued.',
      'You are responsible for the shipping cost to send the damaged product back.',
      'We do not charge shipping for sending the replacement product.',
    ],
  },
} as const

export const CHECKOUT_POLICY_ACKNOWLEDGMENT =
  'I have reviewed the cancellation, return, refund, and damaged-item replacement policy for this order.'

export const CHECKOUT_POLICY_ERROR_MESSAGE =
  'Order policy details are currently unavailable. Please try again before placing your order.'
