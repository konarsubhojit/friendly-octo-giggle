import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { AdminSalesDashboardClient } from '@/features/admin/components/AdminSalesDashboardClient'
import { getAdminSalesDashboardData } from '@/features/admin/services/admin-sales'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { EmptyState } from '@/components/ui/EmptyState'

export default async function AdminDashboard() {
  // The dashboard is per-request: it reports live sales figures and is scoped
  // to the caller's permissions. `connection()` states that explicitly so the
  // page is never prerendered, which also keeps `getAdminSalesDashboardData`'s
  // `new Date()` usage out of the prerender path.
  await connection()

  // Unlike every other admin screen, `/admin` has no section entry in the
  // proxy's permission table — it is the fallback destination staff are sent
  // to. The revenue data it renders still requires `analytics:read`, so the
  // page enforces that itself and degrades to an explanation rather than
  // redirecting back to itself.
  const authCheck = await checkAdminAuth('analytics:read')
  if (!authCheck.authorized) {
    if (authCheck.status === 401) {
      redirect('/auth/signin?callbackUrl=%2Fadmin')
    }

    return (
      <EmptyState
        title="Sales dashboard unavailable"
        message="Your role does not include analytics access. Use the navigation above to open the areas you can manage."
      />
    )
  }

  const sales = await getAdminSalesDashboardData()

  return <AdminSalesDashboardClient sales={sales} />
}
