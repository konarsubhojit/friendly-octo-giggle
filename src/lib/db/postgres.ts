import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import type {
  DatabaseConnection,
  DatabasePoolConfig,
  DrizzleDriverDatabase,
} from './types'

export const createPostgresConnection = <
  TSchema extends Record<string, unknown>,
>(
  connectionString: string,
  poolConfig: DatabasePoolConfig,
  schema: TSchema
): DatabaseConnection<TSchema> => {
  const pool = new Pool({
    connectionString,
    max: poolConfig.max,
    idleTimeoutMillis: poolConfig.idleTimeoutMillis,
    connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  })

  return {
    db: drizzle(pool, { schema }) as DrizzleDriverDatabase<TSchema>,
    pool,
  }
}
