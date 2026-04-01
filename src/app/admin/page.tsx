import { AdminSalesDashboardClient } from "@/components/admin/AdminSalesDashboardClient";
import { getAdminSalesDashboardData } from "@/lib/admin-sales";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const sales = await getAdminSalesDashboardData();

  return <AdminSalesDashboardClient sales={sales} />;
}
