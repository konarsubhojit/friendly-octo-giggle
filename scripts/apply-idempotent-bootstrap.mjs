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

try {
  await client.connect()
  await client.query(sql)
  console.log('Initial schema bootstrap completed.')
  console.log(
    'Drizzle migration metadata is now aligned with the bundled migrations.'
  )
} catch (error) {
  console.error('Failed to apply bootstrap SQL.')
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
} finally {
  await client.end().catch(() => undefined)
}
