import { adminSavedViews } from '@/lib/schema'
import { primaryDrizzleDb } from '@/lib/db'
import type { AdminPermission } from '@/lib/constants/roles'
import type {
  SavedViewCriteria,
  AdminResourceKey,
} from '@/lib/validations/admin'

export interface BuiltInAdminSavedView {
  readonly id: string
  readonly resource: AdminResourceKey
  readonly name: string
  readonly criteria: SavedViewCriteria
  readonly requiredPermission: AdminPermission
}

const builtInView = (
  id: string,
  resource: AdminResourceKey,
  name: string,
  criteria: SavedViewCriteria,
  requiredPermission: AdminPermission
): BuiltInAdminSavedView => ({
  id,
  resource,
  name,
  criteria,
  requiredPermission,
})

export const BUILT_IN_ADMIN_SAVED_VIEWS: readonly BuiltInAdminSavedView[] = [
  builtInView(
    'svord01',
    'orders',
    'Awaiting fulfilment',
    {
      filters: { status: 'PROCESSING' },
      sort: { field: 'createdAt', direction: 'asc' },
    },
    'orders:read'
  ),
  builtInView(
    'svord02',
    'orders',
    'Refunds in progress',
    {
      filters: { paymentStatus: 'PARTIALLY_REFUNDED' },
      sort: { field: 'updatedAt', direction: 'desc' },
    },
    'orders:read'
  ),
  builtInView(
    'svprd01',
    'products',
    'Low stock',
    { filters: { stock: 'low' }, sort: { field: 'stock', direction: 'asc' } },
    'products:read'
  ),
  builtInView(
    'svrev01',
    'reviews',
    'Awaiting moderation',
    {
      filters: { status: 'pending' },
      sort: { field: 'createdAt', direction: 'desc' },
    },
    'reviews:moderate'
  ),
  builtInView(
    'sveml01',
    'email-failures',
    'Needs retry',
    {
      filters: { status: 'pending,failed' },
      sort: { field: 'createdAt', direction: 'desc' },
    },
    'system:manage'
  ),
] as const

export const seedBuiltInAdminSavedViews = async () => {
  const now = new Date()

  await primaryDrizzleDb
    .insert(adminSavedViews)
    .values(
      BUILT_IN_ADMIN_SAVED_VIEWS.map((view) => ({
        id: view.id,
        ownerId: null,
        resource: view.resource,
        name: view.name,
        criteria: view.criteria,
        isBuiltIn: true,
        requiredPermission: view.requiredPermission,
        createdAt: now,
        updatedAt: now,
      }))
    )
    .onConflictDoNothing({
      target: adminSavedViews.id,
    })
}
