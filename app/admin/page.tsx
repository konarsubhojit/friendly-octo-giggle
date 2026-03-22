import { AdminSalesDashboardClient } from "@/components/admin/AdminSalesDashboardClient";
import { getAdminSalesDashboardData } from "@/lib/admin-sales";

export default async function AdminDashboard() {
  const sales = await getAdminSalesDashboardData();

  return <AdminSalesDashboardClient sales={sales} />;
}
