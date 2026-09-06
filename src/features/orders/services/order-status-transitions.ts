/**
 * Which order status may follow which.
 *
 * `DELIVERED` maps only to itself deliberately. Returns and refunds hang off a
 * delivered order, so allowing a delivered order to move back to `SHIPPED` and
 * forward again would let a second delivery-settlement — and therefore a
 * second refund path — open against the same order. Keeping the state terminal
 * makes that structurally impossible rather than merely guarded.
 *
 * `CANCELLED` maps to itself for the same reason: nothing follows a
 * cancellation.
 */
export const VALID_ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['DELIVERED'],
  CANCELLED: ['CANCELLED'],
}

/** Statuses from which no forward progress is possible. */
export const isTerminalOrderStatus = (status: string): boolean => {
  const next = VALID_ORDER_TRANSITIONS[status] ?? []
  return next.length === 0 || next.every((candidate) => candidate === status)
}
