import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

export interface DatabasePoolConfig {
  readonly max: number
  readonly idleTimeoutMillis: number
  readonly connectionTimeoutMillis: number
  /**
   * Hard ceiling on how long a pooled socket may be reused before it is
   * retired.
   *
   * `idleTimeoutMillis` cannot carry this on its own, because it is enforced
   * by a timer that does not fire while a serverless container is frozen. A
   * socket parked across a freeze is therefore still "fresh" by idle-timeout
   * accounting long after the pooler or database closed its end, and the next
   * query dispatched on it fails with `Connection terminated unexpectedly`.
   * Retiring on age bounds how long such a socket can linger.
   */
  readonly maxLifetimeSeconds: number
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
