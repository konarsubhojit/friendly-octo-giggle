import { redirect } from 'next/navigation'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { AdminSalesDashboardClient } from '@/features/admin/components/AdminSalesDashboardClient'
import { getAdminSalesDashboardData } from '@/features/admin/services/admin-sales'

export const dynamic = 'force-dynamic'

const AdminSalesPage = async () => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    if (authCheck.status === 401) {
      redirect('/auth/signin')
    }
    redirect('/admin')
  }

  const sales = await getAdminSalesDashboardData()
  return <AdminSalesDashboardClient sales={sales} />
}

export default AdminSalesPage
