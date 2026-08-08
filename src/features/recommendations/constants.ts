/**
 * Tuning constants for the recommendation scoring model and rails.
 *
 * These are deliberately ordinal rather than tuned: they encode "a purchase
 * beats a wishlist entry beats a share", which is defensible without any
 * experiment data. See `specs/017-personalized-recommendations/research.md`
 * R-002 for the rationale and R-005 for the bounding strategy.
 */

/**
 * How far back the scoring job looks. Bounds the job's runtime and memory so a
 * growing order table cannot exhaust the function timeout (R-005).
 */
export const AFFINITY_WINDOW_DAYS = 180

/**
 * Minimum number of distinct orders (or distinct users, for wishlist pairs)
 * that must back an association before it is written.
 *
 * This is a privacy threshold as much as a statistical one: a pair derived
 * from a single order would let a shopper who bought an unusual product infer
 * the rest of another shopper's basket. Enforced in the aggregation `HAVING`
 * clause so sub-threshold pairs never reach the table.
 */
export const MIN_SUPPORT = 3

/**
 * Rows retained per anchor. A rail renders at most {@link RAIL_SIZE}; the
 * surplus leaves headroom for candidate filtering (out of stock, soft-deleted,
 * already in cart) without a second query.
 */
export const MAX_PAIRS_PER_ANCHOR = 24

/** Products shown in a single rail. */
export const RAIL_SIZE = 8

/** Anchors processed per `step.run` batch, so each Inngest step stays small. */
export const ANCHOR_BATCH_SIZE = 250

/** Relative contribution of each signal to the combined association score. */
export const SIGNAL_WEIGHTS = {
  /** Strongest revealed preference — money changed hands. */
  purchase: 1.0,
  /** Explicit intent, but unconverted. */
  wishlist: 0.5,
  /** Weak intent; `ProductShare` has no `userId`, so grouping is day-coarse. */
  share: 0.25,
} as const

export type SignalSource = keyof typeof SIGNAL_WEIGHTS
