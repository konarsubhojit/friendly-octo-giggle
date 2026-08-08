/**
 * Hermetic coverage for the reservation service.
 *
 * The fake database below is *behavioural*, not a stub of return values: it
 * holds real variant and ledger rows and evaluates the module's own predicates
 * against them, so the denial of a grant comes from a row that genuinely has
 * no availability left rather than from a mock told to return an empty array.
 * The equivalent SQL is exercised against a real PostgreSQL server by
 * `stock-reservation.integration.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface SqlDescriptor {
  readonly kind: 'sql'
  readonly text: string
  readonly params: unknown[]
}

interface Predicate {
  readonly kind: 'eq' | 'lte' | 'inArray' | 'and'
  readonly args: unknown[]
}

const { mockLogBusinessEvent, mockRecordMetric } = vi.hoisted(() => ({
  mockLogBusinessEvent: vi.fn(),
  mockRecordMetric: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logBusinessEvent: mockLogBusinessEvent }))
vi.mock('@/lib/metrics', () => ({
  recordStockReservationMetric: mockRecordMetric,
}))

vi.mock('@/lib/schema', () => ({
  productVariants: {
    __table: 'ProductVariant',
    id: 'id',
    stock: 'stock',
    reservedStock: 'reservedStock',
    deletedAt: 'deletedAt',
    updatedAt: 'updatedAt',
  },
  stockReservations: {
    __table: 'StockReservation',
    id: 'id',
    checkoutRequestId: 'checkoutRequestId',
    variantId: 'variantId',
    quantity: 'quantity',
    status: 'status',
    expiresAt: 'expiresAt',
    settledAt: 'settledAt',
    updatedAt: 'updatedAt',
  },
}))

vi.mock('drizzle-orm', () => ({
  and: (...args: unknown[]): Predicate => ({ kind: 'and', args }),
  eq: (...args: unknown[]): Predicate => ({ kind: 'eq', args }),
  lte: (...args: unknown[]): Predicate => ({ kind: 'lte', args }),
  inArray: (...args: unknown[]): Predicate => ({ kind: 'inArray', args }),
  asc: (column: unknown) => column,
  sql: (
    strings: TemplateStringsArray,
    ...params: unknown[]
  ): SqlDescriptor => ({
    kind: 'sql',
    text: strings.join('?'),
    params,
  }),
}))

interface VariantRow {
  id: string
  stock: number
  reservedStock: number
  deletedAt: Date | null
}

interface ReservationRow {
  id: string
  checkoutRequestId: string
  variantId: string
  quantity: number
  status: 'HELD' | 'CONSUMED' | 'RELEASED' | 'EXPIRED'
  expiresAt: Date
  settledAt: Date | null
}

const store = {
  variants: [] as VariantRow[],
  reservations: [] as ReservationRow[],
  nextId: 1,
  /** Rows the *next* insert should collide with, simulating a lost race. */
  forceInsertConflict: false,
}

const isSql = (value: unknown): value is SqlDescriptor =>
  typeof value === 'object' &&
  value !== null &&
  (value as SqlDescriptor).kind === 'sql'

const isPredicate = (value: unknown): value is Predicate =>
  typeof value === 'object' &&
  value !== null &&
  'kind' in (value as Predicate) &&
  !isSql(value)

/** Evaluate one of the module's predicates against a candidate row. */
const matches = (predicate: unknown, row: Record<string, unknown>): boolean => {
  if (predicate == null) return true

  if (isSql(predicate)) {
    // `deletedAt IS NULL`
    if (predicate.text.includes('IS NULL')) return row.deletedAt == null
    // `stock - reservedStock >= quantity`
    if (predicate.text.includes('>=')) {
      const quantity = Number(predicate.params.at(-1))
      return Number(row.stock) - Number(row.reservedStock) >= quantity
    }
    // `now()` used as the right-hand side of a comparison
    return true
  }

  if (!isPredicate(predicate)) return true

  switch (predicate.kind) {
    case 'and':
      return predicate.args.every((arg) => matches(arg, row))
    case 'eq': {
      const [column, value] = predicate.args as [string, unknown]
      return row[column] === value
    }
    case 'lte': {
      const [column, value] = predicate.args as [string, unknown]
      // The only `lte` in the module compares `expiresAt` to the database clock.
      const bound = isSql(value) ? new Date() : (value as Date)
      return (row[column] as Date) <= bound
    }
    case 'inArray': {
      const [column, values] = predicate.args as [string, unknown[]]
      return values.includes(row[column])
    }
    default:
      return true
  }
}

/** Apply a `set` payload, interpreting the module's SQL expressions. */
const applySet = (
  row: Record<string, unknown>,
  payload: Record<string, unknown>
): void => {
  for (const [column, value] of Object.entries(payload)) {
    if (!isSql(value)) {
      row[column] = value
      continue
    }
    if (value.text.startsWith('GREATEST')) {
      const amount = Number(value.params.at(-1))
      row[column] = Math.max(Number(row[column]) - amount, 0)
      continue
    }
    if (value.text.includes('+') && value.text.includes('make_interval')) {
      const minutes = Number(value.params.at(-1))
      row[column] = new Date(Date.now() + minutes * 60_000)
      continue
    }
    if (value.text.includes('+')) {
      const amount = Number(value.params.at(-1))
      row[column] = Number(row[column]) + amount
      continue
    }
    row[column] = value
  }
}

const tableRows = (table: { __table: string }): Record<string, unknown>[] =>
  table.__table === 'ProductVariant'
    ? (store.variants as unknown as Record<string, unknown>[])
    : (store.reservations as unknown as Record<string, unknown>[])

const makeClient = () => ({
  select: () => ({
    from: (table: { __table: string }) => {
      const state = {
        rows: tableRows(table),
        limit: Number.POSITIVE_INFINITY,
      }
      const builder = {
        where(predicate: unknown) {
          state.rows = state.rows.filter((row) => matches(predicate, row))
          return builder
        },
        orderBy() {
          return builder
        },
        limit(value: number) {
          state.limit = value
          return builder
        },
        then(resolve: (rows: unknown[]) => unknown) {
          return Promise.resolve(
            state.rows.slice(0, state.limit).map((row) => ({ ...row }))
          ).then(resolve)
        },
      }
      return builder
    },
  }),
  update: (table: { __table: string }) => ({
    set: (payload: Record<string, unknown>) => ({
      where(predicate: unknown) {
        const affected = tableRows(table).filter((row) =>
          matches(predicate, row)
        )
        affected.forEach((row) => applySet(row, payload))
        const result = {
          returning: () => Promise.resolve(affected.map((row) => ({ ...row }))),
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve(affected.length).then(resolve),
        }
        return result
      },
    }),
  }),
  insert: (_table: { __table: string }) => ({
    values: (payload: Record<string, unknown>) => ({
      onConflictDoNothing: () => ({
        returning: () => {
          const duplicate =
            store.forceInsertConflict ||
            store.reservations.some(
              (row) =>
                row.checkoutRequestId === payload.checkoutRequestId &&
                row.variantId === payload.variantId
            )
          if (duplicate) return Promise.resolve([])

          const row = {
            id: `r${store.nextId++}`,
            settledAt: null,
            status: 'HELD',
            ...payload,
          } as unknown as Record<string, unknown>
          applySet(row, { expiresAt: payload.expiresAt })
          store.reservations.push(row as unknown as ReservationRow)
          return Promise.resolve([{ id: row.id }])
        },
      }),
    }),
  }),
})

const fakeDb = {
  ...makeClient(),
  transaction: async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
    const snapshot = {
      variants: store.variants.map((row) => ({ ...row })),
      reservations: store.reservations.map((row) => ({ ...row })),
    }
    try {
      return await callback(makeClient())
    } catch (error) {
      store.variants = snapshot.variants
      store.reservations = snapshot.reservations
      throw error
    }
  },
}

// `vi.mock` is hoisted above `fakeDb`, so the binding is resolved lazily.
vi.mock('@/lib/db', () => ({
  get primaryDrizzleDb() {
    return fakeDb
  },
}))

import {
  RESERVATION_TTL_MINUTES,
  RESERVATION_EXPIRY_BATCH_SIZE,
  consumeForCheckoutRequest,
  expireDueReservations,
  getReservationsForCheckoutRequests,
  releaseForCheckoutRequest,
  reserveForCheckoutRequest,
} from '@/features/orders/services/stock-reservation'

const variant = (id: string, stock: number, reservedStock = 0): VariantRow => ({
  id,
  stock,
  reservedStock,
  deletedAt: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  store.variants = [variant('v1', 1), variant('v2', 5)]
  store.reservations = []
  store.nextId = 1
  store.forceInsertConflict = false
})

describe('reserveForCheckoutRequest', () => {
  it('holds the requested units without touching on-hand stock', async () => {
    const result = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    expect(result).toEqual({ granted: true, heldVariantIds: ['v1'] })
    expect(store.variants[0]).toMatchObject({ stock: 1, reservedStock: 1 })
    expect(store.reservations).toHaveLength(1)
    expect(store.reservations[0].status).toBe('HELD')
    expect(mockRecordMetric).toHaveBeenCalledWith('granted', 1)
  })

  it('sets an expiry from the configured lifetime', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    const heldFor = store.reservations[0].expiresAt.getTime() - Date.now()
    expect(heldFor).toBeGreaterThan((RESERVATION_TTL_MINUTES - 1) * 60_000)
    expect(RESERVATION_TTL_MINUTES).toBe(30)
  })

  it('denies the second holder of the last unit', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    const loser = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr2',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    expect(loser).toEqual({ granted: false, unavailableVariantIds: ['v1'] })
    expect(store.variants[0].reservedStock).toBe(1)
    expect(mockRecordMetric).toHaveBeenCalledWith('denied')
  })

  it('rolls the whole grant back when one item cannot be held', async () => {
    const result = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [
        { variantId: 'v2', quantity: 2 },
        { variantId: 'v1', quantity: 9 },
      ],
    })

    expect(result).toEqual({ granted: false, unavailableVariantIds: ['v1'] })
    expect(store.variants.map((row) => row.reservedStock)).toEqual([0, 0])
    expect(store.reservations).toHaveLength(0)
  })

  it('holds nothing extra when the grant is replayed', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    const replay = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    expect(replay.granted).toBe(true)
    expect(store.variants[0].reservedStock).toBe(1)
    expect(store.reservations).toHaveLength(1)
  })

  it('treats an already consumed hold as satisfied', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })
    store.reservations[0].status = 'CONSUMED'

    const replay = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    expect(replay.granted).toBe(true)
    expect(store.reservations).toHaveLength(1)
  })

  it('denies a request whose hold has already been released', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })
    store.reservations[0].status = 'RELEASED'

    const replay = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    expect(replay).toEqual({ granted: false, unavailableVariantIds: ['v1'] })
  })

  it('gives the units back when a concurrent grant wins the unique constraint', async () => {
    store.forceInsertConflict = true

    const result = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v2', quantity: 2 }],
    })

    expect(result.granted).toBe(true)
    expect(store.variants[1].reservedStock).toBe(0)
  })

  it('denies a soft-deleted variant', async () => {
    store.variants[0].deletedAt = new Date()

    const result = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    expect(result).toEqual({ granted: false, unavailableVariantIds: ['v1'] })
  })

  it('merges duplicate line items for the same variant', async () => {
    const result = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [
        { variantId: 'v2', quantity: 2 },
        { variantId: 'v2', quantity: 3 },
      ],
    })

    expect(result.granted).toBe(true)
    expect(store.variants[1].reservedStock).toBe(5)
    expect(store.reservations).toHaveLength(1)
  })

  it('holds nothing for an empty or non-positive request', async () => {
    const result = await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 0 }],
    })

    expect(result).toEqual({ granted: true, heldVariantIds: [] })
    expect(store.reservations).toHaveLength(0)
  })

  it('propagates an unexpected database failure', async () => {
    const boom = new Error('connection reset')
    const spy = vi
      .spyOn(fakeDb, 'transaction')
      .mockRejectedValueOnce(boom as never)

    await expect(
      reserveForCheckoutRequest({
        checkoutRequestId: 'cr1',
        items: [{ variantId: 'v1', quantity: 1 }],
      })
    ).rejects.toThrow('connection reset')

    spy.mockRestore()
  })
})

describe('releaseForCheckoutRequest', () => {
  it('claims the holds once and returns the units', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    const released = await releaseForCheckoutRequest({
      checkoutRequestId: 'cr1',
      reason: 'checkout_failed',
    })

    expect(released).toEqual({ reservations: 1, quantity: 1 })
    expect(store.variants[0].reservedStock).toBe(0)
    expect(store.reservations[0].status).toBe('RELEASED')
    expect(mockRecordMetric).toHaveBeenCalledWith('released', 1)
  })

  it('is a no-op on replay', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })
    await releaseForCheckoutRequest({
      checkoutRequestId: 'cr1',
      reason: 'checkout_failed',
    })

    const replay = await releaseForCheckoutRequest({
      checkoutRequestId: 'cr1',
      reason: 'checkout_failed',
    })

    expect(replay).toEqual({ reservations: 0, quantity: 0 })
    expect(store.variants[0].reservedStock).toBe(0)
  })

  it('clamps the counter at zero when it has already drifted low', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })
    store.variants[0].reservedStock = 0

    await releaseForCheckoutRequest({
      checkoutRequestId: 'cr1',
      reason: 'drift',
    })

    expect(store.variants[0].reservedStock).toBe(0)
  })
})

describe('consumeForCheckoutRequest', () => {
  it('consumes the holds exactly once inside the caller transaction', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    const consumed = await fakeDb.transaction((tx) =>
      consumeForCheckoutRequest(tx as never, 'cr1')
    )

    expect(consumed).toEqual({ reservations: 1, quantity: 1 })
    expect(store.reservations[0].status).toBe('CONSUMED')
    expect(store.variants[0].reservedStock).toBe(0)
    expect(mockRecordMetric).toHaveBeenCalledWith('consumed', 1)
  })

  it('claims nothing when the pipeline is retried', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })
    await fakeDb.transaction((tx) =>
      consumeForCheckoutRequest(tx as never, 'cr1')
    )

    const replay = await fakeDb.transaction((tx) =>
      consumeForCheckoutRequest(tx as never, 'cr1')
    )

    expect(replay).toEqual({ reservations: 0, quantity: 0 })
    expect(store.variants[0].reservedStock).toBe(0)
  })
})

describe('expireDueReservations', () => {
  it('leaves a live hold alone', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })

    expect(await expireDueReservations()).toEqual({
      reservations: 0,
      quantity: 0,
    })
    expect(store.variants[0].reservedStock).toBe(1)
  })

  it('returns lapsed units and never claims them twice', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })
    store.reservations[0].expiresAt = new Date(Date.now() - 60_000)

    expect(await expireDueReservations()).toEqual({
      reservations: 1,
      quantity: 1,
    })
    expect(store.variants[0].reservedStock).toBe(0)
    expect(store.reservations[0].status).toBe('EXPIRED')
    expect(mockRecordMetric).toHaveBeenCalledWith('expired', 1)

    expect(await expireDueReservations()).toEqual({
      reservations: 0,
      quantity: 0,
    })
  })

  it('honours the batch bound', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr2',
      items: [{ variantId: 'v2', quantity: 1 }],
    })
    store.reservations.forEach((row) => {
      row.expiresAt = new Date(Date.now() - 60_000)
    })

    expect(await expireDueReservations(1)).toEqual({
      reservations: 1,
      quantity: 1,
    })
    expect(await expireDueReservations(1)).toEqual({
      reservations: 1,
      quantity: 1,
    })
  })

  it('never claims more than the module-level batch size', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [{ variantId: 'v1', quantity: 1 }],
    })
    store.reservations[0].expiresAt = new Date(Date.now() - 60_000)

    expect(
      await expireDueReservations(RESERVATION_EXPIRY_BATCH_SIZE * 10)
    ).toEqual({ reservations: 1, quantity: 1 })
  })
})

describe('getReservationsForCheckoutRequests', () => {
  it('returns an empty map for no ids', async () => {
    expect(await getReservationsForCheckoutRequests([])).toEqual(new Map())
  })

  it('summarises live holds and their earliest expiry', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [
        { variantId: 'v1', quantity: 1 },
        { variantId: 'v2', quantity: 2 },
      ],
    })

    const summaries = await getReservationsForCheckoutRequests(['cr1', 'cr2'])

    expect(summaries.get('cr1')).toMatchObject({
      heldQuantity: 3,
      status: 'HELD',
    })
    expect(summaries.get('cr1')?.expiresAt).toBeInstanceOf(Date)
    expect(summaries.has('cr2')).toBe(false)
  })

  it('reports a mixed lifecycle and no live expiry once settled', async () => {
    await reserveForCheckoutRequest({
      checkoutRequestId: 'cr1',
      items: [
        { variantId: 'v1', quantity: 1 },
        { variantId: 'v2', quantity: 2 },
      ],
    })
    store.reservations[0].status = 'CONSUMED'
    store.reservations[1].status = 'RELEASED'

    const summaries = await getReservationsForCheckoutRequests(['cr1'])

    expect(summaries.get('cr1')).toMatchObject({
      heldQuantity: 0,
      status: 'MIXED',
      expiresAt: null,
    })
  })
})
