import type { ReturnAction, ReturnStatus } from '@/lib/constants/returns'

/**
 * The return lifecycle, as a pure transition table.
 *
 * ```text
 * REQUESTED ──approve──▶ APPROVED ──receive──▶ RECEIVED ──refund──▶ REFUNDED
 *     │                      │
 *     └──reject──▶ REJECTED ◀┘
 * ```
 *
 * `receive` and `refund` are deliberately separate actions. Collapsing them
 * leaves a gateway-rejected refund stranded at `RECEIVED` with no action
 * accepting that state, which is precisely the out-of-band support workflow
 * this feature exists to remove. Keeping them apart also aligns the permission
 * boundary with the money boundary: `receive` moves inventory and needs
 * `orders:returns`, `refund` moves money and needs `orders:refund`.
 *
 * This module performs no I/O so the whole table can be exercised exhaustively.
 */
export const RETURN_TRANSITIONS: Readonly<
  Record<ReturnStatus, Partial<Record<ReturnAction, ReturnStatus>>>
> = {
  REQUESTED: {
    approve: 'APPROVED',
    reject: 'REJECTED',
  },
  APPROVED: {
    // Goods arrived. Restocks; issues no refund.
    receive: 'RECEIVED',
    // Goods never arrived, or arrived unfit. Releases the held quantity.
    reject: 'REJECTED',
  },
  RECEIVED: {
    // Also the retry path: a gateway rejection leaves the return here with
    // `refundId` unset, so re-issuing is legal until it succeeds.
    refund: 'REFUNDED',
  },
  REJECTED: {},
  REFUNDED: {
    // Cash on Delivery only: flips the linked PENDING refund row to PROCESSED
    // once the money has been handed over out of band. The return's own status
    // does not move.
    settle: 'REFUNDED',
  },
}

/** Raised when an action is attempted from a status that does not allow it. */
export class ReturnTransitionError extends Error {
  readonly currentStatus: ReturnStatus
  readonly action: ReturnAction

  constructor(currentStatus: ReturnStatus, action: ReturnAction) {
    super(
      `Cannot ${action} a return in status ${currentStatus}. ` +
        `Allowed actions: ${listAllowedActions(currentStatus) || 'none'}.`
    )
    this.name = 'ReturnTransitionError'
    this.currentStatus = currentStatus
    this.action = action
  }
}

const listAllowedActions = (status: ReturnStatus): string =>
  Object.keys(RETURN_TRANSITIONS[status]).join(', ')

/** The status an action leads to, or `null` when the action is not allowed. */
export const nextReturnStatus = (
  currentStatus: ReturnStatus,
  action: ReturnAction
): ReturnStatus | null => RETURN_TRANSITIONS[currentStatus][action] ?? null

/** Whether an action is legal from a status. */
export const canTransition = (
  currentStatus: ReturnStatus,
  action: ReturnAction
): boolean => nextReturnStatus(currentStatus, action) !== null

/**
 * The status an action leads to, throwing when the action is not allowed.
 * Callers map `ReturnTransitionError` to HTTP 409.
 */
export const assertTransition = (
  currentStatus: ReturnStatus,
  action: ReturnAction
): ReturnStatus => {
  const next = nextReturnStatus(currentStatus, action)
  if (next === null) {
    throw new ReturnTransitionError(currentStatus, action)
  }
  return next
}

/**
 * Whether a status admits no further action at all.
 *
 * `REFUNDED` is **not** terminal: a Cash on Delivery return still accepts
 * `settle` to mark the manual payment complete.
 */
export const isTerminalReturnStatus = (status: ReturnStatus): boolean =>
  Object.keys(RETURN_TRANSITIONS[status]).length === 0
