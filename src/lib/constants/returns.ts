/**
 * Return lifecycle vocabulary.
 *
 * Dependency-free by design, like `roles.ts`, so the Drizzle schema, Zod
 * validators, service layer and client bundles can all import it without
 * pulling in env, database or auth.
 */

/**
 * States a return request can occupy.
 *
 * `RECEIVED` and `REFUNDED` are deliberately distinct: goods arriving and
 * money moving are separate events with separate permissions, and separating
 * them is what gives a gateway-rejected refund somewhere to retry from.
 */
export const RETURN_STATUSES = [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'REFUNDED',
] as const

export type ReturnStatus = (typeof RETURN_STATUSES)[number]

/**
 * Reasons a customer may cite.
 *
 * Restricted to damage categories: the published policy permits returns only
 * for items received in damaged condition, so change-of-mind and fit reasons
 * are absent by design. This tuple is the enforcement point for that policy
 * constraint — widening it without amending the published terms would ship a
 * capability the customer never agreed to.
 */
export const RETURN_REASONS = ['DAMAGED', 'DEFECTIVE', 'WRONG_ITEM'] as const

export type ReturnReason = (typeof RETURN_REASONS)[number]

/** Customer-facing labels for each reason. */
export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: 'Arrived damaged',
  DEFECTIVE: 'Faulty on arrival',
  WRONG_ITEM: 'Wrong item received',
}

/** Actions that drive the lifecycle. */
export const RETURN_ACTIONS = [
  'approve',
  'reject',
  'receive',
  'refund',
  'settle',
] as const

export type ReturnAction = (typeof RETURN_ACTIONS)[number]

/** Why a delivered order may still not be returnable. */
export const RETURN_INELIGIBILITY_REASONS = [
  'NOT_DELIVERED',
  'WINDOW_EXPIRED',
  'FULLY_RETURNED',
  'CATEGORY_EXCLUDED',
] as const

export type ReturnIneligibilityReason =
  (typeof RETURN_INELIGIBILITY_REASONS)[number]

/** Minimum and maximum evidence images per return request. */
export const RETURN_EVIDENCE_MIN = 1
export const RETURN_EVIDENCE_MAX = 5

/**
 * Prefix marking a refund that must be settled by hand rather than through a
 * payment gateway — Cash on Delivery has no captured transaction to reverse.
 */
export const MANUAL_SETTLEMENT_REASON_PREFIX = 'MANUAL_SETTLEMENT:'

export const isReturnStatus = (value: unknown): value is ReturnStatus =>
  typeof value === 'string' &&
  (RETURN_STATUSES as readonly string[]).includes(value)

export const isReturnReason = (value: unknown): value is ReturnReason =>
  typeof value === 'string' &&
  (RETURN_REASONS as readonly string[]).includes(value)
