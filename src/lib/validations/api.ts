import { z } from "zod";

// Generic API response schemas used by api-utils and any consumer that needs
// to validate an API response shape.
export const ApiSuccessSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.literal(true),
  });

export const ApiErrorSchema = z.object({
  error: z.string(),
  success: z.literal(false),
  details: z.record(z.string(), z.string()).optional(),
});

// Utility type for async function results (success/failure discriminated union).
export type AsyncResult<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Generic paginated response type shared across list endpoints.
export type PaginatedResponse<T> = {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly hasMore: boolean;
};
