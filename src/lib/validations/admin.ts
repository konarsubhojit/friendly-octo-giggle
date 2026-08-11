import { z } from 'zod'
import { ADMIN_PERMISSIONS } from '@/lib/constants/roles'

export const ADMIN_RESOURCE_KEYS = [
  'orders',
  'products',
  'users',
  'reviews',
  'returns',
  'categories',
  'coupons',
  'checkout-requests',
  'recommendations',
  'email-failures',
  'search',
  'activity',
] as const

export const AdminResourceSchema = z.enum(ADMIN_RESOURCE_KEYS)

export const SavedViewSortSchema = z.object({
  field: z.string().trim().min(1),
  direction: z.enum(['asc', 'desc']),
})

export const SavedViewCriteriaSchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sort: SavedViewSortSchema.optional(),
})

const optionalIsoDate = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime())

export const AdminActivityQuerySchema = z
  .object({
    entity: z.string().trim().min(1).optional(),
    entityId: z.string().trim().min(1).optional(),
    action: z.string().trim().min(1).optional(),
    actorId: z.string().trim().min(1).optional(),
    dateFrom: optionalIsoDate.optional(),
    dateTo: optionalIsoDate.optional(),
    cursor: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .superRefine((value, ctx) => {
    if (value.entityId && !value.entity) {
      ctx.addIssue({
        code: 'custom',
        path: ['entityId'],
        message: 'entityId requires entity',
      })
    }

    if (value.entity && !value.entityId) {
      ctx.addIssue({
        code: 'custom',
        path: ['entityId'],
        message: 'entityId is required when entity is provided',
      })
    }

    if (value.dateFrom && value.dateTo) {
      const from = new Date(value.dateFrom)
      const to = new Date(value.dateTo)
      if (from > to) {
        ctx.addIssue({
          code: 'custom',
          path: ['dateTo'],
          message: 'dateTo must be after dateFrom',
        })
      }
    }
  })

export const SavedViewsListQuerySchema = z.object({
  resource: AdminResourceSchema,
})

export const CreateSavedViewRequestSchema = z.object({
  resource: AdminResourceSchema,
  name: z.string().trim().min(1).max(80),
  criteria: SavedViewCriteriaSchema,
})

export const RenameSavedViewRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
})

export const AdminPermissionSchema = z.enum(ADMIN_PERMISSIONS)

export type AdminActivityQuery = z.infer<typeof AdminActivityQuerySchema>
export type SavedViewCriteria = z.infer<typeof SavedViewCriteriaSchema>
export type SavedViewSort = z.infer<typeof SavedViewSortSchema>
export type AdminResourceKey = z.infer<typeof AdminResourceSchema>
export type CreateSavedViewRequest = z.infer<typeof CreateSavedViewRequestSchema>
export type RenameSavedViewRequest = z.infer<typeof RenameSavedViewRequestSchema>
