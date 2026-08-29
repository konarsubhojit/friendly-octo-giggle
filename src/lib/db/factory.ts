import { getProvider } from '@/lib/providers/resolution'
import type { DatabaseDriver } from '@/lib/providers/types'
import type { Env } from '@/lib/validations/env'
import { createNeonConnection } from './neon'
import { createPostgresConnection } from './postgres'
import type { DatabaseConnection, DatabasePoolConfig } from './types'

const DEFAULT_POOL_CONFIG = {
  max: 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 5000,
} as const satisfies DatabasePoolConfig

type PoolEnvKey =
  | 'DATABASE_POOL_MAX'
  | 'DATABASE_POOL_IDLE_TIMEOUT_MS'
  | 'DATABASE_POOL_CONNECTION_TIMEOUT_MS'

type DatabaseEnv = Pick<Env, 'DATABASE_URL' | 'READ_DATABASE_URL'> &
  Partial<Record<PoolEnvKey, string | undefined>>

export interface DatabaseConnections<TSchema extends Record<string, unknown>> {
  readonly driver: DatabaseDriver
  readonly primary: DatabaseConnection<TSchema>
  readonly read: DatabaseConnection<TSchema>
  close(): Promise<void>
}

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number,
  key: PoolEnvKey
): number => {
  if (value === undefined || value.trim() === '') return fallback

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer`)
  }

  return parsed
}

export const createDatabasePoolConfig = (
  source: Partial<Record<PoolEnvKey, string | undefined>>
): DatabasePoolConfig => ({
  max: parsePositiveInteger(
    source.DATABASE_POOL_MAX,
    DEFAULT_POOL_CONFIG.max,
    'DATABASE_POOL_MAX'
  ),
  idleTimeoutMillis: parsePositiveInteger(
    source.DATABASE_POOL_IDLE_TIMEOUT_MS,
    DEFAULT_POOL_CONFIG.idleTimeoutMillis,
    'DATABASE_POOL_IDLE_TIMEOUT_MS'
  ),
  connectionTimeoutMillis: parsePositiveInteger(
    source.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    DEFAULT_POOL_CONFIG.connectionTimeoutMillis,
    'DATABASE_POOL_CONNECTION_TIMEOUT_MS'
  ),
})

export const createDatabaseConnection = <
  TSchema extends Record<string, unknown>,
>(
  driver: DatabaseDriver,
  connectionString: string,
  poolConfig: DatabasePoolConfig,
  schema: TSchema
): DatabaseConnection<TSchema> => {
  switch (driver) {
    case 'postgres':
      return createPostgresConnection(connectionString, poolConfig, schema)
    case 'neon':
      return createNeonConnection(connectionString, poolConfig, schema)
  }
}

export const createDatabaseConnections = <
  TSchema extends Record<string, unknown>,
>(
  env: DatabaseEnv,
  schema: TSchema,
  driver: DatabaseDriver = getProvider('database')
): DatabaseConnections<TSchema> => {
  const poolConfig = createDatabasePoolConfig(env)
  const readConnectionString = env.READ_DATABASE_URL ?? env.DATABASE_URL
  const primary = createDatabaseConnection(
    driver,
    env.DATABASE_URL,
    poolConfig,
    schema
  )

  let read: DatabaseConnection<TSchema>
  try {
    read = createDatabaseConnection(
      driver,
      readConnectionString,
      poolConfig,
      schema
    )
  } catch (error) {
    void primary.pool.end()
    throw error
  }

  return {
    driver,
    primary,
    read,
    async close() {
      await Promise.all([primary.pool.end(), read.pool.end()])
    },
  }
}
