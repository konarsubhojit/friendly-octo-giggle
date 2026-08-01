import { isSearchAvailable } from '@/lib/search'
import { areOrdersSearchControlsAvailable } from '@/features/orders/services/orders-search-index'
import {
  AdminPageShell,
  AdminPanel,
} from '@/features/admin/components/AdminPageShell'
import SearchReindexClient from '@/features/admin/components/SearchReindexClient'
import { requireAdminPermission } from '@/features/admin/services/admin-page-auth'

export default async function AdminSearchPage() {
  await requireAdminPermission('system:manage', '/admin/search')

  const productsConfigured = isSearchAvailable()
  const ordersConfigured = areOrdersSearchControlsAvailable()

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: 'Admin', href: '/admin' },
        { label: 'Search Index' },
      ]}
      eyebrow="Search configuration"
      title="Search Index Management"
      description="Manage and rebuild product and order search indexes."
      metrics={[
        {
          label: 'Products index',
          value: productsConfigured ? 'Configured' : 'Missing config',
          hint: productsConfigured
            ? 'Product search index is available.'
            : 'Configuration required.',
          tone: productsConfigured ? 'emerald' : 'amber',
        },
        {
          label: 'Orders index',
          value: ordersConfigured ? 'Configured' : 'Missing config',
          hint: ordersConfigured
            ? 'Order search index is available.'
            : 'Configuration required.',
          tone: ordersConfigured ? 'emerald' : 'amber',
        },
      ]}
    >
      <AdminPanel
        title="Reindex"
        description="Rebuild search indexes after bulk imports or data changes."
      >
        <SearchReindexClient
          productsConfigured={productsConfigured}
          ordersConfigured={ordersConfigured}
        />
      </AdminPanel>
    </AdminPageShell>
  )
}
