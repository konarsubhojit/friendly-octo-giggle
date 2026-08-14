import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ADMIN_API_ROOT = path.resolve(process.cwd(), 'src/app/api/admin')
const MUTATING_HTTP_VERB_EXPORT =
  /\bexport\s+(?:async\s+function|function|const)\s+(POST|PUT|PATCH|DELETE)\b/g

const AUDIT_COVERAGE_ALLOWLIST: Record<string, string> = {
  // The route delegates to refundOrder(), which already records the audit row
  // using the acting admin context after the refund is settled.
  'orders/[id]/refund/route.ts': 'Audited inside refund-service.ts',
  // The route delegates to decideReturn(), which records the final transition
  // after the return state machine applies the mutation.
  'returns/[id]/route.ts': 'Audited inside return-admin-service.ts',
}

const collectRouteFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true })

  return entries.flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return collectRouteFiles(fullPath)
    }

    return entry.isFile() && entry.name === 'route.ts' ? [fullPath] : []
  })
}

describe('admin API audit coverage', () => {
  it('requires every mutating admin route file to call recordAdminAuditLog', () => {
    const missingCoverage = collectRouteFiles(ADMIN_API_ROOT)
      .map((filePath) => {
        const source = fs.readFileSync(filePath, 'utf8')
        const mutatingVerbs = [
          ...source.matchAll(MUTATING_HTTP_VERB_EXPORT),
        ].map(([, verb]) => verb)

        if (mutatingVerbs.length === 0) {
          return null
        }

        const relativePath = path
          .relative(ADMIN_API_ROOT, filePath)
          .split(path.sep)
          .join('/')

        if (AUDIT_COVERAGE_ALLOWLIST[relativePath]) {
          return null
        }

        return source.includes('recordAdminAuditLog')
          ? null
          : `${relativePath} exports ${mutatingVerbs.join(', ')}`
      })
      .filter((value): value is string => value !== null)

    expect(missingCoverage).toEqual([])
  })
})
