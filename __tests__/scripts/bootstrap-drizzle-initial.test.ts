import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('bootstrap-drizzle-initial.sql', () => {
  it('includes lockout columns on User and idempotent backfill ALTERs', () => {
    const sqlPath = path.resolve(
      process.cwd(),
      'scripts/sql/bootstrap-drizzle-initial.sql'
    )
    const sql = readFileSync(sqlPath, 'utf8')

    expect(sql).toContain('"lockedUntil" timestamp')
    expect(sql).toContain('"sessionVersion" integer DEFAULT 0 NOT NULL')
    expect(sql).toContain(
      'ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "lockedUntil" timestamp;'
    )
    expect(sql).toContain(
      'ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "sessionVersion" integer DEFAULT 0 NOT NULL;'
    )
  })
})
