import { z } from "zod";

// ─── Admin Email-Failures Validation Schemas ──────────────

export const FailedEmailQuerySchema = z.object({
  status: z.string().optional().default("pending,failed"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const ManualRetryBodySchema = z.object({
  ids: z
    .array(z.string().regex(/^[0-9A-Za-z]{7}$/, "Invalid short ID format"))
    .min(1, "At least one ID required")
    .max(50, "Maximum 50 IDs per request"),
});

export type FailedEmailQuery = z.infer<typeof FailedEmailQuerySchema>;
export type ManualRetryBody = z.infer<typeof ManualRetryBodySchema>;
