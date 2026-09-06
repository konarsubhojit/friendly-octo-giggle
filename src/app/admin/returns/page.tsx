import { connection } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { requireAdminPermission } from '@/features/admin/services/admin-page-auth'
import { AdminReturnsClient } from '@/features/admin/components/AdminReturnsClient'
import type { AdminReturn } from '@/features/admin/components/AdminReturnCard'
import { AdminPageShell } from '@/features/admin/components/AdminPageShell'
import { withItemsAndEvidence } from '@/features/orders/services/return-queue'
import { getRolePermissions } from '@/lib/constants/roles'
import { withStoreName } from '@/lib/constants/store'
import { primaryDrizzleDb } from '@/lib/db'
import { orders, returnRequests } from '@/lib/schema'

export const metadata = {
  title: withStoreName('Returns'),
}

/**
 * Returns triage queue.
 *
 * A Server Component so the permission gate runs before any markup is sent —
 * `requireAdminPermission` redirects rather than rendering a shell the caller
 * is not entitled to see. The first page of the default view is fetched here
 * too, so the queue arrives populated instead of flashing empty while the
 * client fetches.
 */
export default async function AdminReturnsPage() {
  // Admin screens are per-request; state that explicitly under Cache
  // Components rather than letting the prerenderer attempt this page.
  await connection()

  const { role } = await requireAdminPermission('orders:returns')

  const rows = await primaryDrizzleDb
    .select({
      id: returnRequests.id,
      orderId: returnRequests.orderId,
      status: returnRequests.status,
      reason: returnRequests.reason,
      customerNote: returnRequests.customerNote,
      decisionReason: returnRequests.decisionReason,
      refundAmount: returnRequests.refundAmount,
      refundId: returnRequests.refundId,
      createdAt: returnRequests.createdAt,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      paymentProvider: orders.paymentProvider,
    })
    .from(returnRequests)
    .innerJoin(orders, eq(returnRequests.orderId, orders.id))
    .where(eq(returnRequests.status, 'REQUESTED'))
    .orderBy(desc(returnRequests.createdAt))
    .limit(20)

  const initialReturns: AdminReturn[] = await withItemsAndEvidence(rows)

  return (
    <AdminPageShell
      breadcrumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Returns' }]}
      title="Returns"
      description="Damaged-item claims awaiting review. Approving authorises the customer to ship the item back; stock and money move only once it arrives."
    >
      <AdminReturnsClient
        initialReturns={initialReturns}
        permissions={getRolePermissions(role)}
      />
    </AdminPageShell>
  )
}
