/* eslint-disable no-console */

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { config } from 'dotenv'
import pg from 'pg'

config({ path: '.env.local' })
config({ path: '.env', override: false })

const { Client } = pg

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const isLocalConnection = /localhost|127\.0\.0\.1/.test(databaseUrl)
const sslDisabled = databaseUrl.includes('sslmode=disable')

const client = new Client({
  connectionString: databaseUrl,
  ssl:
    isLocalConnection || sslDisabled
      ? false
      : {
          rejectUnauthorized: false,
          checkServerIdentity: () => undefined,
        },
})

const sqlFilePath = path.resolve(
  process.cwd(),
  'scripts/sql/bootstrap-drizzle-initial.sql'
)

const sql = await fs.readFile(sqlFilePath, 'utf8')

/**
 * Split a SQL script into individual statements.
 *
 * The bootstrap script mixes plain DDL with dollar-quoted PL/pgSQL blocks, so a
 * naive split on `;` is not safe. Statements are executed one at a time (the
 * same way `psql -f` does) because sending the whole script as a single
 * multi-statement query makes PostgreSQL resolve every referenced type up
 * front, which fails for types the script creates itself.
 */
function splitStatements(script) {
  const statements = []
  let current = ''
  let index = 0

  while (index < script.length) {
    const char = script[index]
    const rest = script.slice(index)

    if (char === '-' && script[index + 1] === '-') {
      const newline = script.indexOf('\n', index)
      const end = newline === -1 ? script.length : newline
      current += script.slice(index, end)
      index = end
      continue
    }

    if (char === "'") {
      const end = script.indexOf("'", index + 1)
      const stop = end === -1 ? script.length : end + 1
      current += script.slice(index, stop)
      index = stop
      continue
    }

    const dollarTag = /^\$[A-Za-z_]*\$/.exec(rest)?.[0]
    if (dollarTag) {
      const end = script.indexOf(dollarTag, index + dollarTag.length)
      const stop = end === -1 ? script.length : end + dollarTag.length
      current += script.slice(index, stop)
      index = stop
      continue
    }

    if (char === ';') {
      statements.push(current.trim())
      current = ''
      index += 1
      continue
    }

    current += char
    index += 1
  }

  if (current.trim()) {
    statements.push(current.trim())
  }

  return statements.filter((statement) => statement.length > 0)
}

try {
  await client.connect()
  for (const statement of splitStatements(sql)) {
    await client.query(statement)
  }
  console.log('Initial schema bootstrap completed.')
  console.log(
    'Drizzle migration metadata is now aligned with the bundled migrations.'
  )
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  console.error('Failed to apply bootstrap SQL.')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await client.end().catch(() => undefined)
}
