import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetProviderResolutionForTests } from '@/lib/providers/resolution'
import {
  createDatabaseConnections,
  createDatabasePoolConfig,
} from '@/lib/db/factory'

const {
  nodeDrizzleMock,
  neonDrizzleMock,
  pgPoolEndMock,
  pgPoolMock,
  neonPoolMock,
} = vi.hoisted(() => {
  const pgPoolEndMock = vi.fn().mockResolvedValue(undefined)
  const neonPoolEndMock = vi.fn().mockResolvedValue(undefined)

  return {
    nodeDrizzleMock: vi.fn((pool: unknown) => ({ driver: 'postgres', pool })),
    neonDrizzleMock: vi.fn((pool: unknown) => ({ driver: 'neon', pool })),
    pgPoolEndMock,
    pgPoolMock: vi.fn(function PgPoolMock() {
      return { end: pgPoolEndMock }
    }),
    neonPoolMock: vi.fn(function NeonPoolMock() {
      return { end: neonPoolEndMock }
    }),
  }
})

vi.mock('pg', () => ({
  Pool: pgPoolMock,
}))

vi.mock('@neondatabase/serverless', () => ({
  Pool: neonPoolMock,
}))

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: nodeDrizzleMock,
}))

vi.mock('drizzle-orm/neon-serverless', () => ({
  drizzle: neonDrizzleMock,
}))

const schema = {
  users: {},
}

const encodedCredentialUrl = `postgresql://${'user'}:${'p%40ss'}@localhost:5432/app?sslmode=disable`

describe('database connection factory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('DATABASE_DRIVER', '')
    __resetProviderResolutionForTests()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    __resetProviderResolutionForTests()
  })

  it('uses the generic PostgreSQL driver by default', () => {
    createDatabaseConnections(
      {
        DATABASE_URL: encodedCredentialUrl,
      },
      schema
    )

    expect(pgPoolMock).toHaveBeenCalledTimes(2)
    expect(nodeDrizzleMock).toHaveBeenCalledTimes(2)
    expect(neonPoolMock).not.toHaveBeenCalled()
    expect(neonDrizzleMock).not.toHaveBeenCalled()
  })

  it('uses DATABASE_URL for both pools when READ_DATABASE_URL is absent', () => {
    createDatabaseConnections(
      {
        DATABASE_URL: 'postgresql://primary.example.com:5432/app',
      },
      schema,
      'postgres'
    )

    expect(pgPoolMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        connectionString: 'postgresql://primary.example.com:5432/app',
      })
    )
    expect(pgPoolMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        connectionString: 'postgresql://primary.example.com:5432/app',
      })
    )
  })

  it('uses READ_DATABASE_URL for the read pool when it is set', () => {
    createDatabaseConnections(
      {
        DATABASE_URL: 'postgresql://primary.example.com:5432/app',
        READ_DATABASE_URL: 'postgresql://replica.example.com:5432/app',
      },
      schema,
      'postgres'
    )

    expect(pgPoolMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        connectionString: 'postgresql://primary.example.com:5432/app',
      })
    )
    expect(pgPoolMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        connectionString: 'postgresql://replica.example.com:5432/app',
      })
    )
  })

  it('keeps the Neon adapter available through DATABASE_DRIVER=neon', () => {
    vi.stubEnv('DATABASE_DRIVER', 'neon')
    __resetProviderResolutionForTests()

    createDatabaseConnections(
      {
        DATABASE_URL: 'postgresql://neon.example.com:5432/app?sslmode=require',
      },
      schema
    )

    expect(neonPoolMock).toHaveBeenCalledTimes(2)
    expect(neonDrizzleMock).toHaveBeenCalledTimes(2)
    expect(pgPoolMock).not.toHaveBeenCalled()
    expect(nodeDrizzleMock).not.toHaveBeenCalled()
  })

  it('applies safe pool defaults and explicit overrides', () => {
    expect(createDatabasePoolConfig({})).toEqual({
      max: 10,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 5000,
    })

    expect(
      createDatabasePoolConfig({
        DATABASE_POOL_MAX: '4',
        DATABASE_POOL_IDLE_TIMEOUT_MS: '30000',
        DATABASE_POOL_CONNECTION_TIMEOUT_MS: '1500',
      })
    ).toEqual({
      max: 4,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 1500,
    })
  })

  it('rejects invalid pool settings during startup', () => {
    expect(() =>
      createDatabasePoolConfig({ DATABASE_POOL_MAX: '0' })
    ).toThrow('DATABASE_POOL_MAX must be a positive integer')

    expect(() =>
      createDatabasePoolConfig({
        DATABASE_POOL_CONNECTION_TIMEOUT_MS: 'not-a-number',
      })
    ).toThrow('DATABASE_POOL_CONNECTION_TIMEOUT_MS must be a positive integer')
  })

  it('closes both primary and read pools for graceful shutdown', async () => {
    const connections = createDatabaseConnections(
      {
        DATABASE_URL: 'postgresql://primary.example.com:5432/app',
        READ_DATABASE_URL: 'postgresql://replica.example.com:5432/app',
      },
      schema,
      'postgres'
    )

    await connections.close()

    expect(pgPoolEndMock).toHaveBeenCalledTimes(2)
  })

  it('closes the primary pool when read pool startup fails', () => {
    pgPoolMock
      .mockImplementationOnce(function PgPoolMock() {
        return { end: pgPoolEndMock }
      })
      .mockImplementationOnce(function PgPoolMock() {
        throw new Error('read pool unavailable')
      })

    expect(() =>
      createDatabaseConnections(
        {
          DATABASE_URL: 'postgresql://primary.example.com:5432/app',
          READ_DATABASE_URL: 'postgresql://replica.example.com:5432/app',
        },
        schema,
        'postgres'
      )
    ).toThrow('read pool unavailable')

    expect(pgPoolEndMock).toHaveBeenCalledOnce()
  })
})
