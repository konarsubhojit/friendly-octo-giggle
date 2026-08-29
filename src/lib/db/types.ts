import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export interface DatabasePoolConfig {
  readonly max: number
  readonly idleTimeoutMillis: number
  readonly connectionTimeoutMillis: number
}

export interface EndableDatabasePool {
  end(): Promise<void>
}

export type DrizzleDriverDatabase<TSchema extends Record<string, unknown>> =
  | NodePgDatabase<TSchema>
  | NeonDatabase<TSchema>

export interface DatabaseConnection<TSchema extends Record<string, unknown>> {
  readonly db: DrizzleDriverDatabase<TSchema>
  readonly pool: EndableDatabasePool
}
