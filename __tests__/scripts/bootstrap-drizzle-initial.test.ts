import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const sqlPath = path.resolve(
  process.cwd(),
  'scripts/sql/bootstrap-drizzle-initial.sql'
)
const sql = readFileSync(sqlPath, 'utf8')

const journal = JSON.parse(
  readFileSync(
    path.resolve(process.cwd(), 'drizzle/meta/_journal.json'),
    'utf8'
  )
) as { entries: Array<{ tag: string; when: number }> }

describe('bootstrap-drizzle-initial.sql', () => {
  it('includes lockout columns on User and idempotent backfill ALTERs', () => {
    expect(sql).toContain('"lockedUntil" timestamp')
    expect(sql).toContain('"sessionVersion" integer DEFAULT 0 NOT NULL')
    expect(sql).toContain(
      'ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "lockedUntil" timestamp'
    )
    expect(sql).toContain(
      'ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "sessionVersion" integer DEFAULT 0 NOT NULL;'
    )
  })

  it('creates every table idempotently', () => {
    const createStatements = sql.match(
      /CREATE TABLE (IF NOT EXISTS )?public\./g
    )
    expect(createStatements?.length).toBeGreaterThan(0)
    expect(sql).not.toMatch(/CREATE TABLE public\./)
  })

  it('covers tables added by the latest migrations', () => {
    for (const table of [
      'ProductVariant',
      'ProductOption',
      'ProductOptionValue',
      'ProductVariantOptionValue',
      'Address',
      'AdminAuditLog',
      'ReviewVote',
      'WebhookEvent',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public."${table}"`)
    }
  })

  it('dedupes webhook deliveries on (provider, eventId)', () => {
    expect(sql).toContain('WebhookEvent_provider_eventId_key')
  })

  it('stores money as exact decimals and converts legacy float columns', () => {
    expect(sql).toContain('numeric(12,2)')
    expect(sql).toContain("data_type = 'double precision'")
    expect(sql).toContain('numeric(12, 2) USING round(%I::numeric, 2)')
  })

  it('drops columns removed by later migrations', () => {
    expect(sql).toContain(
      'ALTER TABLE public."Product" DROP COLUMN IF EXISTS "localizedContent";'
    )
    expect(sql).toContain(
      'ALTER TABLE public."User" DROP COLUMN IF EXISTS "localePreference";'
    )
  })

  it('records every bundled migration so db:migrate becomes a no-op', () => {
    const migrationFiles = readdirSync(
      path.resolve(process.cwd(), 'drizzle')
    ).filter((file) => file.endsWith('.sql'))

    expect(journal.entries).toHaveLength(migrationFiles.length)

    for (const entry of journal.entries) {
      expect(sql).toContain(`-- ${entry.tag}`)
      expect(sql).toContain(`WHERE created_at = ${entry.when}`)
    }
  })

  it('runs inside a single transaction', () => {
    expect(sql.trimStart().startsWith('--') || sql.startsWith('BEGIN')).toBe(
      true
    )
    expect(sql).toContain('BEGIN;')
    expect(sql.trimEnd().endsWith('COMMIT;')).toBe(true)
  })
})
