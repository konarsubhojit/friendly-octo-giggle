import { AdminSalesDashboardClient } from "@/features/admin/components/AdminSalesDashboardClient";
import { getAdminSalesDashboardData } from "@/features/admin/services/admin-sales";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const sales = await getAdminSalesDashboardData();

  return <AdminSalesDashboardClient sales={sales} />;
}
