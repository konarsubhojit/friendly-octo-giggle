import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  apiSuccess,
  apiError,
  handleApiError,
  handleValidationError,
} from "@/lib/api-utils";
import {
  getFailedEmails,
  acknowledgePendingEmails,
  batchRetryFailedEmails,
} from "@/lib/email/failed-emails";
import type { FailedEmailStatus } from "@/lib/email/failed-emails";
import {
  FailedEmailQuerySchema,
  ManualRetryBodySchema,
} from "@/lib/validations";

export const dynamic = "force-dynamic";

const checkAdminAuth = async () => {
  const session = await auth();
  if (!session?.user) {
    return {
      authorized: false as const,
      error: "Not authenticated",
      status: 401 as const,
    };
  }
  if (session.user.role !== "ADMIN") {
    return {
      authorized: false as const,
      error: "Not authorized - Admin access required",
      status: 403 as const,
    };
  }
  return { authorized: true as const };
};

const parseStatusList = (statusParam: string): FailedEmailStatus[] => {
  const valid: FailedEmailStatus[] = ["pending", "failed", "sent"];
  return statusParam
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is FailedEmailStatus =>
      valid.includes(s as FailedEmailStatus),
    );
};

export const GET = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status);
  }

  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = {
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      sortOrder: searchParams.get("sortOrder") ?? undefined,
    };

    const parseResult = FailedEmailQuerySchema.safeParse(rawQuery);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { status, page, pageSize, sortOrder } = parseResult.data;
    const statusList = parseStatusList(status);

    if (statusList.length === 0) {
      return apiError("Invalid status filter values", 400);
    }

    const { records, total } = await getFailedEmails({
      statusList,
      page,
      pageSize,
      sortOrder,
    });

    const pendingIds = records
      .filter((r) => r.status === "pending")
      .map((r) => r.id);

    await acknowledgePendingEmails(pendingIds);

    const totalPages = Math.ceil(total / pageSize);

    return apiSuccess({
      records,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (error) {
    return handleApiError(error);
  }
};

export const POST = async (request: NextRequest) => {
  const authCheck = await checkAdminAuth();
  if (!authCheck.authorized) {
    return apiError(authCheck.error, authCheck.status);
  }

  try {
    const rawBody = await request.json();
    const parseResult = ManualRetryBodySchema.safeParse(rawBody);
    if (!parseResult.success) {
      return handleValidationError(parseResult.error);
    }

    const { ids } = parseResult.data;
    const results = await batchRetryFailedEmails(ids);

    return apiSuccess({ results });
  } catch (error) {
    return handleApiError(error);
  }
};
