import { z } from 'zod'
import { revalidateTag } from 'next/cache'
import { ProductInputSchema } from '@/features/product/validations'
import { parseCsv } from '@/features/admin/services/admin-csv'
import { checkAdminAuth } from '@/features/admin/services/admin-auth'
import { recordAdminAuditLog } from '@/features/admin/services/admin-audit-log'
import { invalidateProductCaches } from '@/lib/cache'
import { apiError, apiSuccess, handleApiError, parseJsonBody } from '@/lib/api-utils'
import { primaryDrizzleDb } from '@/lib/db'
import { products } from '@/lib/schema'

export const dynamic = 'force-dynamic'

const ImportRequestSchema = z.object({
  csv: z.string().min(1),
  dryRun: z.boolean().optional().default(true),
})

interface RowIssue {
  readonly row: number
  readonly issues: Record<string, string>
}

const REQUIRED_HEADERS = ['name', 'description', 'image', 'category'] as const

export const POST = async (request: Request) => {
  const authCheck = await checkAdminAuth()
  if (!authCheck.authorized) {
    return apiError(authCheck.error ?? 'Unauthorized', authCheck.status)
  }

  try {
    const payload = await parseJsonBody(request, ImportRequestSchema)
    const parsed = parseCsv(payload.csv)

    const headerIndex = new Map(parsed.headers.map((header, idx) => [header, idx]))
    const missingHeaders = REQUIRED_HEADERS.filter(
      (header) => !headerIndex.has(header)
    )

    if (missingHeaders.length > 0) {
      return apiError('CSV missing required headers', 400, { missingHeaders })
    }

    const rowIssues: RowIssue[] = []
    const validRows: z.infer<typeof ProductInputSchema>[] = []

    parsed.rows.forEach((row, rowIndex) => {
      const name = row[headerIndex.get('name') ?? -1] ?? ''
      const description = row[headerIndex.get('description') ?? -1] ?? ''
      const image = row[headerIndex.get('image') ?? -1] ?? ''
      const category = row[headerIndex.get('category') ?? -1] ?? ''
      const imagesRaw = row[headerIndex.get('images') ?? -1] ?? ''

      const candidate = {
        name,
        description,
        image,
        category,
        images: imagesRaw
          ? imagesRaw
              .split('|')
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      }

      const validation = ProductInputSchema.safeParse(candidate)
      if (!validation.success) {
        const issues = validation.error.issues.reduce(
          (acc, issue) => {
            acc[issue.path.join('.') || 'row'] = issue.message
            return acc
          },
          {} as Record<string, string>
        )
        rowIssues.push({ row: rowIndex + 2, issues })
        return
      }

      validRows.push(validation.data)
    })

    const report = {
      dryRun: payload.dryRun,
      totalRows: parsed.rows.length,
      validRows: validRows.length,
      invalidRows: rowIssues.length,
      errors: rowIssues,
    }

    if (payload.dryRun || rowIssues.length > 0) {
      return apiSuccess(report)
    }

    await primaryDrizzleDb.transaction(async (tx) => {
      await tx.insert(products).values(
        validRows.map((item) => ({
          ...item,
          updatedAt: new Date(),
        }))
      )
    })

    await recordAdminAuditLog({
      userId: authCheck.userId,
      entity: 'product',
      entityId: `import:${new Date().toISOString()}`,
      action: 'csv_import_commit',
      diff: {
        totalRows: report.totalRows,
        importedRows: report.validRows,
      },
    })

    await invalidateProductCaches()
    revalidateTag('products', {})

    return apiSuccess({ ...report, dryRun: false, committedRows: validRows.length })
  } catch (error) {
    return handleApiError(error)
  }
}
