import type { AdminPermission } from '@/lib/constants/roles'

/**
 * Each dashboard queue: a resource, a filter to scope the count, and the
 * permission required to see and follow the queue (FR-G02/G04).
 */
export interface ActionableQueueDefinition {
  readonly key: string
  readonly label: string
  readonly resource: string
  readonly filter: Record<string, unknown>
  readonly permission: AdminPermission
  readonly href: string
}

export const ACTIONABLE_QUEUES: readonly ActionableQueueDefinition[] = [
  {
    key: 'orders-awaiting-fulfilment',
    label: 'Orders awaiting fulfilment',
    resource: 'orders',
    filter: { status: 'PENDING' },
    permission: 'orders:read',
    href: '/admin/orders?status=PENDING',
  },
  {
    key: 'stock-below-threshold',
    label: 'Products below reorder threshold',
    resource: 'products',
    filter: { lowStock: true },
    permission: 'products:read',
    href: '/admin/products?lowStock=true',
  },
  {
    key: 'failed-emails',
    label: 'Failed customer emails',
    resource: 'email-failures',
    filter: {},
    permission: 'system:manage',
    href: '/admin/email-failures',
  },
  {
    key: 'reviews-awaiting-moderation',
    label: 'Reviews awaiting moderation',
    resource: 'reviews',
    filter: { status: 'pending' },
    permission: 'reviews:moderate',
    href: '/admin/reviews',
  },
  {
    key: 'refunds-in-progress',
    label: 'Refunds in progress',
    resource: 'orders',
    filter: { status: 'REFUND_PENDING' },
    permission: 'orders:refund',
    href: '/admin/orders?status=REFUND_PENDING',
  },
]

export interface ActionableQueueResult {
  readonly definition: ActionableQueueDefinition
  readonly count: number
  readonly error?: string
}

/**
 * Fetches counts for all queues the viewer is permitted to see.
 * Each queue fails independently (FR-G06).
 */
export async function fetchActionableQueueCounts(
  permissions: readonly AdminPermission[],
  fetcher: (
    resource: string,
    filter: Record<string, unknown>
  ) => Promise<number>
): Promise<ActionableQueueResult[]> {
  const visibleQueues = ACTIONABLE_QUEUES.filter((q) =>
    permissions.includes(q.permission)
  )

  const results = await Promise.allSettled(
    visibleQueues.map(async (q) => {
      const count = await fetcher(q.resource, q.filter)
      return { definition: q, count } satisfies ActionableQueueResult
    })
  )

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : {
          definition: visibleQueues[i],
          count: 0,
          error: r.reason instanceof Error ? r.reason.message : 'Failed',
        }
  )
}
