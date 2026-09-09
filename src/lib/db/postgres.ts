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
    maxLifetimeSeconds: poolConfig.maxLifetimeSeconds,
    // TCP keep-alive so a peer that went away is detected by the socket layer
    // rather than by the next query, and so intermediate NAT and pooler state
    // is not reclaimed under a connection that is merely idle.
    keepAlive: true,
  })

  return {
    db: drizzle(pool, { schema }) as DrizzleDriverDatabase<TSchema>,
    pool,
  }
}
