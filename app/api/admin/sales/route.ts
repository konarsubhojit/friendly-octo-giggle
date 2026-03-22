import { apiSuccess, apiError, handleApiError } from "@/lib/api-utils";
import { checkAdminAuth } from "@/lib/admin-auth";
import { getAdminSalesDashboardData } from "@/lib/admin-sales";

export const dynamic = "force-dynamic";

export async function GET() {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status);
  }

  try {
    const sales = await getAdminSalesDashboardData();

    return apiSuccess({ sales });
  } catch (error) {
    return handleApiError(error);
  }
}
